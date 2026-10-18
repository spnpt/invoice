// Supabase Edge Function: send an invoice email with the PDF attached, via Gmail SMTP.
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   GMAIL_USER          - your Gmail address, e.g. you@gmail.com
//   GMAIL_APP_PASSWORD  - 16-char app password from https://myaccount.google.com/apppasswords
//   EMAIL_FROM_NAME     - optional display name, e.g. "My Business"
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

type Mail = {
  to: string; cc?: string; replyTo?: string; subject: string; text: string; html: string;
  attachment?: { filename: string; base64: string };
};
type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function sendGmail(m: Mail, user: string, pass: string): Promise<SendResult> {
  // Port 465 (implicit TLS); Supabase Edge blocks outbound 25 and 587.
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } });
  const name = Deno.env.get('EMAIL_FROM_NAME');
  try {
    const info = await transport.sendMail({
      from: name ? `"${name.replace(/"/g, '')}" <${user}>` : user,
      to: m.to, cc: m.cc, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html,
      attachments: m.attachment
        ? [{ filename: m.attachment.filename, content: m.attachment.base64, encoding: 'base64', contentType: 'application/pdf' }]
        : undefined,
    });
    return { ok: true, id: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const gmailUser = Deno.env.get('GMAIL_USER');
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')?.replace(/\s/g, '');
  if (!gmailUser || !gmailPass) {
    return json({ error: 'Email is not configured (set GMAIL_USER and GMAIL_APP_PASSWORD).' }, 500);
  }

  // Act as the calling user so row-level security applies to every query.
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  let p: { invoice_id?: string; to?: string; cc?: string; subject?: string; body?: string; pdf_base64?: string; filename?: string };
  try { p = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const to = (p.to ?? '').trim();
  const cc = (p.cc ?? '').trim();
  const subject = (p.subject ?? '').trim().replace(/[\r\n]+/g, ' ');
  const body = p.body ?? '';
  if (!p.invoice_id) return json({ error: 'invoice_id is required' }, 400);
  if (!EMAIL_RE.test(to)) return json({ error: 'Invalid recipient email' }, 400);
  if (cc && !EMAIL_RE.test(cc)) return json({ error: 'Invalid CC email' }, 400);
  if (!subject || subject.length > 200) return json({ error: 'Subject is required (max 200 chars)' }, 400);
  if (body.length > 20000) return json({ error: 'Message too long' }, 400);
  if (p.pdf_base64 && p.pdf_base64.length * 0.75 > MAX_PDF_BYTES) return json({ error: 'Attachment too large' }, 400);

  const { data: inv } = await supa.from('invoices').select('id, number, status').eq('id', p.invoice_id).maybeSingle();
  if (!inv) return json({ error: 'Invoice not found' }, 404);
  const { data: settings } = await supa.from('settings').select('email').maybeSingle();

  const mail: Mail = {
    to, cc: cc || undefined, replyTo: settings?.email || undefined, subject, text: body,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(body)}</div>`,
    attachment: p.pdf_base64
      ? { filename: (p.filename || `${inv.number}.pdf`).replace(/[^\w.\-]/g, '_'), base64: p.pdf_base64 }
      : undefined,
  };

  const result = await sendGmail(mail, gmailUser, gmailPass);

  await supa.from('email_log').insert({
    owner: user.id, invoice_id: inv.id, to_email: to, cc_email: cc || null, subject,
    status: result.ok ? 'sent' : 'failed',
    provider_id: result.ok ? result.id : null,
    error: result.ok ? null : result.error,
  });

  if (!result.ok) return json({ error: result.error }, 502);
  if (inv.status === 'draft') await supa.from('invoices').update({ status: 'sent' }).eq('id', inv.id);
  return json({ id: result.id });
});

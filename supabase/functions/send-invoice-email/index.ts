// Supabase Edge Function: send an invoice email with the PDF attached, via Resend.
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   RESEND_API_KEY  - from https://resend.com/api-keys
//   EMAIL_FROM      - e.g. "My Business <invoices@yourdomain.com>" (domain verified in Resend)
//                     Without a verified domain use "onboarding@resend.dev"; Resend then only
//                     delivers to the email address of your Resend account.
import { createClient } from 'npm:@supabase/supabase-js@2';

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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev';
  if (!apiKey) return json({ error: 'Email is not configured (RESEND_API_KEY missing).' }, 500);

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
  const subject = (p.subject ?? '').trim();
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

  const filename = (p.filename || `${inv.number}.pdf`).replace(/[^\w.\-]/g, '_');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      cc: cc ? [cc] : undefined,
      reply_to: settings?.email || undefined,
      subject,
      text: body,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(body)}</div>`,
      attachments: p.pdf_base64 ? [{ filename, content: p.pdf_base64 }] : undefined,
    }),
  });
  const out = await res.json().catch(() => ({}));
  const ok = res.ok;

  await supa.from('email_log').insert({
    owner: user.id, invoice_id: inv.id, to_email: to, cc_email: cc || null, subject,
    status: ok ? 'sent' : 'failed', provider_id: out?.id ?? null, error: ok ? null : (out?.message ?? `HTTP ${res.status}`),
  });

  if (!ok) return json({ error: out?.message ?? 'Email provider error' }, 502);
  if (inv.status === 'draft') await supa.from('invoices').update({ status: 'sent' }).eq('id', inv.id);
  return json({ id: out.id });
});

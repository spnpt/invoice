import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Invoice, InvoiceItem, Settings, getSettings, supabase } from '../lib/supabase';
import { EmailTemplate, emailConfigured, listTemplates, render, sendInvoiceEmail, templateVars } from '../lib/email';
import { buildInvoicePdf } from '../lib/pdf';
import { ErrorText, PageHeader } from '../components/ui';

export default function SendEmail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [f, setF] = useState({ to: '', cc: '', subject: '', body: '', attach: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => { emailConfigured().then(setReady); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: invData, error: e1 }, { data: its }, s, tpls] = await Promise.all([
          supabase.from('invoices').select('*, customers(*)').eq('id', id).single(),
          supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position'),
          getSettings(),
          listTemplates(),
        ]);
        if (e1) throw e1;
        const invoice = invData as Invoice;
        setInv(invoice); setItems((its ?? []) as InvoiceItem[]); setSettings(s); setTemplates(tpls);
        const t = tpls.find(x => x.is_default) ?? tpls[0];
        const vars = templateVars(invoice, s);
        setF(v => ({
          ...v, to: invoice.customers?.email ?? '',
          subject: t ? render(t.subject, vars) : `Invoice ${invoice.number}`,
          body: t ? render(t.body, vars) : '',
        }));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [id]);

  function applyTemplate(tid: string) {
    const t = templates.find(x => x.id === tid);
    if (!t || !inv || !settings) return;
    const vars = templateVars(inv, settings);
    setF(v => ({ ...v, subject: render(t.subject, vars), body: render(t.body, vars) }));
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!inv || !settings) return;
    setBusy(true); setError('');
    try {
      const pdf = await buildInvoicePdf(inv, items, settings);
      await sendInvoiceEmail({
        invoice_id: inv.id, to: f.to.trim(), cc: f.cc.trim() || undefined,
        subject: f.subject, body: f.body,
        pdf: f.attach ? pdf : new Blob(), filename: `${inv.number}.pdf`,
      });
      nav(`/invoices/${inv.id}`);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!inv) return error ? <ErrorText msg={error} /> : <p className="text-gray-500">Loading...</p>;

  return (
    <form onSubmit={send} className="space-y-4">
      <PageHeader title={`Email ${inv.number}`} back={`/invoices/${inv.id}`} />
      {ready === false && (
        <div className="card border border-amber-300 bg-amber-50 text-sm space-y-1">
          <div className="font-semibold">Email sending is not set up yet</div>
          <div>
            Add <code>GMAIL_USER</code> and <code>GMAIL_APP_PASSWORD</code> in Supabase under
            Edge Functions &gt; Secrets (see README). Until then, use WhatsApp or Share PDF on the invoice.
          </div>
        </div>
      )}
      <div className="card space-y-3">
        <div>
          <label className="label">Template</label>
          <select className="input" defaultValue={(templates.find(t => t.is_default) ?? templates[0])?.id}
            onChange={e => applyTemplate(e.target.value)}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">To *</label>
          <input className="input" type="email" required value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
        </div>
        <div>
          <label className="label">CC</label>
          <input className="input" type="email" value={f.cc} onChange={e => setF({ ...f, cc: e.target.value })} />
        </div>
        <div>
          <label className="label">Subject *</label>
          <input className="input" required maxLength={200} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input" rows={10} value={f.body} onChange={e => setF({ ...f, body: e.target.value })} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.attach} onChange={e => setF({ ...f, attach: e.target.checked })} />
          Attach invoice PDF
        </label>
      </div>
      <ErrorText msg={error} />
      <button className="btn-primary w-full" disabled={busy || ready === false}>{busy ? 'Sending...' : 'Send email'}</button>
    </form>
  );
}

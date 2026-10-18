import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Invoice, InvoiceItem, InvoiceStatus, Settings, getSettings, money, supabase } from '../lib/supabase';
import { buildInvoicePdf } from '../lib/pdf';
import { EmailLog, listEmailLog } from '../lib/email';
import { ErrorText, PageHeader, StatusBadge } from '../components/ui';

export default function InvoiceView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [log, setLog] = useState<EmailLog[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('invoices').select('*, customers(*)').eq('id', id).single();
      if (error) return setError(error.message);
      setInv(data as Invoice);
      const { data: its } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position');
      setItems((its ?? []) as InvoiceItem[]);
      setSettings(await getSettings());
      listEmailLog(id!).then(setLog).catch(() => {});
    })();
  }, [id]);

  if (error && !inv) return <ErrorText msg={error} />;
  if (!inv || !settings) return <p className="text-gray-500">Loading...</p>;
  const cur = settings.currency;

  async function setStatus(status: InvoiceStatus) {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', inv!.id);
    if (error) return setError(error.message);
    setInv({ ...inv!, status });
  }

  async function pdfFile() {
    const blob = await buildInvoicePdf(inv!, items, settings!);
    return new File([blob], `${inv!.number}.pdf`, { type: 'application/pdf' });
  }

  async function download() {
    setBusy(true);
    try {
      const file = await pdfFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally { setBusy(false); }
  }

  async function share() {
    setBusy(true);
    try {
      const file = await pdfFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${inv!.number}` });
        if (inv!.status === 'draft') await setStatus('sent');
      } else {
        await download();
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setError(e.message ?? String(e));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm('Delete this invoice?')) return;
    const { error } = await supabase.from('invoices').delete().eq('id', inv!.id);
    if (error) return setError(error.message);
    nav('/invoices');
  }

  const c = inv.customers;
  return (
    <div className="space-y-4">
      <PageHeader title={inv.number} back="/invoices" action={<StatusBadge status={inv.status} />} />

      <div className="card space-y-1 text-sm">
        <div className="font-semibold text-base">{c?.name}</div>
        {c?.address && <div className="whitespace-pre-line text-gray-600">{c.address}</div>}
        {c?.email && <div className="text-gray-600">{c.email}</div>}
        <div className="pt-2 text-gray-500">Issued {inv.issue_date}{inv.due_date && ` - Due ${inv.due_date}`}</div>
      </div>

      <div className="card divide-y">
        {items.map((it, i) => (
          <div key={it.id ?? i} className="py-2 flex justify-between gap-2">
            <div>
              <div>{it.description}</div>
              <div className="text-sm text-gray-500">{it.qty} x {money(it.unit_price, cur)} - tax {it.tax_rate}%</div>
            </div>
            <div className="font-medium">{money(it.line_total ?? 0, cur)}</div>
          </div>
        ))}
        <div className="pt-2 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(inv.subtotal, cur)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{money(inv.tax_total, cur)}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(inv.total, cur)}</span></div>
        </div>
      </div>

      {inv.notes && <div className="card text-sm whitespace-pre-line">{inv.notes}</div>}

      <ErrorText msg={error} />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" disabled={busy} onClick={share}>Share PDF</button>
        <button className="btn-secondary" disabled={busy} onClick={download}>Download PDF</button>
        {inv.status !== 'paid' && <button className="btn-secondary" onClick={() => setStatus('paid')}>Mark paid</button>}
        {inv.status === 'draft' && <button className="btn-secondary" onClick={() => setStatus('sent')}>Mark sent</button>}
        {inv.status !== 'void' && inv.status !== 'draft' && <button className="btn-secondary" onClick={() => setStatus('void')}>Void</button>}
        <Link to={`/invoices/${inv.id}/edit`} className="btn-secondary">Edit</Link>
        <Link to={`/invoices/${inv.id}/email`} className="btn-primary">Send email</Link>
        <button className="btn-danger" onClick={remove}>Delete</button>
      </div>

      {log.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-2">Email history</h2>
          <ul className="divide-y text-sm">
            {log.map(l => (
              <li key={l.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{l.to_email}</span>
                  <span className={l.status === 'sent' ? 'text-green-600' : 'text-red-600'}>{l.status}</span>
                </div>
                <div className="text-gray-500">{new Date(l.created_at).toLocaleString()} - {l.subject}</div>
                {l.error && <div className="text-red-600">{l.error}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

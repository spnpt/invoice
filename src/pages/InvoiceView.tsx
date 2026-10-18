import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Invoice, InvoiceItem, InvoiceStatus, Settings, getSettings, money, supabase } from '../lib/supabase';
import { buildInvoicePdf } from '../lib/pdf';
import { EmailLog, listEmailLog } from '../lib/email';
import { pdfLink, toWhatsAppNumber, whatsAppMessage, whatsAppUrl } from '../lib/whatsapp';
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
  const [pdf, setPdf] = useState<File | null>(null);
  const [shareFallback, setShareFallback] = useState(false);

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

  // Build the PDF ahead of time: iOS Safari only allows navigator.share() directly inside a tap,
  // so there must be no slow async work between the tap and the share call.
  useEffect(() => {
    if (!inv || !settings) return;
    let cancelled = false;
    setPdf(null);
    buildInvoicePdf(inv, items, settings)
      .then(blob => { if (!cancelled) setPdf(new File([blob], `${inv.number}.pdf`, { type: 'application/pdf' })); })
      .catch(e => setError(e.message ?? String(e)));
    return () => { cancelled = true; };
    // Status changes don't affect the PDF content, so only rebuild when the invoice itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id, items, settings]);

  if (error && !inv) return <ErrorText msg={error} />;
  if (!inv || !settings) return <p className="text-gray-500">Loading...</p>;
  const cur = settings.currency;

  async function setStatus(status: InvoiceStatus) {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', inv!.id);
    if (error) return setError(error.message);
    setInv({ ...inv!, status });
  }

  function download() {
    if (!pdf) return;
    const url = URL.createObjectURL(pdf);
    const a = document.createElement('a');
    a.href = url; a.download = pdf.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // In-app browsers (WhatsApp, Gmail, Facebook, Instagram...) usually block file sharing.
  const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp|GSA\/|Snapchat|LinkedInApp|; wv\)/i.test(navigator.userAgent);

  // Opens the PDF in the browser's viewer, which has its own Share button (works on iPhone Safari).
  function openPdf() {
    if (!pdf) return;
    const url = URL.createObjectURL(pdf);
    if (!window.open(url, '_blank')) window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Called synchronously from the tap so iOS keeps the user-gesture permission.
  function shareFile(onDone: () => void) {
    if (!pdf) return;
    setError(''); setShareFallback(false);
    if (!navigator.share) {
      setShareFallback(true);
      return;
    }
    // Try even when canShare() says no; some iOS versions report false but still share files.
    navigator.share({ files: [pdf], title: `Invoice ${inv!.number}` })
      .then(onDone)
      .catch((e: any) => {
        if (e?.name === 'AbortError') return;
        setShareFallback(true);
      });
  }

  const markSentIfDraft = async () => { if (inv!.status === 'draft') await setStatus('sent'); };
  const share = () => shareFile(markSentIfDraft);
  // On iPhone, sharing a file plus text makes WhatsApp drop one of them, so share only the PDF.
  const whatsAppFile = () => shareFile(markSentIfDraft);

  async function whatsAppLink() {
    if (!pdf) return;
    setBusy(true); setError('');
    try {
      const link = await pdfLink(inv!, pdf);
      const number = toWhatsAppNumber(inv!.customers?.phone, settings!.phone_country_code ?? '64');
      await markSentIfDraft();
      // Same-tab navigation: iOS hands wa.me links straight to the WhatsApp app, and it is
      // never blocked as a popup even after the async upload.
      window.location.href = whatsAppUrl(number, whatsAppMessage(inv!, settings!, link));
    } catch (e: any) {
      setError(e.message ?? String(e));
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
      {shareFallback && (
        <div className="card border border-amber-300 bg-amber-50 text-sm space-y-2">
          <div className="font-semibold">This browser can't share files directly</div>
          {inAppBrowser
            ? <div>You're in an app's built-in browser. Tap the menu (... or the compass icon) and choose <b>Open in Safari</b>, then try again.</div>
            : <div>Tap <b>Open PDF</b>, then use the Share button in the PDF viewer to send it to WhatsApp, or use <b>WhatsApp link</b>.</div>}
          <button className="btn-secondary w-full" onClick={openPdf}>Open PDF</button>
        </div>
      )}
      {!pdf && <p className="text-sm text-gray-500">Preparing PDF...</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary" disabled={busy || !pdf} onClick={share}>Share PDF</button>
        <button className="btn-secondary" disabled={busy || !pdf} onClick={download}>Download PDF</button>
        {inv.status !== 'paid' && <button className="btn-secondary" onClick={() => setStatus('paid')}>Mark paid</button>}
        {inv.status === 'draft' && <button className="btn-secondary" onClick={() => setStatus('sent')}>Mark sent</button>}
        {inv.status !== 'void' && inv.status !== 'draft' && <button className="btn-secondary" onClick={() => setStatus('void')}>Void</button>}
        <Link to={`/invoices/${inv.id}/edit`} className="btn-secondary">Edit</Link>
        <Link to={`/invoices/${inv.id}/email`} className="btn-primary">Send email</Link>
        <button className="btn bg-green-600 text-white active:bg-green-700" disabled={busy || !pdf} onClick={whatsAppFile}>WhatsApp PDF</button>
        <button className="btn bg-green-100 text-green-800 active:bg-green-200" disabled={busy || !pdf} onClick={whatsAppLink}>WhatsApp link</button>
        <button className="btn-danger" onClick={remove}>Delete</button>
      </div>

      {log.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-2">Email history</h2>
          <ul className="divide-y text-sm">
            {log.map(l => (
              <li key={l.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{l.to_email}{l.cc_email && <span className="text-gray-500"> (cc {l.cc_email})</span>}</span>
                  <span className="text-green-600">Sent</span>
                </div>
                <div className="text-gray-500">{new Date(l.created_at).toLocaleString()} - {l.subject}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

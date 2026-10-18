import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Invoice, InvoiceStatus, getSettings, money, supabase } from '../lib/supabase';
import { ErrorText, PageHeader, StatusBadge } from '../components/ui';

const filters: (InvoiceStatus | 'all')[] = ['all', 'draft', 'sent', 'paid', 'void'];
const statuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'void'];
const statusLabel: Record<InvoiceStatus, string> = {
  draft: 'Mark as draft', sent: 'Mark as sent', paid: 'Mark as paid', void: 'Void invoice',
};

export default function Invoices() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [currency, setCurrency] = useState('NZD');
  const [error, setError] = useState('');
  const [menuFor, setMenuFor] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings().then(s => setCurrency(s.currency)).catch(() => {});
    supabase.from('invoices').select('*, customers(name)').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setError(error.message); else setItems(data as Invoice[]); });
  }, []);

  const shown = items.filter(i => filter === 'all' || i.status === filter);
  const outstanding = items.filter(i => i.status === 'sent').reduce((a, i) => a + Number(i.total), 0);

  async function changeStatus(inv: Invoice, status: InvoiceStatus) {
    if (status === 'void' && !confirm(`Void invoice ${inv.number}?`)) return;
    setBusy(true); setError('');
    const { error } = await supabase.from('invoices').update({ status }).eq('id', inv.id);
    setBusy(false);
    if (error) return setError(error.message);
    setItems(list => list.map(x => (x.id === inv.id ? { ...x, status } : x)));
    setMenuFor(null);
  }

  return (
    <div>
      <PageHeader title="Invoices" action={<Link to="/invoices/new" className="btn-primary">+ New</Link>} />
      <div className="card mb-3 flex justify-between">
        <span className="text-gray-500">Outstanding</span>
        <span className="font-semibold">{money(outstanding, currency)}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto mb-3">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
            {f}
          </button>
        ))}
      </div>
      <ErrorText msg={error} />
      <ul className="space-y-2">
        {shown.map(i => (
          <li key={i.id} className="card flex items-center gap-2 p-0">
            <Link to={`/invoices/${i.id}`} className="flex flex-1 min-w-0 items-center justify-between gap-2 p-4 pr-0">
              <div className="min-w-0">
                <div className="font-medium">{i.number} <StatusBadge status={i.status} /></div>
                <div className="text-sm text-gray-500 truncate">{i.customers?.name} - {i.issue_date}</div>
              </div>
              <div className="font-semibold">{money(i.total, currency)}</div>
            </Link>
            <button aria-label={`Actions for ${i.number}`} onClick={() => setMenuFor(i)}
              className="h-12 w-11 shrink-0 text-2xl leading-none text-gray-500 active:bg-gray-100 rounded-r-xl">
              &#8942;
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="text-center text-gray-500 py-8">No invoices.</li>}
      </ul>

      {menuFor && (
        // Bottom sheet: easy to reach with a thumb on iPhone; tap the backdrop to close.
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setMenuFor(null)}>
          <div className="w-full mx-auto max-w-3xl rounded-t-2xl bg-white p-4 space-y-2"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-1">
              <div className="font-semibold">{menuFor.number} <StatusBadge status={menuFor.status} /></div>
              <span className="text-sm text-gray-500">{menuFor.customers?.name}</span>
            </div>
            {statuses.filter(s => s !== menuFor.status).map(s => (
              <button key={s} disabled={busy} onClick={() => changeStatus(menuFor, s)}
                className={`btn w-full ${s === 'void' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
                {menuFor.status === 'void' && s !== 'void' ? `Restore: ${statusLabel[s].toLowerCase()}` : statusLabel[s]}
              </button>
            ))}
            <Link to={`/invoices/${menuFor.id}/edit`} className="btn w-full bg-gray-100 text-gray-800">Edit invoice</Link>
            <button className="btn-secondary w-full" onClick={() => setMenuFor(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

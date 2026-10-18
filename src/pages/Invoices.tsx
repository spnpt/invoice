import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Invoice, InvoiceStatus, getSettings, money, supabase } from '../lib/supabase';
import { ErrorText, PageHeader, StatusBadge } from '../components/ui';

const filters: (InvoiceStatus | 'all')[] = ['all', 'draft', 'sent', 'paid', 'void'];

export default function Invoices() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('all');
  const [currency, setCurrency] = useState('NZD');
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings().then(s => setCurrency(s.currency)).catch(() => {});
    supabase.from('invoices').select('*, customers(name)').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setError(error.message); else setItems(data as Invoice[]); });
  }, []);

  const shown = items.filter(i => filter === 'all' || i.status === filter);
  const outstanding = items.filter(i => i.status === 'sent').reduce((a, i) => a + Number(i.total), 0);

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
          <li key={i.id}>
            <Link to={`/invoices/${i.id}`} className="card flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{i.number} <StatusBadge status={i.status} /></div>
                <div className="text-sm text-gray-500 truncate">{i.customers?.name} - {i.issue_date}</div>
              </div>
              <div className="font-semibold">{money(i.total, currency)}</div>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="text-center text-gray-500 py-8">No invoices.</li>}
      </ul>
    </div>
  );
}

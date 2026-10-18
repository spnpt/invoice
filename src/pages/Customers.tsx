import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Customer, supabase } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('customers').select('*').order('name').then(({ data, error }) => {
      if (error) setError(error.message); else setItems(data as Customer[]);
    });
  }, []);

  const term = q.toLowerCase();
  const shown = items.filter(c => !term || [c.name, c.email, c.phone].some(v => (v ?? '').toLowerCase().includes(term)));

  return (
    <div>
      <PageHeader title="Customers" action={<Link to="/customers/new" className="btn-primary">+ New</Link>} />
      <input className="input mb-3" placeholder="Search name, email, phone" value={q} onChange={e => setQ(e.target.value)} />
      <ErrorText msg={error} />
      <ul className="space-y-2">
        {shown.map(c => (
          <li key={c.id} className="card">
            <Link to={`/customers/${c.id}`} className="block font-medium">{c.name}</Link>
            <div className="flex gap-4 text-sm mt-1">
              {c.phone && <a href={`tel:${c.phone}`} className="text-blue-600">{c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="text-blue-600 truncate">{c.email}</a>}
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="text-center text-gray-500 py-8">No customers yet.</li>}
      </ul>
    </div>
  );
}

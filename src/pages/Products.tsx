import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Product, getSettings, money, publicUrl, supabase } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [currency, setCurrency] = useState('NZD');
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings().then(s => setCurrency(s.currency)).catch(() => {});
    supabase.from('products').select('*').order('name').then(({ data, error }) => {
      if (error) setError(error.message); else setItems(data as Product[]);
    });
  }, []);

  const term = q.toLowerCase();
  const shown = items.filter(p => !term || p.name.toLowerCase().includes(term) || (p.sku ?? '').toLowerCase().includes(term));

  return (
    <div>
      <PageHeader title="Products" action={<Link to="/products/new" className="btn-primary">+ New</Link>} />
      <input className="input mb-3" placeholder="Search name or SKU" value={q} onChange={e => setQ(e.target.value)} />
      <ErrorText msg={error} />
      <ul className="space-y-2">
        {shown.map(p => {
          const img = publicUrl(p.image_path);
          return (
            <li key={p.id}>
              <Link to={`/products/${p.id}`} className="card flex items-center gap-3">
                {img
                  ? <img src={img} alt="" className="h-14 w-14 rounded-lg object-cover bg-gray-100" loading="lazy" />
                  : <div className="h-14 w-14 rounded-lg bg-gray-100" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.name}{!p.active && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}</div>
                  <div className="text-sm text-gray-500 truncate">{p.sku}</div>
                </div>
                <div className="font-semibold">{money(p.unit_price, currency)}</div>
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-center text-gray-500 py-8">No products yet.</li>}
      </ul>
    </div>
  );
}

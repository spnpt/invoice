import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Customer, InvoiceItem, Product, calcTotals, getSettings, money, supabase } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

type Line = Omit<InvoiceItem, 'qty' | 'unit_price' | 'tax_rate'> & { key: string; qty: string; unit_price: string; tax_rate: string };

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

export default function InvoiceEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState('NZD');
  const [defaultTax, setDefaultTax] = useState(15);
  const [h, setH] = useState({ customer_id: '', issue_date: today(), due_date: addDays(today(), 14), notes: '', status: 'draft' });
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers((data ?? []) as Customer[]));
    supabase.from('products').select('*').eq('active', true).order('name').then(({ data }) => setProducts((data ?? []) as Product[]));
    getSettings().then(s => { setCurrency(s.currency); setDefaultTax(Number(s.default_tax_rate)); }).catch(() => {});
    if (!id) return;
    (async () => {
      const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', id).single();
      if (error) return setError(error.message);
      setH({ customer_id: inv.customer_id ?? '', issue_date: inv.issue_date, due_date: inv.due_date ?? '', notes: inv.notes ?? '', status: inv.status });
      const { data: its } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('position');
      setLines((its ?? []).map((it: any) => ({
        key: it.id, product_id: it.product_id, description: it.description,
        qty: String(it.qty), unit_price: String(it.unit_price), tax_rate: String(it.tax_rate),
      })));
    })();
  }, [id]);

  const addProduct = (pid: string) => {
    const p = products.find(x => x.id === pid);
    if (!p) return;
    setLines(ls => [...ls, {
      key: crypto.randomUUID(), product_id: p.id, description: p.name,
      qty: '1', unit_price: String(p.unit_price), tax_rate: String(p.tax_rate),
    }]);
  };
  const addCustom = () => setLines(ls => [...ls, {
    key: crypto.randomUUID(), product_id: null, description: '', qty: '1', unit_price: '0', tax_rate: String(defaultTax),
  }]);
  const update = (key: string, patch: Partial<Line>) => setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l));
  const removeLine = (key: string) => setLines(ls => ls.filter(l => l.key !== key));

  const numeric: InvoiceItem[] = lines.map(l => ({
    product_id: l.product_id, description: l.description,
    qty: Number(l.qty) || 0, unit_price: Number(l.unit_price) || 0, tax_rate: Number(l.tax_rate) || 0,
  }));
  const totals = calcTotals(numeric);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!h.customer_id) return setError('Select a customer.');
    if (numeric.length === 0) return setError('Add at least one line.');
    if (numeric.some(l => !l.description.trim() || l.qty <= 0)) return setError('Each line needs a description and quantity above 0.');
    setBusy(true); setError('');
    const { data, error } = await supabase.rpc('save_invoice', { inv: { id: id ?? null, ...h }, items: numeric });
    setBusy(false);
    if (error) return setError(error.message);
    nav(`/invoices/${data}`);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title={id ? 'Edit invoice' : 'New invoice'} back={id ? `/invoices/${id}` : '/invoices'} />
      <div className="card space-y-3">
        <div>
          <label className="label">Customer *</label>
          <div className="flex gap-2">
            <select className="input" value={h.customer_id} onChange={e => setH({ ...h, customer_id: e.target.value })}>
              <option value="">Select...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Link to="/customers/new" className="btn-secondary whitespace-nowrap">+ New</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Issue date</label>
            <input type="date" className="input" value={h.issue_date} onChange={e => setH({ ...h, issue_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Due date</label>
            <input type="date" className="input" value={h.due_date} onChange={e => setH({ ...h, due_date: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold">Items</h2>
        {lines.map(l => (
          <div key={l.key} className="border rounded-lg p-3 space-y-2">
            <input className="input" placeholder="Description" value={l.description} onChange={e => update(l.key, { description: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-gray-500">Qty</label>
                <input className="input" type="number" inputMode="decimal" step="any" min="0" value={l.qty} onChange={e => update(l.key, { qty: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Price</label>
                <input className="input" type="number" inputMode="decimal" step="0.01" min="0" value={l.unit_price} onChange={e => update(l.key, { unit_price: e.target.value })} /></div>
              <div><label className="text-xs text-gray-500">Tax %</label>
                <input className="input" type="number" inputMode="decimal" step="0.01" min="0" value={l.tax_rate} onChange={e => update(l.key, { tax_rate: e.target.value })} /></div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <button type="button" className="text-red-600" onClick={() => removeLine(l.key)}>Remove</button>
              <span className="font-medium">{money((Number(l.qty) || 0) * (Number(l.unit_price) || 0), currency)}</span>
            </div>
          </div>
        ))}
        <select className="input" value="" onChange={e => addProduct(e.target.value)}>
          <option value="">+ Add product...</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} - {money(p.unit_price, currency)}</option>)}
        </select>
        <button type="button" className="btn-secondary w-full" onClick={addCustom}>+ Custom line</button>
      </div>

      <div className="card space-y-1">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal, currency)}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>{money(totals.tax, currency)}</span></div>
        <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(totals.total, currency)}</span></div>
      </div>

      <div className="card">
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={h.notes} onChange={e => setH({ ...h, notes: e.target.value })} />
      </div>

      <ErrorText msg={error} />
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving...' : 'Save invoice'}</button>
    </form>
  );
}

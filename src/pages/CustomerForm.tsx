import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

const empty = { name: '', email: '', phone: '', address: '', notes: '' };

export default function CustomerForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('customers').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) return setError(error.message);
      setF({ name: data.name, email: data.email ?? '', phone: data.phone ?? '', address: data.address ?? '', notes: data.notes ?? '' });
    });
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const row = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
    const { error } = id
      ? await supabase.from('customers').update(row).eq('id', id)
      : await supabase.from('customers').insert(row);
    setBusy(false);
    if (error) return setError(error.message);
    nav('/customers');
  }

  async function remove() {
    if (!id || !confirm('Delete this customer?')) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      return setError(error.code === '23503' ? 'This customer has invoices and cannot be deleted.' : error.message);
    }
    nav('/customers');
  }

  const field = (k: keyof typeof empty, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} required={k === 'name'} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title={id ? 'Edit customer' : 'New customer'} back="/customers" />
      <div className="card space-y-4">
        {field('name', 'Name *')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Phone', 'tel')}
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={3} value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
      </div>
      <ErrorText msg={error} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        {id && <button type="button" className="btn-danger" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}

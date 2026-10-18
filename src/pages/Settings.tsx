import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, getSettings, publicUrl, supabase, uploadImage } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getSettings().then(setS).catch(e => setError(e.message)); }, []);
  if (!s) return error ? <ErrorText msg={error} /> : <p className="text-gray-500">Loading...</p>;

  const text = (k: keyof Settings, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={(s[k] as any) ?? ''}
        onChange={e => setS({ ...s, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />
    </div>
  );

  async function uploadLogo(file?: File) {
    if (!file) return;
    try {
      const path = await uploadImage(file);
      setS({ ...s!, logo_url: publicUrl(path) });
    } catch (e: any) { setError(e.message); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setMsg('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('settings').upsert({ ...s, owner: user!.id }, { onConflict: 'owner' });
    setBusy(false);
    if (error) setError(error.message); else setMsg('Saved.');
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title="Settings" />
      <div className="card space-y-3">
        <h2 className="font-semibold">Business</h2>
        {s.logo_url && <img src={s.logo_url} alt="Logo" className="h-20 object-contain" />}
        <label className="btn-secondary cursor-pointer">
          Upload logo
          <input type="file" accept="image/*" className="hidden" onChange={e => uploadLogo(e.target.files?.[0])} />
        </label>
        {text('business_name', 'Business name')}
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={3} value={s.address ?? ''} onChange={e => setS({ ...s, address: e.target.value })} />
        </div>
        {text('email', 'Email', 'email')}
        {text('phone', 'Phone', 'tel')}
        {text('tax_id', 'Tax / GST number')}
      </div>
      <div className="card space-y-3">
        <h2 className="font-semibold">Invoicing</h2>
        <div className="grid grid-cols-2 gap-3">
          {text('currency', 'Currency (ISO)')}
          {text('default_tax_rate', 'Default tax %', 'number')}
          {text('invoice_prefix', 'Invoice prefix')}
          {text('next_number', 'Next number', 'number')}
        </div>
        <div>
          <label className="label">Payment terms (printed on invoice)</label>
          <textarea className="input" rows={3} value={s.payment_terms ?? ''} onChange={e => setS({ ...s, payment_terms: e.target.value })} />
        </div>
      </div>
      <Link to="/settings/templates" className="card flex justify-between items-center">
        <span className="font-semibold">Email templates</span>
        <span className="text-gray-400">&rarr;</span>
      </Link>
      <ErrorText msg={error} />
      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving...' : 'Save settings'}</button>
      <button type="button" className="btn-secondary w-full" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </form>
  );
}

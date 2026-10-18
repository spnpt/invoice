import { FormEvent, useEffect, useState } from 'react';
import { EmailTemplate, PLACEHOLDERS, listTemplates } from '../lib/email';
import { supabase } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

type Draft = Omit<EmailTemplate, 'id'> & { id?: string };
const blank: Draft = { name: '', subject: '', body: '', is_default: false };

export default function EmailTemplates() {
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => listTemplates().then(setItems).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true); setError('');
    try {
      // Only one default template at a time.
      if (edit.is_default) {
        const { error } = await supabase.from('email_templates').update({ is_default: false }).neq('id', edit.id ?? '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }
      const row = { name: edit.name.trim(), subject: edit.subject.trim(), body: edit.body, is_default: edit.is_default };
      const { error } = edit.id
        ? await supabase.from('email_templates').update(row).eq('id', edit.id)
        : await supabase.from('email_templates').insert(row);
      if (error) throw error;
      setEdit(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this template?')) return;
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) return setError(error.message);
    setEdit(null);
    load();
  }

  if (edit) {
    return (
      <form onSubmit={save} className="space-y-4">
        <PageHeader title={edit.id ? 'Edit template' : 'New template'} />
        <div className="card space-y-3">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Subject *</label>
            <input className="input" required maxLength={200} value={edit.subject} onChange={e => setEdit({ ...edit, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">Message *</label>
            <textarea className="input font-mono text-sm" rows={10} required value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={edit.is_default} onChange={e => setEdit({ ...edit, is_default: e.target.checked })} />
            Use by default
          </label>
          <div className="text-xs text-gray-500">
            Placeholders: {PLACEHOLDERS.map(p => <code key={p} className="mr-2">{`{{${p}}}`}</code>)}
          </div>
        </div>
        <ErrorText msg={error} />
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
          <button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button>
          {edit.id && <button type="button" className="btn-danger" onClick={() => remove(edit.id!)}>Delete</button>}
        </div>
      </form>
    );
  }

  return (
    <div>
      <PageHeader title="Email templates" back="/settings"
        action={<button className="btn-primary" onClick={() => setEdit({ ...blank })}>+ New</button>} />
      <ErrorText msg={error} />
      <ul className="space-y-2">
        {items.map(t => (
          <li key={t.id}>
            <button className="card w-full text-left" onClick={() => setEdit(t)}>
              <div className="font-medium">{t.name}{t.is_default && <span className="ml-2 text-xs text-blue-600">default</span>}</div>
              <div className="text-sm text-gray-500 truncate">{t.subject}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

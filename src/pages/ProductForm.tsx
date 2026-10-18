import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteImage, getSettings, publicUrl, supabase, uploadImage } from '../lib/supabase';
import { ErrorText, PageHeader } from '../components/ui';

export default function ProductForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', sku: '', description: '', unit_price: '0', tax_rate: '15', active: true });
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      getSettings().then(s => setF(v => ({ ...v, tax_rate: String(s.default_tax_rate) }))).catch(() => {});
      return;
    }
    supabase.from('products').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) return setError(error.message);
      setF({
        name: data.name, sku: data.sku ?? '', description: data.description ?? '',
        unit_price: String(data.unit_price), tax_rate: String(data.tax_rate), active: data.active,
      });
      setImagePath(data.image_path);
      setPreview(publicUrl(data.image_path));
    });
  }, [id]);

  function pick(file: File | undefined) {
    if (!file) return;
    setNewFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      let path = imagePath;
      if (newFile) path = await uploadImage(newFile);
      const row = {
        name: f.name.trim(), sku: f.sku.trim() || null, description: f.description.trim() || null,
        unit_price: Number(f.unit_price), tax_rate: Number(f.tax_rate), active: f.active, image_path: path,
      };
      const { error } = id
        ? await supabase.from('products').update(row).eq('id', id)
        : await supabase.from('products').insert(row);
      if (error) throw error;
      if (newFile && imagePath && imagePath !== path) await deleteImage(imagePath);
      nav('/products');
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !confirm('Delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return setError(error.message);
    await deleteImage(imagePath);
    nav('/products');
  }

  async function removeImage() {
    setNewFile(null); setPreview(null);
    if (id && imagePath) {
      await supabase.from('products').update({ image_path: null }).eq('id', id);
      await deleteImage(imagePath);
    }
    setImagePath(null);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title={id ? 'Edit product' : 'New product'} back="/products" />
      <div className="card space-y-4">
        <div>
          <label className="label">Image</label>
          {preview && <img src={preview} alt="" className="mb-2 h-48 w-full rounded-lg object-contain bg-gray-100" />}
          <div className="flex gap-2 flex-wrap">
            <label className="btn-secondary cursor-pointer">
              Take photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => pick(e.target.files?.[0])} />
            </label>
            <label className="btn-secondary cursor-pointer">
              Choose file
              <input type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
            </label>
            {preview && <button type="button" className="btn-secondary" onClick={removeImage}>Remove</button>}
          </div>
        </div>
        <div>
          <label className="label">Name *</label>
          <input className="input" required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="label">SKU</label>
          <input className="input" value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Unit price *</label>
            <input className="input" type="number" inputMode="decimal" step="0.01" min="0" required
              value={f.unit_price} onChange={e => setF({ ...f, unit_price: e.target.value })} />
          </div>
          <div>
            <label className="label">Tax %</label>
            <input className="input" type="number" inputMode="decimal" step="0.01" min="0"
              value={f.tax_rate} onChange={e => setF({ ...f, tax_rate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} /> Active
        </label>
      </div>
      <ErrorText msg={error} />
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
        {id && <button type="button" className="btn-danger" onClick={remove}>Delete</button>}
      </div>
    </form>
  );
}

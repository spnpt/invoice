import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const configured = Boolean(url && key);
export const supabase = createClient(url || 'http://localhost', key || 'missing');

export const BUCKET = 'product-images';

export type Product = {
  id: string; name: string; sku: string | null; description: string | null;
  unit_price: number; tax_rate: number; image_path: string | null; active: boolean;
};
export type Customer = {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; notes: string | null;
};
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';
export type Invoice = {
  id: string; number: string; customer_id: string; issue_date: string; due_date: string | null;
  status: InvoiceStatus; notes: string | null; subtotal: number; tax_total: number; total: number;
  customers?: Customer | null;
};
export type InvoiceItem = {
  id?: string; product_id: string | null; description: string;
  qty: number; unit_price: number; tax_rate: number; line_total?: number;
};
export type Settings = {
  owner?: string; business_name: string; address: string | null; email: string | null; phone: string | null;
  tax_id: string | null; logo_url: string | null; currency: string; default_tax_rate: number;
  invoice_prefix: string; next_number: number; payment_terms: string | null; phone_country_code?: string;
};

export function publicUrl(path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Compress and upload an image under the current user's folder; returns storage path. */
export async function uploadImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const small = await imageCompression(file, { maxWidthOrHeight: 1200, maxSizeMB: 0.5, fileType: 'image/jpeg' });
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, small, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function deleteImage(path: string | null | undefined) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').maybeSingle();
  if (error) throw error;
  return data ?? {
    business_name: 'My Business', address: null, email: null, phone: null, tax_id: null, logo_url: null,
    currency: 'NZD', default_tax_rate: 15, invoice_prefix: 'INV-', next_number: 1, payment_terms: null, phone_country_code: '64',
  };
}

export function money(n: number, currency = 'NZD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(n) || 0);
  } catch {
    return (Number(n) || 0).toFixed(2);
  }
}

export function calcTotals(items: InvoiceItem[]) {
  let subtotal = 0, tax = 0;
  for (const it of items) {
    const line = Math.round(it.qty * it.unit_price * 100) / 100;
    subtotal += line;
    tax += Math.round(line * it.tax_rate) / 100;
  }
  return { subtotal, tax, total: subtotal + tax };
}

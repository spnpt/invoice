import { Invoice, Settings, money, supabase } from './supabase';

const LINK_DAYS = 30;

/** Convert a local or international phone number to wa.me digits (country code, no '+' or leading 0). */
export function toWhatsAppNumber(phone: string | null | undefined, countryCode: string): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (trimmed.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  const cc = countryCode.replace(/\D/g, '');
  return digits.startsWith(cc) && digits.length > 9 ? digits : cc + digits;
}

export function whatsAppMessage(inv: Invoice, s: Settings, link?: string) {
  const lines = [
    `Hi ${inv.customers?.name ?? ''},`.trim(),
    '',
    `Invoice ${inv.number} from ${s.business_name} for ${money(inv.total, s.currency)}${inv.due_date ? `, due ${inv.due_date}` : ''}.`,
  ];
  if (link) lines.push('', `Download PDF: ${link}`, `(link valid for ${LINK_DAYS} days)`);
  lines.push('', 'Thank you!');
  return lines.join('\n');
}

/** Upload the PDF to the private bucket and return a time-limited download link. */
export async function pdfLink(inv: Invoice, pdf: Blob): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const path = `${user.id}/${inv.id}.pdf`;
  const up = await supabase.storage.from('invoice-pdfs').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (up.error) throw up.error;
  const { data, error } = await supabase.storage.from('invoice-pdfs')
    .createSignedUrl(path, LINK_DAYS * 24 * 3600, { download: `${inv.number}.pdf` });
  if (error) throw error;
  return data.signedUrl;
}

export function whatsAppUrl(number: string | null, text: string) {
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
}

/** Open a blank tab synchronously in the click handler so popup blockers allow it; navigate it later. */
export function openPendingWindow(): Window | null {
  const w = window.open('', '_blank');
  if (w) w.opener = null;
  return w;
}

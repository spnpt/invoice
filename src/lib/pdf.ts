import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, InvoiceItem, Settings, money } from './supabase';

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise(res => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildInvoicePdf(inv: Invoice, items: InvoiceItem[], s: Settings): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const cur = s.currency;
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  if (s.logo_url) {
    const logo = await toDataUrl(s.logo_url);
    if (logo) { try { doc.addImage(logo, 'JPEG', 40, y - 8, 80, 80, undefined, 'FAST'); } catch { /* ignore bad logo */ } }
  }

  doc.setFontSize(22).setFont('helvetica', 'bold').text('INVOICE', W - 40, y + 10, { align: 'right' });
  doc.setFontSize(10).setFont('helvetica', 'normal');
  doc.text([`No: ${inv.number}`, `Date: ${inv.issue_date}`, inv.due_date ? `Due: ${inv.due_date}` : ''].filter(Boolean),
    W - 40, y + 28, { align: 'right' });

  y += s.logo_url ? 96 : 20;
  doc.setFont('helvetica', 'bold').text(s.business_name, 40, y);
  doc.setFont('helvetica', 'normal');
  const from = [s.address, s.phone, s.email, s.tax_id ? `Tax ID: ${s.tax_id}` : null].filter(Boolean) as string[];
  doc.text(from.flatMap(l => l.split('\n')), 40, y + 14);

  const c = inv.customers;
  doc.setFont('helvetica', 'bold').text('Bill to', W / 2 + 20, y);
  doc.setFont('helvetica', 'normal');
  const to = [c?.name, c?.address, c?.phone, c?.email].filter(Boolean) as string[];
  doc.text(to.flatMap(l => l.split('\n')), W / 2 + 20, y + 14);

  y += 14 + Math.max(from.length, to.length, 1) * 14 + 30;

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit price', 'Tax %', 'Amount']],
    body: items.map(it => [it.description, String(it.qty), money(it.unit_price, cur), String(it.tax_rate),
      money(it.line_total ?? it.qty * it.unit_price, cur)]),
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: 40, right: 40 },
  });

  y = (doc as any).lastAutoTable.finalY + 20;
  const row = (label: string, val: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, W - 180, y); doc.text(val, W - 40, y, { align: 'right' }); y += 16;
  };
  row('Subtotal', money(inv.subtotal, cur));
  row('Tax', money(inv.tax_total, cur));
  doc.setFontSize(12); row('Total', money(inv.total, cur), true); doc.setFontSize(10);

  y += 16;
  doc.setFont('helvetica', 'normal');
  const footer = [inv.notes, s.payment_terms].filter(Boolean).join('\n\n');
  if (footer) doc.text(doc.splitTextToSize(footer, W - 80), 40, y);

  return doc.output('blob');
}

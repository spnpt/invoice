import { Invoice, Settings, money, supabase } from './supabase';

export type EmailTemplate = {
  id: string; name: string; subject: string; body: string; is_default: boolean;
};

export type EmailLog = {
  id: string; to_email: string; cc_email: string | null; subject: string;
  status: 'sent' | 'failed'; error: string | null; created_at: string;
};

export const PLACEHOLDERS = [
  'customer_name', 'invoice_number', 'issue_date', 'due_date', 'total', 'business_name', 'business_email', 'business_phone',
] as const;

const DEFAULT_TEMPLATES = [
  {
    name: 'New invoice', is_default: true,
    subject: 'Invoice {{invoice_number}} from {{business_name}}',
    body: 'Hi {{customer_name}},\n\nPlease find attached invoice {{invoice_number}} for {{total}}, due {{due_date}}.\n\nThank you for your business.\n\n{{business_name}}\n{{business_phone}}',
  },
  {
    name: 'Payment reminder', is_default: false,
    subject: 'Reminder: invoice {{invoice_number}} is due',
    body: 'Hi {{customer_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for {{total}} was due on {{due_date}}. A copy is attached.\n\nIf you have already paid, please ignore this message.\n\nThanks,\n{{business_name}}',
  },
];

let seeding: Promise<EmailTemplate[]> | null = null;

/** Load templates; creates the two starter templates the first time. */
export async function listTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase.from('email_templates').select('*').order('name');
  if (error) throw error;
  if (data.length) return data as EmailTemplate[];
  // Share one in-flight seed so concurrent callers don't insert duplicates.
  seeding ??= (async () => {
    const { data: created, error: e2 } = await supabase.from('email_templates').insert(DEFAULT_TEMPLATES).select('*');
    if (e2) { seeding = null; throw e2; }
    return (created as EmailTemplate[]).sort((a, b) => a.name.localeCompare(b.name));
  })();
  return seeding;
}

export function templateVars(inv: Invoice, s: Settings): Record<string, string> {
  return {
    customer_name: inv.customers?.name ?? '',
    invoice_number: inv.number,
    issue_date: inv.issue_date,
    due_date: inv.due_date ?? '',
    total: money(inv.total, s.currency),
    business_name: s.business_name ?? '',
    business_email: s.email ?? '',
    business_phone: s.phone ?? '',
  };
}

export function render(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function sendInvoiceEmail(args: {
  invoice_id: string; to: string; cc?: string; subject: string; body: string; pdf: Blob; filename: string;
}) {
  const pdf_base64 = await blobToBase64(args.pdf);
  const { pdf, ...rest } = args;
  const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { ...rest, pdf_base64 } });
  if (error) {
    // Surface the function's JSON error message when available.
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as { id: string };
}

/** Ask the edge function whether Gmail credentials are configured. */
export async function emailConfigured(): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { check: true } });
  if (error) return false;
  return Boolean((data as { configured?: boolean })?.configured);
}

/** Successfully sent emails for an invoice (failed attempts stay in the table but are not shown). */
export async function listEmailLog(invoiceId: string): Promise<EmailLog[]> {
  const { data, error } = await supabase.from('email_log').select('*').eq('invoice_id', invoiceId)
    .eq('status', 'sent').order('created_at', { ascending: false });
  if (error) throw error;
  return data as EmailLog[];
}

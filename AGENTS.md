# AGENTS.md

Guide for AI coding assistants (Claude, GPT/Codex, Gemini, Copilot, Cursor, Cortex Code, and others) and for human contributors.
Read this before changing code.

## What this project is
A mobile-first invoicing web app for a single small business:
- Manage **products** (with photos), **customers**, and **invoices**
- Export an invoice as a **PDF**, share it from the phone, or **email** it with the PDF attached
- Manage reusable **email templates** with `{{placeholders}}`

Live site: https://spnpt.github.io/invoice/  -  Repo: https://github.com/spnpt/invoice

## Architecture
```
Phone browser (React SPA on GitHub Pages)
   |-- supabase-js --> Supabase Auth      (email + password, single owner, sign-ups disabled)
   |               --> Supabase Postgres  (all tables protected by row-level security)
   |               --> Supabase Storage   (bucket "product-images", public read, owner-only write)
   '-- functions.invoke --> Edge Function "send-invoice-email" --> Gmail SMTP :465
```
There is **no custom backend server**. GitHub Pages only serves static files. Anything secret
or server-side must go in a Supabase Edge Function or in Postgres (RLS / functions).

## Tech stack
- Vite 5, React 18, TypeScript (strict), react-router-dom 6 with **HashRouter** (needed on GitHub Pages)
- Tailwind CSS 3, using the component classes in `src/index.css` (`.input`, `.label`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`)
- @supabase/supabase-js 2, jsPDF with jspdf-autotable, browser-image-compression, vite-plugin-pwa
- Edge Function: Deno (Supabase runtime), `npm:` imports

## Directory map
| Path | Purpose |
|------|---------|
| `src/main.tsx`, `src/App.tsx` | Entry point, auth gate, routes, bottom tab navigation |
| `src/lib/supabase.ts` | Supabase client, shared **types**, image upload, settings, `money()`, `calcTotals()` |
| `src/lib/pdf.ts` | `buildInvoicePdf()` returns the invoice PDF as a Blob |
| `src/lib/email.ts` | Templates (list, seed, render), `sendInvoiceEmail()`, email log |
| `src/components/ui.tsx` | `PageHeader`, `ErrorText`, `StatusBadge` |
| `src/pages/*` | One screen per file (list and form pairs) |
| `supabase/schema.sql` | Core tables, RLS, `save_invoice()` RPC, storage bucket and policies |
| `supabase/002_email.sql` | `email_templates` and `email_log` tables with RLS |
| `supabase/functions/send-invoice-email/index.ts` | Sends email through Gmail SMTP (nodemailer) as the calling user |
| `.github/workflows/deploy.yml` | Builds and deploys to GitHub Pages on push to `main` |
| `.env.production` | Public Supabase URL and anon key (safe to commit, see Security) |

## Data model (Postgres, schema `public`)
Every table has `owner uuid default auth.uid()` and the RLS rule `owner = auth.uid()`.
- `settings`: one row per owner (business profile, currency, default tax, invoice prefix, next number, payment terms)
- `products`: name, sku, description, unit_price, tax_rate, image_path (storage path), active
- `customers`: name, email, phone, address, notes
- `invoices`: number (unique per owner), customer_id, issue/due date, status `draft|sent|paid|void`, notes, subtotal, tax_total, total
- `invoice_items`: invoice_id (cascade delete), product_id (nullable), position, description, qty, unit_price, tax_rate, line_total
- `email_templates`: name, subject, body, is_default
- `email_log`: invoice_id, to_email, cc_email, subject, status `sent|failed`, provider_id, error

## Rules you must follow
1. **Never weaken security.** Every new table needs `owner` plus RLS with the owner policy. Never use or commit the `service_role` key. Never put secrets in `src/` or `VITE_*` variables, because everything in the frontend is public.
2. **Invoices are saved only through the `save_invoice(inv jsonb, items jsonb)` RPC.** It assigns the invoice number and recalculates totals on the server. Don't insert into `invoices` or `invoice_items` directly from the client.
3. **Invoice lines are snapshots.** Description, price and tax are copied from the product, so later product edits must not change past invoices.
4. **Use HashRouter-style paths** (`/#/invoices/123`). Don't switch to BrowserRouter, because GitHub Pages would return 404 on deep links.
5. **Mobile first.** Use large tap targets, a single column, `inputMode="decimal"` on number fields, and keep the bottom navigation.
6. **Match existing patterns:** one page per file, `useState` and `useEffect` with direct supabase-js calls, errors shown through `<ErrorText>`, and no global state library.
7. **Schema changes** go in a new numbered file `supabase/00N_name.sql` that is safe to run more than once (`if not exists`, `drop policy if exists`). Then update this file.
8. **Storage paths** must start with `<auth.uid()>/`; storage policies depend on it.
9. **Edge Functions** must create the Supabase client with the caller's `Authorization` header so RLS applies, validate all input, and keep provider keys in function secrets.
10. Run `npm run build` (typecheck plus build) before committing. There is no test suite yet.

## Email templates
Placeholders are rendered client-side by `render()` in `src/lib/email.ts`:
`{{customer_name}} {{invoice_number}} {{issue_date}} {{due_date}} {{total}} {{business_name}} {{business_email}} {{business_phone}}`
To add a placeholder, add it to `PLACEHOLDERS` and to `templateVars()`.
The first time templates are loaded, two starters are created ("New invoice" and "Payment reminder").

## Commands
```
npm install
npm run dev        # local dev server (needs .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
npm run build      # tsc typecheck plus production build into dist/
npx supabase functions deploy send-invoice-email --project-ref huqoqgkxwjugzkhkvuwh --use-api
npx supabase secrets set GMAIL_USER=you@gmail.com GMAIL_APP_PASSWORD=... EMAIL_FROM_NAME="My Business" --project-ref huqoqgkxwjugzkhkvuwh
```
Deploying the frontend is a `git push` to `main`; GitHub Actions does the rest.

## Security model (why the anon key is public)
The Supabase anon key ships in the JavaScript bundle of any browser app; it is not a secret.
Data is protected by RLS, by sign-ups being disabled, and by the owner's password. The only secrets are
the `service_role` key (never used here) and the Gmail app password (`GMAIL_APP_PASSWORD`), stored only in Edge Function secrets.
Supabase Edge blocks outbound SMTP ports 25 and 587, so Gmail must use port 465 (implicit TLS).

## Known limitations and ideas
- Single currency per business, and tax is per line (no compound taxes)
- No offline data editing (the PWA caches only the app shell)
- No automated tests; adding Vitest for `calcTotals` and `render` would be a good first step
- Gmail sending is limited to about 500 emails a day. For higher volume, use a provider such as Resend with a custom domain.

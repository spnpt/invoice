# Invoice App

A mobile-friendly invoicing app: products (with images), customers, invoices with PDF export, sharing and email sending with editable templates.
It's a static React app hosted on GitHub Pages, with Supabase handling the database, login, image storage and email sending (Edge Function + Resend).

Live: https://spnpt.github.io/invoice/  -  AI assistants and contributors: read [AGENTS.md](AGENTS.md).

## 1. Supabase setup (one time)
1. Create a free project at https://supabase.com.
2. In **SQL Editor**, paste and run `supabase/schema.sql`, then `supabase/002_email.sql`.
3. **Authentication > Providers > Email**: keep it enabled and turn **off** "Allow new users to sign up".
4. **Authentication > Users > Add user**: create your login (email + password, tick auto-confirm).
5. **Project Settings > API**: copy the Project URL and the `anon` public key.

The anon key is safe to publish. Row-level security only lets the signed-in owner read or write data.

## 2. Run locally
```
copy .env.example .env      # then fill in the two values
npm install
npm run dev
```

## 3. Deploy to GitHub Pages
1. Push this folder to a new GitHub repo, on the `main` branch.
2. Put your Supabase URL and anon key in `.env.production` (they are public by design).
3. Repo **Settings > Pages > Source**: choose **GitHub Actions**.
4. Push again, or run the workflow by hand. The app will be at `https://<user>.github.io/<repo>/`.
5. On your phone, open the URL and use "Add to Home Screen".

## 4. Email sending (Resend)
1. Sign up at https://resend.com and create an API key.
2. To email customers, add and verify your domain in Resend (**Domains**). Without a domain, Resend only delivers to your own Resend account email (fine for testing).
3. Supabase **Edge Functions > Secrets**: add `RESEND_API_KEY` and `EMAIL_FROM` (for example `My Business <invoices@yourdomain.com>`, or `onboarding@resend.dev` while testing).
4. Deploy the function: `npx supabase functions deploy send-invoice-email --project-ref <ref>`, or paste `supabase/functions/send-invoice-email/index.ts` into **Edge Functions > Deploy a new function > Via editor** and name it `send-invoice-email`.
5. In the app: **Settings > Email templates** to edit templates, then on any invoice tap **Send email**. Replies go to the email set in Settings.

## Notes
- Product images are stored in the public `product-images` bucket. Anyone with an image link can view it, but only you can upload or delete.
- Invoice numbers and totals are assigned and recalculated on the server by the `save_invoice` function.

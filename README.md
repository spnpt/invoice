# Invoice App

A mobile-friendly invoicing app: products (with images), customers, invoices with PDF export, sharing and email sending with editable templates.
It's a static React app hosted on GitHub Pages, with Supabase handling the database, login, image storage and email sending (Edge Function + Gmail).

Live: https://spnpt.github.io/invoice/  -  AI assistants and contributors: read [AGENTS.md](AGENTS.md).

## 1. Supabase setup (one time)
1. Create a free project at https://supabase.com.
2. In **SQL Editor**, paste and run `supabase/schema.sql`, then `supabase/002_email.sql`, then `supabase/003_whatsapp.sql`.
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

## 4. Email sending (Gmail)
1. Turn on 2-Step Verification for your Google account, then create an app password at https://myaccount.google.com/apppasswords.
2. Supabase **Edge Functions > Secrets**: add `GMAIL_USER` (your Gmail address), `GMAIL_APP_PASSWORD` (the 16-character app password) and, optionally, `EMAIL_FROM_NAME` (for example `My Business`).
3. Deploy the function: `npx supabase functions deploy send-invoice-email --project-ref <ref> --use-api`.
4. In the app: **Settings > Email templates** to edit templates, then on any invoice tap **Send email**. Replies go to the email set in Settings.

Gmail allows about 500 emails a day.

## Notes
- Product images are stored in the public `product-images` bucket. Anyone with an image link can view it, but only you can upload or delete.
- Invoice numbers and totals are assigned and recalculated on the server by the `save_invoice` function.

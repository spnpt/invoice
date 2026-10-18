# Invoice App

A mobile-friendly invoicing app: products (with images), customers, invoices with PDF export and sharing.
It's a static React app hosted on GitHub Pages, with Supabase handling the database, login and image storage.

## 1. Supabase setup (one time)
1. Create a free project at https://supabase.com.
2. In **SQL Editor**, paste and run `supabase/schema.sql`.
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
2. Repo **Settings > Secrets and variables > Actions**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Repo **Settings > Pages > Source**: choose **GitHub Actions**.
4. Push again, or run the workflow by hand. The app will be at `https://<user>.github.io/<repo>/`.
5. On your phone, open the URL and use "Add to Home Screen".

## Notes
- Product images are stored in the public `product-images` bucket. Anyone with an image link can view it, but only you can upload or delete.
- Invoice numbers and totals are assigned and recalculated on the server by the `save_invoice` function.

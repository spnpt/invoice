-- WhatsApp sharing: private PDF bucket (signed links) and default phone country code.
-- Safe to run more than once. Run after schema.sql and 002_email.sql.

alter table public.settings add column if not exists phone_country_code text not null default '64';

insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', false)
on conflict (id) do nothing;

drop policy if exists "pdfs select" on storage.objects;
drop policy if exists "pdfs insert" on storage.objects;
drop policy if exists "pdfs update" on storage.objects;
drop policy if exists "pdfs delete" on storage.objects;

-- Files live under <user-id>/...; only the owner can read (to sign links) or write.
create policy "pdfs select" on storage.objects for select to authenticated
  using (bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pdfs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pdfs update" on storage.objects for update to authenticated
  using (bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pdfs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'invoice-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Email templates and email log. Safe to run more than once.
-- Run in Supabase Dashboard > SQL Editor after schema.sql.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  invoice_id uuid references public.invoices on delete cascade,
  to_email text not null,
  cc_email text,
  subject text not null,
  status text not null check (status in ('sent','failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists email_log_invoice_idx on public.email_log(invoice_id);

alter table public.email_templates enable row level security;
alter table public.email_log enable row level security;

drop policy if exists owner_all on public.email_templates;
create policy owner_all on public.email_templates for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Log rows are written by the edge function on behalf of the user; read-only otherwise.
drop policy if exists owner_read on public.email_log;
drop policy if exists owner_insert on public.email_log;
create policy owner_read on public.email_log for select to authenticated using (owner = auth.uid());
create policy owner_insert on public.email_log for insert to authenticated with check (owner = auth.uid());

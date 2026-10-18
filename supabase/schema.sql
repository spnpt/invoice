-- Invoice App schema for Supabase.
-- Run once in Supabase Dashboard > SQL Editor.

-- ---------- Tables ----------
create table if not exists public.settings (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  business_name text not null default 'My Business',
  address text,
  email text,
  phone text,
  tax_id text,
  logo_url text,
  currency text not null default 'NZD',
  default_tax_rate numeric(5,2) not null default 15,
  invoice_prefix text not null default 'INV-',
  next_number integer not null default 1,
  payment_terms text default 'Payment due within 14 days.'
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  sku text,
  description text,
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 15 check (tax_rate >= 0),
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  number text not null,
  customer_id uuid references public.customers on delete restrict,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  notes text,
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (owner, number)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  invoice_id uuid not null references public.invoices on delete cascade,
  product_id uuid references public.products on delete set null,
  position integer not null default 0,
  description text not null,
  qty numeric(12,3) not null default 1 check (qty > 0),
  unit_price numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null default 0
);

create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index if not exists invoices_customer_idx on public.invoices(customer_id);

-- ---------- Row Level Security ----------
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','products','customers','invoices','invoice_items'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

-- ---------- Save invoice atomically (header + lines + numbering) ----------
create or replace function public.save_invoice(inv jsonb, items jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid := nullif(inv->>'id','')::uuid;
  v_number text;
  v_sub numeric := 0;
  v_tax numeric := 0;
  it jsonb;
  i int := 0;
  line numeric;
begin
  -- Recalculate totals server-side so stored values are trustworthy.
  for it in select * from jsonb_array_elements(items) loop
    line := round((it->>'qty')::numeric * (it->>'unit_price')::numeric, 2);
    v_sub := v_sub + line;
    v_tax := v_tax + round(line * (it->>'tax_rate')::numeric / 100, 2);
  end loop;

  if v_id is null then
    insert into public.settings (owner) values (auth.uid()) on conflict (owner) do nothing;
    update public.settings set next_number = next_number + 1
      where owner = auth.uid()
      returning invoice_prefix || lpad((next_number - 1)::text, 4, '0') into v_number;

    insert into public.invoices (number, customer_id, issue_date, due_date, status, notes, subtotal, tax_total, total)
    values (v_number, (inv->>'customer_id')::uuid, (inv->>'issue_date')::date, nullif(inv->>'due_date','')::date,
            coalesce(inv->>'status','draft'), inv->>'notes', v_sub, v_tax, v_sub + v_tax)
    returning id into v_id;
  else
    update public.invoices set
      customer_id = (inv->>'customer_id')::uuid,
      issue_date = (inv->>'issue_date')::date,
      due_date = nullif(inv->>'due_date','')::date,
      status = coalesce(inv->>'status', status),
      notes = inv->>'notes',
      subtotal = v_sub, tax_total = v_tax, total = v_sub + v_tax
    where id = v_id and owner = auth.uid();
    if not found then raise exception 'Invoice not found'; end if;
    delete from public.invoice_items where invoice_id = v_id;
  end if;

  for it in select * from jsonb_array_elements(items) loop
    i := i + 1;
    line := round((it->>'qty')::numeric * (it->>'unit_price')::numeric, 2);
    insert into public.invoice_items (invoice_id, product_id, position, description, qty, unit_price, tax_rate, line_total)
    values (v_id, nullif(it->>'product_id','')::uuid, i, it->>'description', (it->>'qty')::numeric,
            (it->>'unit_price')::numeric, (it->>'tax_rate')::numeric, line);
  end loop;

  return v_id;
end $$;

revoke all on function public.save_invoice(jsonb, jsonb) from public, anon;
grant execute on function public.save_invoice(jsonb, jsonb) to authenticated;

-- ---------- Storage bucket for product images and logo ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "images insert" on storage.objects;
drop policy if exists "images update" on storage.objects;
drop policy if exists "images delete" on storage.objects;

-- Files are stored under <user-id>/..., only the owner may write.
create policy "images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

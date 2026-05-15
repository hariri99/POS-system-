create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'employee');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'mixed');
create type public.payment_status as enum ('paid', 'pending', 'refunded', 'void');
create type public.sale_status as enum ('draft', 'completed', 'cancelled');
create type public.stock_movement_type as enum ('restock', 'sale', 'adjustment', 'return', 'void');
create type public.alert_severity as enum ('info', 'warning', 'critical');

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address text,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'employee',
  phone text,
  status text not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text not null,
  phone text not null,
  email text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  brand_id uuid not null references public.brands(id),
  supplier_id uuid references public.suppliers(id),
  name text not null,
  description text not null default '',
  flavor text not null default '',
  size_label text not null default '',
  sku text not null,
  barcode text not null,
  sale_price numeric(10,2) not null check (sale_price >= 0),
  cost_price numeric(10,2) not null check (cost_price >= 0),
  expiry_date date,
  image_url text,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (branch_id, sku),
  unique (branch_id, barcode)
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  reorder_point integer not null default 0 check (reorder_point >= 0),
  last_restocked_at timestamptz,
  last_counted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (branch_id, product_id)
);

create sequence if not exists public.invoice_number_seq start 1;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  invoice_number text not null unique,
  employee_id uuid not null references public.profiles(id),
  status public.sale_status not null default 'draft',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'paid',
  subtotal numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  customer_name text,
  notes text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  sku_snapshot text not null,
  barcode_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  total_line_amount numeric(10,2) not null check (total_line_amount >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  sale_id uuid references public.sales(id) on delete set null,
  movement_type public.stock_movement_type not null,
  quantity_delta integer not null,
  previous_quantity integer not null,
  new_quantity integer not null check (new_quantity >= 0),
  note text not null default '',
  performed_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  severity public.alert_severity not null default 'info',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  logged_in_at timestamptz not null default timezone('utc', now()),
  source text not null default 'web'
);

create index if not exists idx_products_branch on public.products(branch_id);
create index if not exists idx_products_supplier on public.products(supplier_id);
create index if not exists idx_inventory_branch on public.inventory(branch_id);
create index if not exists idx_sales_branch_created on public.sales(branch_id, created_at desc);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_stock_movements_branch_created on public.stock_movements(branch_id, created_at desc);
create index if not exists idx_alerts_branch_created on public.alerts(branch_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_branch_id()
returns uuid
language sql
stable
as $$
  select branch_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
as $$
  select public.is_admin() or public.current_branch_id() = target_branch_id
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_branch uuid;
begin
  select id into default_branch from public.branches order by created_at asc limit 1;

  insert into public.profiles (
    id,
    branch_id,
    email,
    full_name,
    role
  )
  values (
    new.id,
    default_branch,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'employee')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.generate_invoice_number()
returns text
language sql
as $$
  select 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')
$$;

create or replace function public.raise_low_stock_alert(
  p_branch_id uuid,
  p_product_id uuid,
  p_current_quantity integer,
  p_reorder_point integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product_label text;
begin
  if p_current_quantity > p_reorder_point then
    return;
  end if;

  select name || case when flavor <> '' then ' · ' || flavor else '' end
  into product_label
  from public.products
  where id = p_product_id;

  insert into public.alerts (
    branch_id,
    product_id,
    severity,
    title,
    message
  )
  values (
    p_branch_id,
    p_product_id,
    case when p_current_quantity = 0 then 'critical' else 'warning' end,
    case when p_current_quantity = 0 then 'Out of stock' else 'Low stock threshold reached' end,
    product_label || ' now has ' || p_current_quantity || ' units remaining.'
  );
end;
$$;

create or replace function public.process_sale(
  p_branch_id uuid,
  p_employee_id uuid,
  p_items jsonb,
  p_discount_amount numeric default 0,
  p_payment_method public.payment_method default 'cash',
  p_notes text default null,
  p_customer_name text default null
)
returns table (
  id uuid,
  branch_id uuid,
  invoice_number text,
  employee_id uuid,
  employee_name text,
  status public.sale_status,
  payment_method public.payment_method,
  payment_status public.payment_status,
  subtotal numeric,
  discount_amount numeric,
  tax_amount numeric,
  total_amount numeric,
  customer_name text,
  notes text,
  created_at timestamptz,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid := gen_random_uuid();
  v_invoice_number text := public.generate_invoice_number();
  v_subtotal numeric := 0;
  v_line_discounts numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_product record;
  v_previous_quantity integer;
  v_new_quantity integer;
  v_quantity integer;
  v_unit_price numeric;
  v_discount numeric;
  v_line_total numeric;
begin
  if public.current_user_role() not in ('admin', 'employee') then
    raise exception 'Only authenticated staff can create sales.';
  end if;

  if auth.uid() is distinct from p_employee_id and not public.is_admin() then
    raise exception 'Employees can only submit their own sales.';
  end if;

  insert into public.sales (
    id,
    branch_id,
    invoice_number,
    employee_id,
    status,
    payment_method,
    payment_status,
    customer_name,
    notes
  )
  values (
    v_sale_id,
    p_branch_id,
    v_invoice_number,
    p_employee_id,
    'draft',
    p_payment_method,
    'paid',
    p_customer_name,
    coalesce(p_notes, '')
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1);

    select
      p.id,
      p.name,
      p.flavor,
      p.sku,
      p.barcode,
      p.sale_price,
      i.quantity_on_hand,
      i.reorder_point
    into v_product
    from public.products p
    join public.inventory i on i.product_id = p.id and i.branch_id = p_branch_id
    where p.id = (v_item ->> 'product_id')::uuid
      and p.branch_id = p_branch_id
      and p.is_active = true
    for update of i;

    if not found then
      raise exception 'Product is missing or inactive.';
    end if;

    if v_product.quantity_on_hand < v_quantity then
      raise exception 'Insufficient stock for %.', v_product.name;
    end if;

    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, v_product.sale_price);
    v_discount := coalesce((v_item ->> 'discount_amount')::numeric, 0);
    v_line_total := v_unit_price * v_quantity - v_discount;
    v_previous_quantity := v_product.quantity_on_hand;
    v_new_quantity := v_previous_quantity - v_quantity;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name_snapshot,
      sku_snapshot,
      barcode_snapshot,
      quantity,
      unit_price,
      discount_amount,
      total_line_amount
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name || case when v_product.flavor <> '' then ' · ' || v_product.flavor else '' end,
      v_product.sku,
      v_product.barcode,
      v_quantity,
      v_unit_price,
      v_discount,
      v_line_total
    );

    update public.inventory
    set quantity_on_hand = v_new_quantity
    where branch_id = p_branch_id
      and product_id = v_product.id;

    insert into public.stock_movements (
      branch_id,
      product_id,
      sale_id,
      movement_type,
      quantity_delta,
      previous_quantity,
      new_quantity,
      note,
      performed_by
    )
    values (
      p_branch_id,
      v_product.id,
      v_sale_id,
      'sale',
      -v_quantity,
      v_previous_quantity,
      v_new_quantity,
      'Sale ' || v_invoice_number,
      p_employee_id
    );

    perform public.raise_low_stock_alert(
      p_branch_id,
      v_product.id,
      v_new_quantity,
      v_product.reorder_point
    );

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
    v_line_discounts := v_line_discounts + v_discount;
  end loop;

  v_total := greatest(0, v_subtotal - v_line_discounts - coalesce(p_discount_amount, 0));

  update public.sales
  set
    status = 'completed',
    subtotal = v_subtotal,
    discount_amount = v_line_discounts + coalesce(p_discount_amount, 0),
    total_amount = v_total,
    updated_at = timezone('utc', now())
  where id = v_sale_id;

  insert into public.audit_logs (
    branch_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    payload
  )
  values (
    p_branch_id,
    p_employee_id,
    'sale',
    v_sale_id,
    'created',
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'item_count', jsonb_array_length(p_items),
      'subtotal', v_subtotal,
      'total_amount', v_total
    )
  );

  return query
  select
    s.id,
    s.branch_id,
    s.invoice_number,
    s.employee_id,
    pr.full_name as employee_name,
    s.status,
    s.payment_method,
    s.payment_status,
    s.subtotal,
    s.discount_amount,
    s.tax_amount,
    s.total_amount,
    s.customer_name,
    s.notes,
    s.created_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', si.id,
            'productId', si.product_id,
            'productName', si.product_name_snapshot,
            'sku', si.sku_snapshot,
            'barcode', si.barcode_snapshot,
            'quantity', si.quantity,
            'unitPrice', si.unit_price,
            'discountAmount', si.discount_amount,
            'lineTotal', si.total_line_amount
          )
        )
        from public.sale_items si
        where si.sale_id = s.id
      ),
      '[]'::jsonb
    ) as items
  from public.sales s
  join public.profiles pr on pr.id = s.employee_id
  where s.id = v_sale_id;
end;
$$;

create or replace function public.adjust_inventory(
  p_branch_id uuid,
  p_product_id uuid,
  p_quantity_delta integer,
  p_note text,
  p_actor_id uuid,
  p_supplier_id uuid default null
)
returns table (
  id uuid,
  branch_id uuid,
  product_id uuid,
  product_name text,
  movement_type public.stock_movement_type,
  quantity_delta integer,
  previous_quantity integer,
  new_quantity integer,
  note text,
  performed_by uuid,
  performed_by_name text,
  supplier_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory record;
  v_movement_id uuid := gen_random_uuid();
  v_new_quantity integer;
  v_movement_type public.stock_movement_type;
begin
  if not public.is_admin() then
    raise exception 'Only admins can adjust inventory.';
  end if;

  select i.quantity_on_hand, i.reorder_point
  into v_inventory
  from public.inventory i
  where i.branch_id = p_branch_id and i.product_id = p_product_id
  for update;

  if not found then
    raise exception 'Inventory row not found.';
  end if;

  v_new_quantity := v_inventory.quantity_on_hand + p_quantity_delta;
  if v_new_quantity < 0 then
    raise exception 'Adjustment would result in negative stock.';
  end if;

  v_movement_type := case when p_quantity_delta >= 0 then 'restock' else 'adjustment' end;

  update public.inventory
  set
    quantity_on_hand = v_new_quantity,
    last_restocked_at = case when p_quantity_delta > 0 then timezone('utc', now()) else last_restocked_at end,
    updated_at = timezone('utc', now())
  where branch_id = p_branch_id
    and product_id = p_product_id;

  insert into public.stock_movements (
    id,
    branch_id,
    product_id,
    supplier_id,
    movement_type,
    quantity_delta,
    previous_quantity,
    new_quantity,
    note,
    performed_by
  )
  values (
    v_movement_id,
    p_branch_id,
    p_product_id,
    p_supplier_id,
    v_movement_type,
    p_quantity_delta,
    v_inventory.quantity_on_hand,
    v_new_quantity,
    coalesce(p_note, ''),
    p_actor_id
  );

  perform public.raise_low_stock_alert(
    p_branch_id,
    p_product_id,
    v_new_quantity,
    v_inventory.reorder_point
  );

  insert into public.audit_logs (
    branch_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    payload
  )
  values (
    p_branch_id,
    p_actor_id,
    'inventory',
    p_product_id,
    'adjusted',
    jsonb_build_object(
      'quantity_delta', p_quantity_delta,
      'new_quantity', v_new_quantity,
      'note', p_note
    )
  );

  return query
  select
    sm.id,
    sm.branch_id,
    sm.product_id,
    p.name || case when p.flavor <> '' then ' · ' || p.flavor else '' end as product_name,
    sm.movement_type,
    sm.quantity_delta,
    sm.previous_quantity,
    sm.new_quantity,
    sm.note,
    sm.performed_by,
    coalesce(pr.full_name, 'System') as performed_by_name,
    sm.supplier_id,
    sm.created_at
  from public.stock_movements sm
  join public.products p on p.id = sm.product_id
  left join public.profiles pr on pr.id = sm.performed_by
  where sm.id = v_movement_id;
end;
$$;

create or replace function public.record_login_event(
  p_profile_id uuid,
  p_source text default 'web'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_events (profile_id, branch_id, source)
  select id, branch_id, coalesce(p_source, 'web')
  from public.profiles
  where id = p_profile_id;

  update public.profiles
  set last_login_at = timezone('utc', now())
  where id = p_profile_id;
end;
$$;

create or replace view public.product_catalog_view as
select
  p.id,
  p.branch_id,
  p.name,
  p.description,
  p.category_id,
  c.name as category_name,
  p.brand_id,
  b.name as brand_name,
  p.supplier_id,
  s.name as supplier_name,
  p.flavor,
  p.size_label,
  p.sku,
  p.barcode,
  p.sale_price,
  p.cost_price,
  i.quantity_on_hand as stock_quantity,
  i.reorder_point,
  p.expiry_date,
  p.image_url,
  p.is_active,
  p.archived_at,
  p.updated_at,
  i.last_restocked_at
from public.products p
join public.categories c on c.id = p.category_id
join public.brands b on b.id = p.brand_id
left join public.suppliers s on s.id = p.supplier_id
join public.inventory i on i.product_id = p.id and i.branch_id = p.branch_id;

create or replace view public.sales_overview_view as
select
  s.id,
  s.branch_id,
  s.invoice_number,
  s.employee_id,
  p.full_name as employee_name,
  s.status,
  s.payment_method,
  s.payment_status,
  s.subtotal,
  s.discount_amount,
  s.tax_amount,
  s.total_amount,
  s.customer_name,
  s.notes,
  s.created_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', si.id,
        'productId', si.product_id,
        'productName', si.product_name_snapshot,
        'sku', si.sku_snapshot,
        'barcode', si.barcode_snapshot,
        'quantity', si.quantity,
        'unitPrice', si.unit_price,
        'discountAmount', si.discount_amount,
        'lineTotal', si.total_line_amount
      )
    ) filter (where si.id is not null),
    '[]'::jsonb
  ) as items
from public.sales s
join public.profiles p on p.id = s.employee_id
left join public.sale_items si on si.sale_id = s.id
group by s.id, p.full_name;

create or replace view public.stock_movements_view as
select
  sm.id,
  sm.branch_id,
  sm.product_id,
  p.name || case when p.flavor <> '' then ' · ' || p.flavor else '' end as product_name,
  sm.movement_type,
  sm.quantity_delta,
  sm.previous_quantity,
  sm.new_quantity,
  sm.note,
  sm.performed_by,
  coalesce(pr.full_name, 'System') as performed_by_name,
  sm.supplier_id,
  sm.created_at
from public.stock_movements sm
join public.products p on p.id = sm.product_id
left join public.profiles pr on pr.id = sm.performed_by;

create or replace view public.alerts_view as
select
  a.id,
  a.branch_id,
  a.product_id,
  p.name || case when p.flavor <> '' then ' · ' || p.flavor else '' end as product_name,
  a.severity,
  a.title,
  a.message,
  a.is_read,
  a.created_at
from public.alerts a
left join public.products p on p.id = a.product_id;

create or replace view public.employee_performance_view as
select
  pr.id,
  pr.branch_id,
  b.name as branch_name,
  pr.full_name,
  pr.email,
  pr.role,
  pr.phone,
  pr.status,
  pr.last_login_at,
  coalesce(sum(si.quantity), 0) as total_sales,
  coalesce(sum(s.total_amount), 0) as total_revenue,
  coalesce(count(distinct s.id), 0) as transaction_count
from public.profiles pr
left join public.branches b on b.id = pr.branch_id
left join public.sales s on s.employee_id = pr.id and s.status = 'completed'
left join public.sale_items si on si.sale_id = s.id
group by pr.id, b.name;

create or replace view public.supplier_overview_view as
select
  s.id,
  s.name,
  s.contact_name,
  s.phone,
  s.email,
  s.notes,
  coalesce(count(distinct p.id), 0) as active_products,
  coalesce(count(distinct sm.id), 0) as restock_count
from public.suppliers s
left join public.products p on p.supplier_id = s.id and p.is_active = true
left join public.stock_movements sm on sm.supplier_id = s.id and sm.movement_type = 'restock'
group by s.id;

create or replace view public.sales_daily_view as
select
  branch_id,
  date_trunc('day', created_at) as day,
  count(*) as transactions,
  coalesce(sum(total_amount), 0) as revenue
from public.sales
where status = 'completed'
group by branch_id, date_trunc('day', created_at);

create trigger branches_set_updated_at
before update on public.branches
for each row execute procedure public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute procedure public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

create trigger inventory_set_updated_at
before update on public.inventory
for each row execute procedure public.set_updated_at();

create trigger sales_set_updated_at
before update on public.sales
for each row execute procedure public.set_updated_at();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.login_events enable row level security;

create policy "Authenticated users can view branches"
on public.branches for select
to authenticated
using (true);

create policy "Admins manage branches"
on public.branches for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can view profiles"
on public.profiles for select
to authenticated
using (true);

create policy "Users update own profile or admins"
on public.profiles for update
to authenticated
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "Authenticated users can view categories"
on public.categories for select
to authenticated
using (true);

create policy "Admins manage categories"
on public.categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can view brands"
on public.brands for select
to authenticated
using (true);

create policy "Admins manage brands"
on public.brands for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can view suppliers"
on public.suppliers for select
to authenticated
using (true);

create policy "Admins manage suppliers"
on public.suppliers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Staff can view products in branch"
on public.products for select
to authenticated
using (public.can_access_branch(branch_id));

create policy "Admins manage products"
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Staff can view inventory in branch"
on public.inventory for select
to authenticated
using (public.can_access_branch(branch_id));

create policy "Admins manage inventory"
on public.inventory for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Staff can view sales in branch"
on public.sales for select
to authenticated
using (public.can_access_branch(branch_id));

create policy "Staff can view sale items in their branch"
on public.sale_items for select
to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and public.can_access_branch(s.branch_id)
  )
);

create policy "Staff can view stock movements in branch"
on public.stock_movements for select
to authenticated
using (public.can_access_branch(branch_id));

create policy "Staff can view alerts in branch"
on public.alerts for select
to authenticated
using (public.can_access_branch(branch_id));

create policy "Admins manage alerts"
on public.alerts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins review audit logs"
on public.audit_logs for select
to authenticated
using (public.is_admin());

create policy "Admins insert audit logs"
on public.audit_logs for insert
to authenticated
with check (public.is_admin());

create policy "Admins view login events"
on public.login_events for select
to authenticated
using (public.is_admin());

create policy "Users insert own login events or admins"
on public.login_events for insert
to authenticated
with check (auth.uid() = profile_id or public.is_admin());

grant execute on function public.process_sale(uuid, uuid, jsonb, numeric, public.payment_method, text, text) to authenticated;
grant execute on function public.adjust_inventory(uuid, uuid, integer, text, uuid, uuid) to authenticated;
grant execute on function public.record_login_event(uuid, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Authenticated users can view product images"
on storage.objects for select
to authenticated
using (bucket_id = 'product-images');

create policy "Admins upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.current_user_role() = 'admin');

create policy "Admins update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.current_user_role() = 'admin')
with check (bucket_id = 'product-images' and public.current_user_role() = 'admin');

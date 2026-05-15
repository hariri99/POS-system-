do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'product_pricing_tier'
  ) then
    create type public.product_pricing_tier as enum ('retail', 'wholesale', 'discount');
  end if;

  if not exists (
    select 1 from pg_type where typname = 'expense_category'
  ) then
    create type public.expense_category as enum (
      'rent',
      'salary',
      'electricity',
      'delivery',
      'imports',
      'customs',
      'packaging',
      'marketing',
      'maintenance',
      'other'
    );
  end if;
end
$$;

alter table public.products
  add column if not exists wholesale_price numeric(10,2) not null default 0 check (wholesale_price >= 0),
  add column if not exists discount_price numeric(10,2) check (discount_price >= 0);

update public.products
set wholesale_price = sale_price
where wholesale_price = 0;

alter table public.sale_items
  add column if not exists pricing_tier public.product_pricing_tier not null default 'retail',
  add column if not exists unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  add column if not exists profit_amount numeric(10,2) not null default 0;

update public.sale_items si
set
  unit_cost = coalesce(p.cost_price, 0),
  profit_amount = si.total_line_amount - coalesce(p.cost_price, 0) * si.quantity
from public.products p
where p.id = si.product_id;

create table if not exists public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category public.expense_category not null,
  label text not null,
  amount numeric(10,2) not null check (amount >= 0),
  notes text not null default '',
  incurred_on date not null,
  recurring boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_operating_expenses_branch_incurred
  on public.operating_expenses(branch_id, incurred_on desc);

drop trigger if exists operating_expenses_set_updated_at on public.operating_expenses;
create trigger operating_expenses_set_updated_at
before update on public.operating_expenses
for each row execute procedure public.set_updated_at();

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
  v_unit_cost numeric;
  v_line_profit numeric;
  v_pricing_tier public.product_pricing_tier;
  v_requested_product_id uuid;
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
    v_requested_product_id := coalesce(
      nullif(v_item ->> 'product_id', '')::uuid,
      nullif(v_item ->> 'productId', '')::uuid
    );

    v_quantity := greatest(coalesce((v_item ->> 'quantity')::integer, 1), 1);
    v_pricing_tier := coalesce(
      nullif(v_item ->> 'pricing_tier', '')::public.product_pricing_tier,
      nullif(v_item ->> 'pricingTier', '')::public.product_pricing_tier,
      'retail'::public.product_pricing_tier
    );

    select
      p.id,
      p.name,
      p.flavor,
      p.sku,
      p.barcode,
      p.sale_price,
      p.wholesale_price,
      p.discount_price,
      p.cost_price,
      i.quantity_on_hand,
      i.reorder_point
    into v_product
    from public.products p
    join public.inventory i on i.product_id = p.id and i.branch_id = p_branch_id
    where p.id = v_requested_product_id
      and p.branch_id = p_branch_id
      and p.is_active = true
    for update of i;

    if not found then
      raise exception 'Product is missing or inactive.';
    end if;

    if v_product.quantity_on_hand < v_quantity then
      raise exception 'Insufficient stock for %.', v_product.name;
    end if;

    v_unit_price := coalesce(
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'unitPrice')::numeric,
      case
        when v_pricing_tier = 'wholesale' then v_product.wholesale_price
        when v_pricing_tier = 'discount' then coalesce(v_product.discount_price, v_product.sale_price)
        else v_product.sale_price
      end
    );
    v_discount := coalesce(
      (v_item ->> 'discount_amount')::numeric,
      (v_item ->> 'discountAmount')::numeric,
      0
    );
    v_unit_cost := coalesce(v_product.cost_price, 0);
    v_line_total := v_unit_price * v_quantity - v_discount;
    v_line_profit := v_line_total - v_unit_cost * v_quantity;
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
      pricing_tier,
      unit_cost,
      discount_amount,
      total_line_amount,
      profit_amount
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name || case when v_product.flavor <> '' then ' · ' || v_product.flavor else '' end,
      v_product.sku,
      v_product.barcode,
      v_quantity,
      v_unit_price,
      v_pricing_tier,
      v_unit_cost,
      v_discount,
      v_line_total,
      v_line_profit
    );

    update public.inventory
    set
      quantity_on_hand = v_new_quantity,
      updated_at = timezone('utc', now())
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

  v_total := greatest(v_subtotal - v_line_discounts - coalesce(p_discount_amount, 0), 0);

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
    'completed',
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'subtotal', v_subtotal,
      'discount_amount', v_line_discounts + coalesce(p_discount_amount, 0),
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
            'pricingTier', si.pricing_tier,
            'unitCost', si.unit_cost,
            'discountAmount', si.discount_amount,
            'lineTotal', si.total_line_amount,
            'lineProfit', si.profit_amount
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
  p.wholesale_price,
  p.discount_price,
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
        'pricingTier', si.pricing_tier,
        'unitCost', si.unit_cost,
        'discountAmount', si.discount_amount,
        'lineTotal', si.total_line_amount,
        'lineProfit', si.profit_amount
      )
    ) filter (where si.id is not null),
    '[]'::jsonb
  ) as items
from public.sales s
join public.profiles p on p.id = s.employee_id
left join public.sale_items si on si.sale_id = s.id
group by s.id, p.full_name;

alter table public.operating_expenses enable row level security;

drop policy if exists "Staff can view operating expenses in branch" on public.operating_expenses;
create policy "Staff can view operating expenses in branch"
on public.operating_expenses for select
to authenticated
using (public.can_access_branch(branch_id));

drop policy if exists "Admins manage operating expenses" on public.operating_expenses;
create policy "Admins manage operating expenses"
on public.operating_expenses for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

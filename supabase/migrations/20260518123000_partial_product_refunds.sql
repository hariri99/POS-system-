do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'payment_status'
      and e.enumlabel = 'partially_refunded'
  ) then
    alter type public.payment_status add value 'partially_refunded' after 'pending';
  end if;
end
$$;

alter table public.sales
  add column if not exists refunded_amount numeric(10,2) not null default 0,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text;

alter table public.sale_items
  add column if not exists refunded_quantity integer not null default 0,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_refunded_amount_nonnegative'
  ) then
    alter table public.sales
      add constraint sales_refunded_amount_nonnegative
      check (refunded_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'sale_items_refunded_quantity_valid'
  ) then
    alter table public.sale_items
      add constraint sale_items_refunded_quantity_valid
      check (refunded_quantity >= 0 and refunded_quantity <= quantity);
  end if;
end
$$;

update public.sales
set refunded_amount = total_amount
where payment_status = 'refunded'
  and coalesce(refunded_amount, 0) = 0;

update public.sale_items as si
set
  refunded_quantity = si.quantity,
  refunded_at = coalesce(si.refunded_at, s.refunded_at, s.updated_at, s.created_at),
  refund_reason = coalesce(si.refund_reason, s.refund_reason)
from public.sales as s
where s.id = si.sale_id
  and s.payment_status = 'refunded'
  and coalesce(si.refunded_quantity, 0) < si.quantity;

drop function if exists public.refund_sale(uuid, uuid, text);

create or replace function public.refund_sale(
  p_branch_id uuid,
  p_sale_id uuid,
  p_scope text default 'order',
  p_sale_item_id uuid default null,
  p_refund_reason text default null
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
  paid_at timestamptz,
  refunded_amount numeric,
  refunded_at timestamptz,
  refund_reason text,
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_item record;
  v_inventory record;
  v_refund_at timestamptz := timezone('utc', now());
  v_trimmed_reason text := nullif(btrim(coalesce(p_refund_reason, '')), '');
  v_scope text := coalesce(nullif(btrim(coalesce(p_scope, '')), ''), 'order');
  v_quantity_to_restore integer;
  v_refund_total numeric := 0;
  v_refund_item_count integer := 0;
  v_has_remaining boolean := false;
  v_refund_item_ids uuid[] := '{}'::uuid[];
begin
  if not public.is_admin() then
    raise exception 'Only admins can refund sales.';
  end if;

  if v_scope not in ('order', 'item') then
    raise exception 'Refund scope must be order or item.';
  end if;

  if v_scope = 'item' and p_sale_item_id is null then
    raise exception 'A sale item must be provided for item refunds.';
  end if;

  select
    s.id,
    s.branch_id,
    s.invoice_number,
    s.status,
    s.payment_status,
    s.total_amount,
    coalesce(s.refunded_amount, 0) as refunded_amount
  into v_sale
  from public.sales as s
  where s.id = p_sale_id
    and s.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'Sale not found.';
  end if;

  if v_sale.status <> 'completed'
     or v_sale.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'Only paid or partially refunded completed orders can be refunded.';
  end if;

  for v_item in
    select
      si.id,
      si.product_id,
      si.quantity,
      coalesce(si.refunded_quantity, 0) as refunded_quantity,
      si.total_line_amount
    from public.sale_items as si
    where si.sale_id = p_sale_id
      and (v_scope <> 'item' or si.id = p_sale_item_id)
      and coalesce(si.refunded_quantity, 0) < si.quantity
    for update
  loop
    v_quantity_to_restore := greatest(v_item.quantity - v_item.refunded_quantity, 0);
    if v_quantity_to_restore <= 0 then
      continue;
    end if;

    select
      i.id,
      i.quantity_on_hand
    into v_inventory
    from public.inventory as i
    where i.branch_id = p_branch_id
      and i.product_id = v_item.product_id
    for update;

    if not found then
      raise exception 'Inventory row not found for refunded product.';
    end if;

    update public.inventory
    set
      quantity_on_hand = v_inventory.quantity_on_hand + v_quantity_to_restore,
      updated_at = v_refund_at
    where id = v_inventory.id;

    update public.sale_items
    set
      refunded_quantity = quantity,
      refunded_at = v_refund_at,
      refund_reason = v_trimmed_reason
    where id = v_item.id;

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
      v_item.product_id,
      p_sale_id,
      'return',
      v_quantity_to_restore,
      v_inventory.quantity_on_hand,
      v_inventory.quantity_on_hand + v_quantity_to_restore,
      case
        when v_trimmed_reason is null then 'Refunded sale ' || v_sale.invoice_number
        else 'Refunded sale ' || v_sale.invoice_number || ': ' || v_trimmed_reason
      end,
      auth.uid()
    );

    v_refund_total :=
      v_refund_total
      + case
          when v_item.quantity <= 0 then 0
          else v_item.total_line_amount * v_quantity_to_restore / v_item.quantity
        end;
    v_refund_item_count := v_refund_item_count + 1;
    v_refund_item_ids := array_append(v_refund_item_ids, v_item.id);
  end loop;

  if v_refund_item_count = 0 then
    if v_scope = 'item' then
      raise exception 'The selected product line is not refundable.';
    end if;

    raise exception 'This order has no refundable products remaining.';
  end if;

  select exists (
    select 1
    from public.sale_items
    where sale_id = p_sale_id
      and coalesce(refunded_quantity, 0) < quantity
  )
  into v_has_remaining;

  update public.sales
  set
    payment_status = case when v_has_remaining then 'partially_refunded' else 'refunded' end,
    refunded_amount = least(total_amount, coalesce(refunded_amount, 0) + v_refund_total),
    refunded_at = v_refund_at,
    refund_reason = coalesce(v_trimmed_reason, refund_reason),
    updated_at = v_refund_at
  where id = p_sale_id
    and branch_id = p_branch_id;

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
    auth.uid(),
    'sale',
    p_sale_id,
    'refunded',
    jsonb_build_object(
      'invoice_number', v_sale.invoice_number,
      'scope', v_scope,
      'sale_item_id', p_sale_item_id,
      'refunded_item_ids', to_jsonb(v_refund_item_ids),
      'refund_reason', v_trimmed_reason,
      'refund_total', v_refund_total
    )
  );

  return query
  select
    sov.id,
    sov.branch_id,
    sov.invoice_number,
    sov.employee_id,
    sov.employee_name,
    sov.status,
    sov.payment_method,
    sov.payment_status,
    sov.subtotal,
    sov.discount_amount,
    sov.tax_amount,
    sov.total_amount,
    sov.customer_name,
    sov.notes,
    sov.created_at,
    sov.paid_at,
    sov.refunded_amount,
    sov.refunded_at,
    sov.refund_reason,
    sov.items
  from public.sales_overview_view as sov
  where sov.id = p_sale_id
    and sov.branch_id = p_branch_id;
end;
$$;

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
  s.paid_at,
  s.refunded_amount,
  s.refunded_at,
  s.refund_reason,
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
        'lineProfit', si.profit_amount,
        'refundedQuantity', coalesce(si.refunded_quantity, 0),
        'refundedAt', si.refunded_at,
        'refundReason', si.refund_reason
      )
    ) filter (where si.id is not null),
    '[]'::jsonb
  ) as items
from public.sales as s
join public.profiles as p on p.id = s.employee_id
left join public.sale_items as si on si.sale_id = s.id
group by s.id, p.full_name;

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
  coalesce(line_stats.total_sales, 0) as total_sales,
  coalesce(sale_stats.total_revenue, 0) as total_revenue,
  coalesce(sale_stats.transaction_count, 0) as transaction_count
from public.profiles as pr
left join public.branches as b on b.id = pr.branch_id
left join lateral (
  select
    sum(greatest(si.quantity - coalesce(si.refunded_quantity, 0), 0)) as total_sales
  from public.sales as s
  join public.sale_items as si on si.sale_id = s.id
  where s.employee_id = pr.id
    and s.status = 'completed'
    and s.payment_status in ('paid', 'partially_refunded')
) as line_stats on true
left join lateral (
  select
    sum(greatest(s.total_amount - coalesce(s.refunded_amount, 0), 0)) as total_revenue,
    count(*) filter (
      where greatest(s.total_amount - coalesce(s.refunded_amount, 0), 0) > 0
    ) as transaction_count
  from public.sales as s
  where s.employee_id = pr.id
    and s.status = 'completed'
    and s.payment_status in ('paid', 'partially_refunded')
) as sale_stats on true;

create or replace view public.sales_daily_view as
select
  branch_id,
  date_trunc('day', coalesce(paid_at, created_at)) as day,
  count(*) filter (
    where payment_status in ('paid', 'partially_refunded')
      and greatest(total_amount - coalesce(refunded_amount, 0), 0) > 0
  ) as transactions,
  coalesce(
    sum(
      case
        when payment_status in ('paid', 'partially_refunded')
          then greatest(total_amount - coalesce(refunded_amount, 0), 0)
        else 0
      end
    ),
    0
  ) as revenue
from public.sales
where status = 'completed'
group by branch_id, date_trunc('day', coalesce(paid_at, created_at));

grant execute on function public.refund_sale(uuid, uuid, text, uuid, text) to authenticated;

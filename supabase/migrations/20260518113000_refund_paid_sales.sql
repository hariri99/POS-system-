alter table public.sales
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_reason text;

update public.sales
set refunded_at = coalesce(refunded_at, updated_at, created_at)
where payment_status = 'refunded'
  and refunded_at is null;

create or replace function public.refund_sale(
  p_branch_id uuid,
  p_sale_id uuid,
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
begin
  if not public.is_admin() then
    raise exception 'Only admins can refund sales.';
  end if;

  select
    s.id,
    s.branch_id,
    s.invoice_number,
    s.status,
    s.payment_status,
    s.total_amount
  into v_sale
  from public.sales s
  where s.id = p_sale_id
    and s.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'Sale not found.';
  end if;

  if v_sale.status <> 'completed' or v_sale.payment_status <> 'paid' then
    raise exception 'Only paid completed orders can be refunded.';
  end if;

  for v_item in
    select
      si.product_id,
      si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    select
      i.id,
      i.quantity_on_hand
    into v_inventory
    from public.inventory i
    where i.branch_id = p_branch_id
      and i.product_id = v_item.product_id
    for update;

    if not found then
      raise exception 'Inventory row not found for refunded product.';
    end if;

    update public.inventory
    set
      quantity_on_hand = v_inventory.quantity_on_hand + v_item.quantity,
      updated_at = v_refund_at
    where id = v_inventory.id;

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
      v_item.quantity,
      v_inventory.quantity_on_hand,
      v_inventory.quantity_on_hand + v_item.quantity,
      case
        when v_trimmed_reason is null then 'Refunded sale ' || v_sale.invoice_number
        else 'Refunded sale ' || v_sale.invoice_number || ': ' || v_trimmed_reason
      end,
      auth.uid()
    );
  end loop;

  update public.sales
  set
    payment_status = 'refunded',
    refunded_at = v_refund_at,
    refund_reason = v_trimmed_reason,
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
      'refund_reason', v_trimmed_reason,
      'refund_total', v_sale.total_amount
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
    sov.refunded_at,
    sov.refund_reason,
    sov.items
  from public.sales_overview_view sov
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
        'lineProfit', si.profit_amount
      )
    ) filter (where si.id is not null),
    '[]'::jsonb
  ) as items
from public.sales s
join public.profiles p on p.id = s.employee_id
left join public.sale_items si on si.sale_id = s.id
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
  coalesce(sum(case when s.payment_status = 'paid' then si.quantity else 0 end), 0) as total_sales,
  coalesce(sum(case when s.payment_status = 'paid' then s.total_amount else 0 end), 0) as total_revenue,
  coalesce(count(distinct case when s.payment_status = 'paid' then s.id end), 0) as transaction_count
from public.profiles pr
left join public.branches b on b.id = pr.branch_id
left join public.sales s on s.employee_id = pr.id and s.status = 'completed'
left join public.sale_items si on si.sale_id = s.id
group by pr.id, b.name;

grant execute on function public.refund_sale(uuid, uuid, text) to authenticated;

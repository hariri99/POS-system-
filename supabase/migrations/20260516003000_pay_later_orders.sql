alter table public.sales
  add column if not exists paid_at timestamptz;

update public.sales
set paid_at = coalesce(paid_at, created_at)
where payment_status = 'paid';

drop function if exists public.process_sale(
  uuid,
  uuid,
  jsonb,
  numeric,
  public.payment_method,
  text,
  text
);

create or replace function public.process_sale(
  p_branch_id uuid,
  p_employee_id uuid,
  p_items jsonb,
  p_discount_amount numeric default 0,
  p_payment_method public.payment_method default 'cash',
  p_notes text default null,
  p_customer_name text default null,
  p_payment_status public.payment_status default 'paid'
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
  v_effective_payment_status public.payment_status;
begin
  if public.current_user_role() not in ('admin', 'employee') then
    raise exception 'Only authenticated staff can create sales.';
  end if;

  if auth.uid() is distinct from p_employee_id and not public.is_admin() then
    raise exception 'Employees can only submit their own sales.';
  end if;

  v_effective_payment_status :=
    case
      when p_payment_status = 'pending' then 'pending'::public.payment_status
      else 'paid'::public.payment_status
    end;

  insert into public.sales (
    id,
    branch_id,
    invoice_number,
    employee_id,
    status,
    payment_method,
    payment_status,
    customer_name,
    notes,
    paid_at
  )
  values (
    v_sale_id,
    p_branch_id,
    v_invoice_number,
    p_employee_id,
    'draft',
    p_payment_method,
    v_effective_payment_status,
    p_customer_name,
    coalesce(p_notes, ''),
    case when v_effective_payment_status = 'paid' then timezone('utc', now()) else null end
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

    update public.inventory as i
    set
      quantity_on_hand = v_new_quantity,
      updated_at = timezone('utc', now())
    where i.branch_id = p_branch_id
      and i.product_id = v_product.id;

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
      case when v_effective_payment_status = 'pending' then 'Pending sale ' else 'Sale ' end || v_invoice_number,
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
    case when v_effective_payment_status = 'pending' then 'created_pending' else 'completed' end,
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'subtotal', v_subtotal,
      'discount_amount', v_line_discounts + coalesce(p_discount_amount, 0),
      'payment_status', v_effective_payment_status,
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
    s.paid_at,
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

create or replace function public.settle_pending_sale(
  p_branch_id uuid,
  p_sale_id uuid
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
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can settle unpaid orders.';
  end if;

  update public.sales as s
  set
    payment_status = 'paid',
    paid_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where s.id = p_sale_id
    and s.branch_id = p_branch_id
    and s.status = 'completed'
    and s.payment_status = 'pending'
  returning s.id into v_sale_id;

  if v_sale_id is null then
    raise exception 'Pending sale not found.';
  end if;

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
    v_sale_id,
    'settled_pending',
    jsonb_build_object('sale_id', v_sale_id)
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
    sov.items
  from public.sales_overview_view sov
  where sov.id = v_sale_id;
end;
$$;

create or replace function public.void_pending_sale(
  p_branch_id uuid,
  p_sale_id uuid
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
  items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale record;
  v_item record;
  v_previous_quantity integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete unpaid orders.';
  end if;

  select *
  into v_sale
  from public.sales as s
  where s.id = p_sale_id
    and s.branch_id = p_branch_id
    and s.status = 'completed'
    and s.payment_status = 'pending'
  for update;

  if not found then
    raise exception 'Pending sale not found.';
  end if;

  for v_item in
    select si.product_id, si.quantity
    from public.sale_items si
    where si.sale_id = p_sale_id
  loop
    select quantity_on_hand
    into v_previous_quantity
    from public.inventory as i
    where i.branch_id = p_branch_id
      and i.product_id = v_item.product_id
    for update;

    update public.inventory as i
    set
      quantity_on_hand = quantity_on_hand + v_item.quantity,
      updated_at = timezone('utc', now())
    where i.branch_id = p_branch_id
      and i.product_id = v_item.product_id;

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
      'void',
      v_item.quantity,
      v_previous_quantity,
      v_previous_quantity + v_item.quantity,
      'Voided unpaid sale ' || v_sale.invoice_number,
      auth.uid()
    );
  end loop;

  update public.sales as s
  set
    status = 'cancelled',
    payment_status = 'void',
    cancelled_at = timezone('utc', now()),
    paid_at = null,
    updated_at = timezone('utc', now())
  where s.id = p_sale_id
    and s.branch_id = p_branch_id;

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
    'voided_pending',
    jsonb_build_object('sale_id', p_sale_id)
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
    sov.items
  from public.sales_overview_view sov
  where sov.id = p_sale_id;
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
  coalesce(sum(si.quantity), 0) as total_sales,
  coalesce(sum(case when s.payment_status = 'paid' then s.total_amount else 0 end), 0) as total_revenue,
  coalesce(count(distinct s.id), 0) as transaction_count
from public.profiles pr
left join public.branches b on b.id = pr.branch_id
left join public.sales s on s.employee_id = pr.id and s.status = 'completed'
left join public.sale_items si on si.sale_id = s.id
group by pr.id, b.name;

create or replace view public.sales_daily_view as
select
  branch_id,
  date_trunc('day', coalesce(paid_at, created_at)) as day,
  count(*) as transactions,
  coalesce(sum(total_amount), 0) as revenue
from public.sales
where status = 'completed'
  and payment_status = 'paid'
group by branch_id, date_trunc('day', coalesce(paid_at, created_at));

grant execute on function public.process_sale(
  uuid,
  uuid,
  jsonb,
  numeric,
  public.payment_method,
  text,
  text,
  public.payment_status
) to authenticated;

grant execute on function public.settle_pending_sale(uuid, uuid) to authenticated;
grant execute on function public.void_pending_sale(uuid, uuid) to authenticated;

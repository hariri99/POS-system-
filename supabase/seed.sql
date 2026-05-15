insert into public.branches (id, name, code, address, phone)
values
  ('11111111-1111-4111-8111-111111111111', '', 'BEI-01', 'Hamra, Beirut', '+961 70 777 000')
on conflict (id) do nothing;

insert into public.categories (id, name, slug)
values
  ('22222222-2222-4222-8222-222222222221', 'Whey Protein', 'whey-protein'),
  ('22222222-2222-4222-8222-222222222222', 'Pre-Workout', 'pre-workout'),
  ('22222222-2222-4222-8222-222222222223', 'Vitamins', 'vitamins'),
  ('22222222-2222-4222-8222-222222222224', 'Protein Bars', 'protein-bars'),
  ('22222222-2222-4222-8222-222222222225', 'Creatine', 'creatine'),
  ('22222222-2222-4222-8222-222222222226', 'Fat Burner', 'fat-burner'),
  ('22222222-2222-4222-8222-222222222227', 'Carbs', 'carbs')
on conflict (id) do nothing;

insert into public.brands (id, name)
values
  ('33333333-3333-4333-8333-333333333331', 'Optimum Fuel'),
  ('33333333-3333-4333-8333-333333333332', 'Raw Lab'),
  ('33333333-3333-4333-8333-333333333333', 'Prime Strength'),
  ('33333333-3333-4333-8333-333333333334', 'Core Active')
on conflict (id) do nothing;

insert into public.suppliers (id, name, contact_name, phone, email, notes)
values
  ('44444444-4444-4444-8444-444444444441', 'Fitline Distributors', 'Maya Kassis', '+961 70 101 111', 'maya@fitline.co', 'Fast whey turnaround and dependable replenishment.'),
  ('44444444-4444-4444-8444-444444444442', 'Peak Imports', 'Rami Hallak', '+961 71 202 222', 'rami@peakimports.co', 'Handles stimulant and convenience product lines.')
on conflict (id) do nothing;

insert into public.products (
  id,
  branch_id,
  category_id,
  brand_id,
  supplier_id,
  name,
  description,
  flavor,
  size_label,
  sku,
  barcode,
  sale_price,
  cost_price,
  expiry_date,
  image_url,
  is_active
)
values
  (
    '55555555-5555-4555-8555-555555555551',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222221',
    '33333333-3333-4333-8333-333333333331',
    '44444444-4444-4444-8444-444444444441',
    'Gold Whey Isolate',
    'Fast-mixing isolate protein for recovery and lean intake.',
    'Double Chocolate',
    '5 lb',
    'WHEY-ISO-5LB-CHO',
    '6281001000101',
    79,
    54,
    current_date + 220,
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
    true
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333332',
    '44444444-4444-4444-8444-444444444442',
    'Nitro Surge Pre-Workout',
    'High-focus pre-workout for peak training sessions.',
    'Blue Ice',
    '30 servings',
    'PRE-RAW-30-BLU',
    '6281001000201',
    36,
    21,
    current_date + 85,
    'https://images.unsplash.com/photo-1604480133435-25b86862d276?auto=format&fit=crop&w=600&q=80',
    true
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222223',
    '33333333-3333-4333-8333-333333333334',
    '44444444-4444-4444-8444-444444444441',
    'Performance Multivitamin',
    'Daily support formula for performance-driven customers.',
    'Unflavored',
    '90 capsules',
    'VITA-CORE-90',
    '6281001000301',
    24,
    12,
    current_date + 45,
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80',
    true
  )
on conflict (id) do nothing;

insert into public.inventory (
  branch_id,
  product_id,
  quantity_on_hand,
  reserved_quantity,
  reorder_point,
  last_restocked_at
)
values
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555551', 18, 0, 8, timezone('utc', now()) - interval '5 days'),
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555552', 7, 0, 8, timezone('utc', now()) - interval '11 days'),
  ('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555553', 27, 0, 10, timezone('utc', now()) - interval '4 days')
on conflict (branch_id, product_id) do nothing;

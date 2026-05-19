alter type public.payment_method add value if not exists 'whish_money';

update public.sales
set payment_method = 'whish_money'
where payment_method in ('card', 'bank_transfer', 'mixed');

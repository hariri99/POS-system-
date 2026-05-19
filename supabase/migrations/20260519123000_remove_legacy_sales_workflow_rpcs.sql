drop function if exists public.process_sale(
  uuid,
  uuid,
  jsonb,
  numeric,
  public.payment_method,
  text,
  text
);

drop function if exists public.process_sale(
  uuid,
  uuid,
  jsonb,
  numeric,
  public.payment_method,
  text,
  text,
  public.payment_status
);

drop function if exists public.settle_pending_sale(
  uuid,
  uuid
);

drop function if exists public.void_pending_sale(
  uuid,
  uuid
);

drop function if exists public.refund_sale(
  uuid,
  uuid,
  text
);

drop function if exists public.refund_sale(
  uuid,
  uuid,
  text,
  uuid,
  text
);

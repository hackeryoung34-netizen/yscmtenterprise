-- Paystack payment references and server-only paid-state confirmation.
-- The browser/customer may attach a provider reference only to their own pending order.
-- Only the Supabase service_role may mark an order paid after server-side Paystack verification.

create or replace function public.store_set_paystack_reference(p_order_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_reference is null or length(p_reference) < 8 or length(p_reference) > 120 then
    return false;
  end if;
  update public.store_orders
     set payment_provider = 'paystack',
         provider_reference = p_reference
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'pending'
     and payment_provider is null
     and provider_reference is null;
  return found;
end;
$$;
revoke all on function public.store_set_paystack_reference(uuid,text) from public, anon;
grant execute on function public.store_set_paystack_reference(uuid,text) to authenticated;

create or replace function public.store_confirm_paystack_payment(p_reference text, p_amount_ngn integer, p_currency text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.store_orders%rowtype;
begin
  if p_reference is null or p_amount_ngn is null or p_currency <> 'NGN' then
    return false;
  end if;
  select * into v_order
    from public.store_orders
   where provider_reference = p_reference
     and payment_provider = 'paystack'
   for update;
  if not found or v_order.amount_ngn <> p_amount_ngn or v_order.currency <> p_currency then
    return false;
  end if;
  if v_order.status = 'paid' then
    return true;
  end if;
  if v_order.status <> 'pending' then
    return false;
  end if;
  update public.store_orders
     set status = 'paid', paid_at = now()
   where id = v_order.id;
  return true;
end;
$$;
revoke all on function public.store_confirm_paystack_payment(text,integer,text) from public, anon, authenticated, authenticator;
grant execute on function public.store_confirm_paystack_payment(text,integer,text) to service_role;
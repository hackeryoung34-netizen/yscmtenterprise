-- Server-only RPC: service_role attaches a freshly initialized Paystack reference.
-- The browser cannot execute this function; ownership was already checked before checkout.
create or replace function public.store_set_paystack_reference(p_order_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reference is null or p_reference !~ '^yscmt-[0-9a-f-]{36}$' then
    return false;
  end if;
  update public.store_orders
     set payment_provider = 'paystack',
         provider_reference = p_reference
   where id = p_order_id
     and status = 'pending'
     and payment_provider is null
     and provider_reference is null;
  return found;
end;
$$;
revoke all on function public.store_set_paystack_reference(uuid,text) from public, anon, authenticated, authenticator;
grant execute on function public.store_set_paystack_reference(uuid,text) to service_role;
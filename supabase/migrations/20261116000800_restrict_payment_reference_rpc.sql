-- Restrict payment-reference attachment to the trusted server-side service role.
revoke all on function public.store_set_paystack_reference(uuid,text) from public, anon, authenticated, authenticator;
grant execute on function public.store_set_paystack_reference(uuid,text) to service_role;
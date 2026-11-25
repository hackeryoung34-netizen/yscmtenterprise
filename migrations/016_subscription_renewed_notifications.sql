-- Include successful subscription renewal confirmations in the notification outbox.
alter table public.enterprise_customer_notifications drop constraint if exists enterprise_customer_notifications_event_type_check;
alter table public.enterprise_customer_notifications add constraint enterprise_customer_notifications_event_type_check check (event_type in ('invoice_issued','invoice_paid','invoice_overdue','subscription_due','subscription_renewal_invoice','subscription_renewed'));

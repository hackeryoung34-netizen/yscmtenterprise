-- Reconcile affiliate commission settlements to the exact referrals being paid.
create table if not exists public.enterprise_settlement_referrals (
 settlement_id uuid not null references public.enterprise_settlements(id) on delete restrict,
 referral_id uuid not null references public.affiliate_referrals(id) on delete restrict,
 primary key(settlement_id,referral_id),
 unique(referral_id)
);
create index if not exists enterprise_settlement_referrals_referral_idx on public.enterprise_settlement_referrals(referral_id);
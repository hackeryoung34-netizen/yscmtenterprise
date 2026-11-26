# YSCMT Enterprise — Independent Infrastructure Plan

**Status:** Approved architecture baseline  
**Date:** 2026-11-26  
**Primary domain:** https://www.yscmtenterprise.ng/  
**Principle:** No Hatchable dependency in the target architecture. No production cutover, destructive action, paid resource, or data migration without verification and the required approval.

## 1. Target architecture

| Layer | Target service | Responsibility |
|---|---|---|
| Source control | GitHub | Versioned source, migrations, deployment history |
| Web delivery | Vercel | Public website and React frontends; use the existing project where possible |
| DNS / edge security | Cloudflare | DNS, CDN, WAF/security rules, static asset delivery |
| Data platform | Supabase | PostgreSQL, Auth, Storage, Realtime and server-side functions where suitable |
| Payments | Paystack | NGN checkout; payment status must be verified server-side |

This is a managed, serverless/cloud-native architecture, not a root VPS. It avoids a VPS purchase now while preserving a path to a dedicated server later if real traffic or workloads justify it.

## 2. Application boundaries

- Main business website and public pages.
- Student Portal, including student, teacher and administrator workflows.
- YSCMT Connect, including profiles, feed, groups, messaging, stories, moderation and live-session scheduling.
- Template Store, including catalogue, orders, downloads and installation requests.
- Billing, Invoices & Finance, including role separation, approvals, reconciliation and audit records.
- Shared identity, notifications, support and reporting where a secure common design is appropriate.

Each application must have explicit API boundaries, documented data ownership, environment separation and least-privilege access. Public browser code must never contain Supabase service-role/secret keys, payment secrets, or other privileged credentials.

## 3. Existing resources discovered during the initial read-only audit

### GitHub
- hackeryoung34-netizen/yscmtenterprise — main website repository; default branch main.
- hackeryoung34-netizen/yscmt-react — React/Vite frontend repository.
- hackeryoung34-netizen/yscmt-backend — backend repository; a migration/independent-portal branch exists.
- These repositories are retained. Do not replace or delete existing source.

### Supabase
- **YSCMT-Template-Store** — project jkeyysmfrsmsolgkvfwb, active and healthy. It contains existing store catalogue, order, installation, audit and customer-support data. Initial table inspection found 7 products, 1 order, 3 chat conversations, 29 chat messages, 47 call records and 251 call-event records. Preserve every existing record.
- **YSCMT-Community** — project tfaraznupjwpkyflwdjg, active and healthy. Current public schema has community_profiles and community_posts; both were empty at the time of inspection. This is not yet evidence that the complete social-network data model has been migrated.
- **YSCMT-Student-Portal** — project wzpkfjnymsxczbkiukrp, currently INACTIVE. Do not restore, reset, delete, or migrate it until restore cost and data status are checked.

### Deployment access
- Vercel project listing returned a 403 authorization error in this audit. No deployment, environment variable, domain, or project setting was changed. Verify Vercel access before any deployment work.

## 4. Initial security observations — read-only

- The Template Store security advisor reports RLS enabled without policies on public.store_chat_calls and public.store_chat_call_events. This requires a policy and API-access review before changing anything; do not add broad policies or weaken server-side checks.
- Supabase Auth leaked-password protection is reported disabled on the Template Store project. Review and enable only after checking the project's current auth configuration and user impact.
- The YSCMT-Community security advisor returned no findings in the initial check.
- All payment state transitions must remain server-side and tied to verified Paystack references, exact NGN amounts and order metadata.

## 5. Migration sequence

1. **Inventory and backup:** map every repository, deployment, domain, database table, storage bucket, auth provider, function, secret reference and integration. Export schema and verify backup/restore paths before any data movement.
2. **Core foundation:** document canonical environment names, API conventions, shared identity strategy, roles, audit events, error handling and security boundaries. Do not create duplicate paid resources.
3. **Backend first:** establish and validate independent APIs and database migrations on a non-production branch or isolated environment. Keep secrets server-side.
4. **Student Portal:** recover the inactive Supabase project's status and restore cost; map existing student/course/enrolment data before deciding whether to restore or rebuild. No production cutover until parity and authentication are verified.
5. **YSCMT Connect:** inventory the live app's schema and media, map every feature to the independent database/API, and migrate data with counts and integrity checks.
6. **Store and Finance:** preserve existing Template Store orders and chat data; audit payment verification, downloads, finance roles, approvals and audit trails.
7. **Acceptance testing:** test authentication, role permissions, RLS, uploads, payment webhooks, email, mobile layouts, backups, performance and failure recovery.
8. **Cutover:** stage domain/path routing, verify rollback, then request explicit owner approval before switching production traffic.
9. **Decommission:** only after a stable observation period and explicit approval may any former service be retired.

## 6. Non-negotiable safeguards

- No Hatchable dependency in the final architecture.
- Do not shut down existing services before their replacements are verified and the owner explicitly approves cutover.
- No invented or dummy students, customers, payments, invoices, posts, messages or orders.
- No production database reset, destructive migration, project restore with unknown cost, or paid upgrade without prior cost and impact review.
- Never expose service-role keys, database passwords, Paystack secret keys or root passwords.
- Keep production and staging clearly separated; do not run test transactions against live payment flows.
- Report each item accurately as planned, committed, deployed or verified. A Git commit is not proof of a live deployment.

## 7. Immediate next tasks

1. Complete a read-only repository and deployment inventory.
2. Confirm Vercel team/project access and current production deployment.
3. Inspect Supabase storage, Auth configuration, functions, policies and backup options.
4. Inspect the existing backend migration branch and map its current work against the portal.
5. Produce a migration matrix with source, target, owner, data volume, risks, validation and rollback steps before implementing data changes.

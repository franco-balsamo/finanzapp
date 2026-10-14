-- Antes de la beta: un índice por cada clave foránea que marcó el advisor de Supabase
-- (docs/decisiones/2026-10-04-primer-deploy.md). Sin ellos, borrar una tarjeta, una
-- cuenta, un miembro o un usuario recorre la tabla hija entera.
-- Los de (user_id, card_id) cubren también las claves que van solo por user_id.

create index statement_overrides_user_card_idx on public.statement_overrides (user_id, card_id);
create index statement_payments_user_card_idx on public.statement_payments (user_id, card_id);
create index statement_payments_user_from_account_idx on public.statement_payments (user_id, from_account_id);

create index categories_user_idx on public.categories (user_id);
create index category_keywords_category_idx on public.category_keywords (category_id);

create index groups_owner_member_idx on public.groups (id, owner_member_id);
create index group_members_unclaimed_by_idx on public.group_members (unclaimed_by);

create index group_expenses_category_idx on public.group_expenses (category_id);
create index group_expenses_created_by_idx on public.group_expenses (created_by);
create index group_expenses_updated_by_idx on public.group_expenses (updated_by);
create index group_expenses_payer_idx on public.group_expenses (group_id, payer_member_id);
create index group_expense_parts_expense_idx on public.group_expense_parts (group_id, group_expense_id);
create index group_expense_parts_member_idx on public.group_expense_parts (group_id, member_id);

create index group_payments_created_by_idx on public.group_payments (created_by);
create index group_payments_voided_by_idx on public.group_payments (voided_by);
create index group_payments_from_member_idx on public.group_payments (group_id, from_member_id);
create index group_payments_to_member_idx on public.group_payments (group_id, to_member_id);

create index movements_category_idx on public.movements (category_id);
create index movements_user_account_idx on public.movements (user_id, account_id);
create index movements_user_to_account_idx on public.movements (user_id, to_account_id);

create index notifications_alert_idx on public.notifications (alert_id);
create index card_notices_notification_idx on private.card_notices (notification_id);

create table if not exists public.sequence_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
-- Compatible with automatic RLS: enabling it again is harmless.
-- Automatic RLS does not create the owner-access policies below.
alter table public.sequence_plans enable row level security;
create policy "Owners read plans" on public.sequence_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners create plans" on public.sequence_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners update plans" on public.sequence_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners delete plans" on public.sequence_plans for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.sequence_plans to authenticated;

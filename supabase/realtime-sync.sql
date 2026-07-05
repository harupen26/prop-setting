create table if not exists public.project_snapshots (
  share_id text primary key check (share_id ~ '^[A-Z0-9_-]{3,24}$'),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create index if not exists project_snapshots_updated_at_idx on public.project_snapshots (updated_at);

alter table public.project_snapshots enable row level security;

grant select, insert, update on public.project_snapshots to anon, authenticated;

drop policy if exists project_snapshots_select on public.project_snapshots;
drop policy if exists project_snapshots_insert on public.project_snapshots;
drop policy if exists project_snapshots_update on public.project_snapshots;

create policy project_snapshots_select
  on public.project_snapshots
  for select
  using (true);

create policy project_snapshots_insert
  on public.project_snapshots
  for insert
  with check (true);

create policy project_snapshots_update
  on public.project_snapshots
  for update
  using (true)
  with check (true);

alter table public.project_snapshots replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_snapshots'
  ) then
    alter publication supabase_realtime add table public.project_snapshots;
  end if;
end $$;

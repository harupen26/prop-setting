create extension if not exists pgcrypto;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  share_id text not null unique default upper(encode(gen_random_bytes(5), 'hex')),
  created_at timestamptz not null default now()
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  copied_from_competition_id uuid references public.competitions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  display_order integer not null,
  name text not null,
  marker_label text not null check (char_length(marker_label) between 1 and 4),
  edit_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (project_id, display_order)
);

create table public.role_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  display_order integer not null,
  visible boolean not null default true,
  collapsed boolean not null default false
);

create table public.apparatus_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder_id uuid not null references public.role_folders(id) on delete cascade,
  name text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  display_order integer not null,
  visible boolean not null default true
);

create type public.marker_phase as enum ('entry', 'exit');

create table public.markers (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  role_id uuid not null references public.apparatus_roles(id) on delete cascade,
  phase public.marker_phase not null,
  x_snap integer not null check (x_snap between 0 and 160),
  y_snap integer not null check (y_snap between 0 and 128),
  note text,
  updated_at timestamptz not null default now()
);

create table public.integrations (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  integrated_at timestamptz not null default now(),
  primary key (competition_id, participant_id)
);

create table if not exists public.project_snapshots (
  share_id text primary key check (share_id ~ '^[A-Z0-9_-]{3,24}$'),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create index markers_competition_phase_idx on public.markers (competition_id, phase);
create index markers_participant_idx on public.markers (participant_id);
create index apparatus_roles_project_idx on public.apparatus_roles (project_id, display_order);
create index projects_share_id_idx on public.projects (share_id);
create index if not exists project_snapshots_updated_at_idx on public.project_snapshots (updated_at);

alter table public.projects enable row level security;
alter table public.competitions enable row level security;
alter table public.participants enable row level security;
alter table public.role_folders enable row level security;
alter table public.apparatus_roles enable row level security;
alter table public.markers enable row level security;
alter table public.integrations enable row level security;
alter table public.project_snapshots enable row level security;

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

-- 初期実装では秘密リンクのトークン検証をEdge Function側で行い、
-- DBにはハッシュのみ保存する想定です。

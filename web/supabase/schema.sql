create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  habits jsonb,
  notebook jsonb,
  memory jsonb,
  archive jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.lists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.lists enable row level security;

drop policy if exists "profil personnel" on public.profiles;
create policy "profil personnel"
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "liste personnelle" on public.lists;
create policy "liste personnelle"
  on public.lists
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.lists to authenticated;

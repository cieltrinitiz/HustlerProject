create extension if not exists pgcrypto;


create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  display_name text,
  avatar_url text,
  gooddollar_verified boolean not null default false,
  gooddollar_root text,
  gooddollar_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  creator_wallet text not null,
  title text not null,
  description text,
  content text,
  category text,
  cover_url text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_drafts (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade,
  creator_wallet text not null,
  draft_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade,
  creator_wallet text not null,
  contract_exam_id text,
  question_set_hash text not null,
  question_count integer not null check (question_count > 0),
  reward_per_correct numeric not null default 100,
  max_participants integer not null default 100 check (max_participants > 0),
  timer_seconds integer not null default 30 check (timer_seconds >= 5),
  correction_delay_seconds integer not null default 86400,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  question_index integer not null,
  prompt text not null,
  choice_a text not null,
  choice_b text not null,
  choice_c text not null,
  choice_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  created_at timestamptz not null default now(),
  unique (exam_id, question_index)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  wallet_address text not null,
  answer_commitment text not null,
  revealed_answers text,
  score integer,
  status text not null default 'committed',
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, wallet_address)
);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  wallet_address text not null,
  amount numeric not null default 0,
  claimed_onchain boolean not null default false,
  tx_hash text,
  created_at timestamptz not null default now(),
  unique (exam_id, wallet_address)
);

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.exam_drafts enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.submissions enable row level security;
alter table public.reward_claims enable row level security;

create policy "Public profiles are readable" on public.profiles for select using (true);
create policy "Public modules are readable" on public.modules for select using (status in ('published', 'active'));
create policy "Published exams are readable" on public.exams for select using (status in ('published', 'active', 'corrected'));
create policy "Published questions are readable" on public.questions for select using (
  exists (
    select 1 from public.exams
    where public.exams.id = public.questions.exam_id
    and public.exams.status in ('published', 'active', 'corrected')
  )
);

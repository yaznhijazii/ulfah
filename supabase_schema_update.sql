-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: dialogues (جلسات الحوار)
create table public.dialogues (
  id uuid default uuid_generate_v4() primary key,
  partnership_id uuid references public.partnerships(id) not null,
  created_by_user_id uuid references public.users(id) not null,
  title text not null, -- عنوان الحوار: سوء فهم، غيرة، وقت
  dialogue_date date not null,
  description text, -- شو صار؟
  feelings_user1 text, -- مشاعر الطرف الأول
  feelings_user2 text, -- مشاعر الطرف الثاني
  final_agreement text, -- الاتفاق النهائي
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: agreements (نظام الاتفاقات الذكي)
create table public.agreements (
  id uuid default uuid_generate_v4() primary key,
  partnership_id uuid references public.partnerships(id) not null,
  dialogue_id uuid references public.dialogues(id), -- Optional link to a dialogue
  title text not null, -- اسم الاتفاق
  assignee text check (assignee in ('me', 'partner', 'both')) not null, -- على مين
  duration text check (duration in ('week', 'month', 'open')) not null, -- مدة الاتفاق
  status text check (status in ('active', 'completed', 'breached')) default 'active',
  breach_count int default 0, -- عداد "نحتاج نحكي"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.dialogues enable row level security;
alter table public.agreements enable row level security;

create policy "Users can view their partnership dialogues"
  on public.dialogues for select
  using (
    auth.uid() in (
      select user1_id from public.partnerships where id = partnership_id
      union
      select user2_id from public.partnerships where id = partnership_id
    )
  );

create policy "Users can insert dialogues in their partnership"
  on public.dialogues for insert
  with check (
    auth.uid() in (
      select user1_id from public.partnerships where id = partnership_id
      union
      select user2_id from public.partnerships where id = partnership_id
    )
  );

create policy "Users can view their partnership agreements"
  on public.agreements for select
  using (
    auth.uid() in (
      select user1_id from public.partnerships where id = partnership_id
      union
      select user2_id from public.partnerships where id = partnership_id
    )
  );

create policy "Users can insert agreements in their partnership"
  on public.agreements for insert
  with check (
    auth.uid() in (
      select user1_id from public.partnerships where id = partnership_id
      union
      select user2_id from public.partnerships where id = partnership_id
    )
  );

create policy "Users can update agreements in their partnership"
  on public.agreements for update
  using (
    auth.uid() in (
      select user1_id from public.partnerships where id = partnership_id
      union
      select user2_id from public.partnerships where id = partnership_id
    )
  );

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  context_type text not null check (context_type in ('entry', 'campaign', 'calendar', 'performance', 'freeform')),
  context_id uuid,
  prompt_template text check (prompt_template in (
    'generate_script', 'suggest_hooks', 'caption_hashtags',
    'content_gap_analysis', 'trend_brief', 'monthly_report',
    'freeform'
  )),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_conversations_user on ai_conversations(user_id, updated_at desc);
create index idx_ai_conversations_context on ai_conversations(context_type, context_id);

create trigger ai_conversations_set_updated_at before update on ai_conversations
  for each row execute function set_updated_at();

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_used integer,
  created_at timestamptz not null default now()
);

create index idx_ai_messages_conversation on ai_messages(conversation_id, created_at);

alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

create policy "users_own_conversations" on ai_conversations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users_own_messages" on ai_messages
  for all to authenticated using (
    exists (select 1 from ai_conversations where id = ai_messages.conversation_id and user_id = auth.uid())
  ) with check (
    exists (select 1 from ai_conversations where id = ai_messages.conversation_id and user_id = auth.uid())
  );

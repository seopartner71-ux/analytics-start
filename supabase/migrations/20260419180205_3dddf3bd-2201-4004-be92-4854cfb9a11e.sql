-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Books registry
create table public.knowledge_books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_path text,
  pages_count integer not null default 0,
  chunks_count integer not null default 0,
  uploaded_by uuid not null,
  status text not null default 'processing',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_books enable row level security;

create policy "Authenticated read knowledge_books"
on public.knowledge_books for select to authenticated using (true);

create policy "Admins manage knowledge_books"
on public.knowledge_books for all to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));

create trigger trg_knowledge_books_updated_at
before update on public.knowledge_books
for each row execute function public.update_updated_at_column();

-- 3. Chunks with embeddings
create table public.knowledge_chunks (
  id bigserial primary key,
  book_id uuid references public.knowledge_books(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  source text not null,
  page_number integer not null default 1,
  chunk_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.knowledge_chunks enable row level security;

create policy "Authenticated read knowledge_chunks"
on public.knowledge_chunks for select to authenticated using (true);

create policy "Admins manage knowledge_chunks"
on public.knowledge_chunks for all to authenticated
using (has_role(auth.uid(), 'admin'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role));

create index knowledge_chunks_embedding_idx
on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index knowledge_chunks_book_id_idx on public.knowledge_chunks(book_id);

-- 4. RAG search function
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id bigint,
  content text,
  source text,
  page_number int,
  similarity float
)
language sql stable security definer set search_path = public
as $$
  select
    kc.id,
    kc.content,
    kc.source,
    kc.page_number,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Feedback table for "Не помогло"
create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question text not null,
  answer text,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.ai_feedback enable row level security;

create policy "Users insert own ai_feedback"
on public.ai_feedback for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users view own ai_feedback"
on public.ai_feedback for select to authenticated
using (auth.uid() = user_id);

create policy "Admins view all ai_feedback"
on public.ai_feedback for select to authenticated
using (has_role(auth.uid(), 'admin'::app_role));

-- 6. Storage bucket for PDFs (private)
insert into storage.buckets (id, name, public)
values ('knowledge-pdfs', 'knowledge-pdfs', false)
on conflict (id) do nothing;

create policy "Admins manage knowledge-pdfs"
on storage.objects for all to authenticated
using (bucket_id = 'knowledge-pdfs' and has_role(auth.uid(), 'admin'::app_role))
with check (bucket_id = 'knowledge-pdfs' and has_role(auth.uid(), 'admin'::app_role));

create policy "Authenticated read knowledge-pdfs"
on storage.objects for select to authenticated
using (bucket_id = 'knowledge-pdfs');
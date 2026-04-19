-- AI assistant chat history per user
CREATE TABLE IF NOT EXISTS public.ai_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_messages_user_created
  ON public.ai_assistant_messages(user_id, created_at);

ALTER TABLE public.ai_assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai messages"
  ON public.ai_assistant_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Default system prompt (editable by admin via app_settings)
INSERT INTO public.app_settings (key, value)
VALUES (
  'ai_assistant_system_prompt',
  'Ты внутренний SEO-ассистент компании. Помогаешь junior SEO-специалистам.

Твои правила:
- Объясняй просто, без сложных терминов.
- Если термин сложный — сначала объясни что это, потом используй.
- Всегда давай конкретный пример.
- Если вопрос про задачу пользователя — опирайся на его текущие задачи из контекста.
- Если есть подходящая статья в базе знаний — обязательно сошлись на неё (название и категория).
- Не придумывай. Если не знаешь точно — честно скажи "не знаю, уточни у старшего".
- Отвечай строго на русском языке, в дружелюбном тоне.
- Соблюдай стандарты компании, которые переданы ниже в контексте.'
)
ON CONFLICT (key) DO NOTHING;
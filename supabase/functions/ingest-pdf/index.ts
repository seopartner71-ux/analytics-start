// Ingest PDF into knowledge_chunks with OpenAI embeddings
// Admin-only. Accepts multipart/form-data with file + title.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

function chunkText(pages: string[], wordsPerChunk = 500, overlap = 80) {
  const chunks: { text: string; page: number }[] = [];
  for (let p = 0; p < pages.length; p++) {
    const words = (pages[p] || "").split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    if (words.length <= wordsPerChunk) {
      chunks.push({ text: words.join(" "), page: p + 1 });
      continue;
    }
    for (let i = 0; i < words.length; i += wordsPerChunk - overlap) {
      const slice = words.slice(i, i + wordsPerChunk).join(" ");
      if (slice.trim()) chunks.push({ text: slice, page: p + 1 });
      if (i + wordsPerChunk >= words.length) break;
    }
  }
  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI embeddings ${r.status}: ${t}`);
  }
  const j = await r.json();
  return j.data.map((d: any) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify admin role
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = (form.get("title") as string) || (file?.name ?? "Без названия");
    if (!file) return new Response(JSON.stringify({ error: "file required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Create book record
    const { data: book, error: bookErr } = await admin
      .from("knowledge_books")
      .insert({ title, file_name: file.name, uploaded_by: user.id, status: "processing" })
      .select()
      .single();
    if (bookErr || !book) throw bookErr;

    // Upload original PDF
    const buf = new Uint8Array(await file.arrayBuffer());
    const path = `${book.id}/${file.name}`;
    await admin.storage.from("knowledge-pdfs").upload(path, buf, { contentType: "application/pdf", upsert: true });
    await admin.from("knowledge_books").update({ file_path: path }).eq("id", book.id);

    // Extract text per page
    let pages: string[] = [];
    try {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: false });
      pages = Array.isArray(text) ? text : [String(text || "")];
    } catch (e) {
      await admin.from("knowledge_books").update({ status: "failed", error_message: `PDF parse: ${(e as Error).message}` }).eq("id", book.id);
      throw e;
    }

    const chunks = chunkText(pages, 500, 80);
    if (chunks.length === 0) {
      await admin.from("knowledge_books").update({ status: "failed", error_message: "Не извлечено ни одного чанка" }).eq("id", book.id);
      return new Response(JSON.stringify({ error: "Empty PDF" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Embed in batches of 64 and insert
    const BATCH = 64;
    let idx = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const embeddings = await embedBatch(slice.map((c) => c.text.slice(0, 8000)));
      const rows = slice.map((c, j) => ({
        book_id: book.id,
        content: c.text,
        embedding: embeddings[j] as any,
        source: title,
        page_number: c.page,
        chunk_index: idx++,
      }));
      const { error: insErr } = await admin.from("knowledge_chunks").insert(rows);
      if (insErr) throw insErr;
    }

    await admin.from("knowledge_books").update({
      status: "ready",
      pages_count: pages.length,
      chunks_count: chunks.length,
    }).eq("id", book.id);

    return new Response(JSON.stringify({ success: true, book_id: book.id, pages: pages.length, chunks: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

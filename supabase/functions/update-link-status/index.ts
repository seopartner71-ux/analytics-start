import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crawler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = req.headers.get("x-crawler-secret");
    const expected = Deno.env.get("CRAWLER_SECRET");
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const link_id: string | undefined = body.link_id;
    const status: string | undefined = body.status;
    const status_code: number | null = typeof body.status_code === "number" ? body.status_code : null;
    const error_message: string | null = typeof body.error === "string" ? body.error : null;

    if (!link_id || !status || !["active", "lost", "pending"].includes(status)) {
      return new Response(JSON.stringify({ error: "link_id and valid status are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Получаем ссылку для уведомления и owner_id проекта
    const { data: link, error: fetchErr } = await supabase
      .from("link_profile")
      .select("id, donor_url, project_id, status")
      .eq("id", link_id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!link) {
      return new Response(JSON.stringify({ error: "Link not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatePayload: Record<string, unknown> = {
      status,
      last_checked_at: new Date().toISOString(),
      last_status_code: status_code,
      last_error: error_message,
    };

    const { error: updErr } = await supabase
      .from("link_profile")
      .update(updatePayload)
      .eq("id", link_id);
    if (updErr) throw updErr;

    let notified = false;
    // Создаём уведомление только при переходе в lost (и если раньше не было lost)
    if (status === "lost" && link.status !== "lost") {
      const { data: project } = await supabase
        .from("projects")
        .select("owner_id, name")
        .eq("id", link.project_id)
        .maybeSingle();

      if (project?.owner_id) {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: project.owner_id,
          project_id: link.project_id,
          kind: "link_lost",
          title: "Потеряна обратная ссылка",
          body: `Ссылка отвалилась: ${link.donor_url}`,
        });
        if (notifErr) console.error("notification insert error", notifErr);
        else notified = true;
      }
    }

    return new Response(JSON.stringify({ ok: true, notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-link-status error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

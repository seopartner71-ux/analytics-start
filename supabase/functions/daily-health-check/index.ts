import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all active projects (not completed/rejected)
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("id, name, url, privacy")
      .not("privacy", "in", '("Успешно завершено","Отказ")');

    if (projErr) throw projErr;

    const refreshed: string[] = [];

    for (const project of projects || []) {
      // Update last refresh timestamp in site_health
      const { error: upsertErr } = await supabase
        .from("site_health")
        .upsert(
          {
            project_id: project.id,
            source: "system",
            metric_name: "last_scheduled_check",
            metric_value: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "project_id,source,metric_name", ignoreDuplicates: false }
        );

      if (!upsertErr) {
        refreshed.push(project.name || project.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        projects_checked: refreshed.length,
        projects: refreshed,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("DADATA_API_KEY");
    if (!token) {
      return new Response(JSON.stringify({ error: "Не настроен ключ DaData" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { inn } = await req.json();
    const query = String(inn ?? "").replace(/\D/g, "");
    if (query.length !== 10 && query.length !== 12) {
      return new Response(JSON.stringify({ error: "ИНН должен содержать 10 или 12 цифр" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({ query, count: 1 }),
      },
    );

    if (!res.ok) {
      const details = await res.text();
      console.error(`DaData error [${res.status}]: ${details}`);
      return new Response(JSON.stringify({ error: "Ошибка сервиса DaData", details }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const s = json?.suggestions?.[0];
    if (!s) {
      return new Response(JSON.stringify({ error: "Организация с таким ИНН не найдена" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const d = s.data ?? {};
    return new Response(
      JSON.stringify({
        legal_name: s.value ?? null,
        short_name: d.name?.short_with_opf ?? null,
        inn: d.inn ?? query,
        kpp: d.kpp ?? null,
        ogrn: d.ogrn ?? null,
        legal_address: d.address?.unrestricted_value ?? null,
        management: d.management?.name ?? null,
        management_post: d.management?.post ?? null,
        status: d.state?.status ?? null,
        okved: d.okved ?? null,
        okved_name: d.okved_type ? (d.okveds?.find((o: { main?: boolean }) => o.main)?.name ?? null) : (d.okveds?.find((o: { main?: boolean }) => o.main)?.name ?? null),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("dadata-party failed:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

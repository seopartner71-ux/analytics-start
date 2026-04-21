import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TV_BASE = "https://api.topvisor.com/v2/json";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const uniqPositiveNumbers = (values: number[]) =>
  [...new Set(values.filter((v) => Number.isFinite(v) && v > 0))];

function extractNestedIndexes(source: unknown): number[] {
  const acc: number[] = [];

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (!isRecord(node)) return;

    if ("index" in node) {
      const candidate = Number(node.index);
      if (Number.isFinite(candidate) && candidate > 0) {
        acc.push(candidate);
      }
    }

    Object.values(node).forEach(walk);
  };

  walk(source);
  return uniqPositiveNumbers(acc);
}

async function resolveRegionIndexes(projectId: number, headers: Record<string, string>) {
  const resp = await fetch(`${TV_BASE}/get/projects_2/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      limit: 1000,
      offset: 0,
      show_searchers_and_regions: "1",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || data?.errors?.length) {
    return [] as number[];
  }

  const projects = Array.isArray(data?.result) ? data.result : [];
  const currentProject = projects.find((p) => Number(p?.id) === projectId);
  if (!currentProject) return [] as number[];

  return extractNestedIndexes((currentProject as JsonRecord).searchers_and_regions ?? currentProject);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, api_key, user_id, payload } = body as {
      action: string;
      api_key: string;
      user_id: string;
      payload?: Record<string, unknown>;
    };

    if (!api_key || !user_id) {
      return new Response(JSON.stringify({ error: "api_key and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Id": user_id,
      Authorization: `bearer ${api_key}`,
    };

    let url: string;
    let method = "POST";
    let fetchBody: string | undefined;
    let requestedProjectId: number | null = null;
    let normalizedRegionsIndexes: number[] = [];

    switch (action) {
      case "get-projects":
        url = `${TV_BASE}/get/projects_2/projects`;
        fetchBody = JSON.stringify({
          limit: 1000,
          offset: 0,
          fields: ["name", "site"],
          show_searchers_and_regions: "1",
        });
        break;

      case "summary": {
        const sumProjectId = Number((body as JsonRecord).project_id);
        if (!Number.isFinite(sumProjectId)) {
          return new Response(JSON.stringify({ error: "project_id must be a number" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        const toStr = (d: Date) => d.toISOString().slice(0, 10);
        const date2 = toStr(today);
        const past = new Date(today);
        past.setDate(past.getDate() - 30);
        const date1 = toStr(past);

        const sumRegions = await resolveRegionIndexes(sumProjectId, headers);
        const sumBody: JsonRecord = {
          project_id: String(sumProjectId),
          date1,
          date2,
          show_headers: 1,
          show_exists_dates: 1,
          positions_fields: ["position"],
        };
        if (sumRegions.length > 0) {
          sumBody.regions_indexes = sumRegions.map((idx) => String(idx));
        }

        const sumResp = await fetch(`${TV_BASE}/get/positions_2/history`, {
          method: "POST",
          headers,
          body: JSON.stringify(sumBody),
        });
        const sumData = await sumResp.json();

        if (!sumResp.ok || sumData?.errors?.length) {
          const err = sumData?.errors?.[0]?.string || "Topvisor summary error";
          return new Response(
            JSON.stringify({ error: err, top3: 0, top10: 0, top30: 0, outside: 0, topGrowth: [] }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const buckets = { top3: 0, top10: 0, top30: 0, outside: 0 };
        const growth: Array<{ keyword: string; from: number; to: number }> = [];
        const keywordsArr = Array.isArray(sumData?.result?.keywords) ? sumData.result.keywords : [];

        for (const kw of keywordsArr) {
          const name = String(kw?.name ?? kw?.title ?? "");
          const positions: Array<{ date: string; pos: number }> = [];
          const walk = (n: unknown, dateHint?: string) => {
            if (!isRecord(n)) return;
            for (const [k, v] of Object.entries(n)) {
              if (isRecord(v)) {
                const maybeDate = /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : dateHint;
                if ("position" in v) {
                  const p = Number((v as JsonRecord).position);
                  if (Number.isFinite(p) && p > 0 && maybeDate) {
                    positions.push({ date: maybeDate, pos: p });
                  }
                }
                walk(v, maybeDate);
              }
            }
          };
          walk(kw?.positionsData ?? kw);

          if (positions.length === 0) continue;
          positions.sort((a, b) => a.date.localeCompare(b.date));
          const last = positions[positions.length - 1].pos;
          const first = positions[0].pos;

          if (last <= 3) buckets.top3++;
          else if (last <= 10) buckets.top10++;
          else if (last <= 30) buckets.top30++;
          else buckets.outside++;

          if (name && first > last) growth.push({ keyword: name, from: first, to: last });
        }

        const topGrowth = growth.sort((a, b) => (b.from - b.to) - (a.from - a.to)).slice(0, 5);

        return new Response(
          JSON.stringify({ ...buckets, topGrowth }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "get-positions": {
        if (!isRecord(payload)) {
          return new Response(JSON.stringify({ error: "payload is required for get-positions" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const projectId = Number(payload.project_id);
        if (!Number.isFinite(projectId)) {
          return new Response(JSON.stringify({ error: "project_id must be a number" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        requestedProjectId = projectId;

        const directRegions = Array.isArray(payload.regions_indexes)
          ? payload.regions_indexes.map((v) => Number(v))
          : Array.isArray(payload.regions_index)
            ? payload.regions_index.map((v) => Number(v))
            : payload.region_index !== undefined
              ? [Number(payload.region_index)]
              : [];

        const availableRegionIndexes = await resolveRegionIndexes(projectId, headers);
        let regionsIndexes = uniqPositiveNumbers(directRegions);

        if (availableRegionIndexes.length > 0) {
          if (regionsIndexes.length === 0) {
            regionsIndexes = [availableRegionIndexes[0]];
          } else {
            const allowed = new Set(availableRegionIndexes);
            const filtered = regionsIndexes.filter((idx) => allowed.has(idx));
            regionsIndexes = filtered.length > 0 ? filtered : [availableRegionIndexes[0]];
          }
        }

        normalizedRegionsIndexes = regionsIndexes;

        const dates = Array.isArray(payload.dates)
          ? payload.dates.filter((d): d is string => typeof d === "string" && d.length > 0).slice(0, 2)
          : [payload.date1, payload.date2].filter((d): d is string => typeof d === "string" && d.length > 0);

        if (dates.length < 2) {
          return new Response(JSON.stringify({ error: "dates or date1/date2 are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const requestBody: JsonRecord = {
          project_id: String(projectId),
          dates: [dates[0], dates[1]],
          show_headers: payload.show_headers ?? 1,
          positions_fields: payload.positions_fields ?? ["position"],
        };

        if (regionsIndexes.length > 0) {
          requestBody.regions_indexes = regionsIndexes.map((idx) => String(idx));
        }

        url = `${TV_BASE}/get/positions_2/history`;
        fetchBody = JSON.stringify(requestBody);
        break;
      }

      case "get-rankings-history": {
        if (!isRecord(payload)) {
          return new Response(JSON.stringify({ error: "payload is required for get-rankings-history" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const rhProjectId = Number(payload.project_id);
        if (!Number.isFinite(rhProjectId)) {
          return new Response(JSON.stringify({ error: "project_id must be a number" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        requestedProjectId = rhProjectId;

        const rhRegions = Array.isArray(payload.regions_indexes)
          ? payload.regions_indexes.map((v) => Number(v))
          : [];

        const rhAvailable = await resolveRegionIndexes(rhProjectId, headers);
        let rhRegionsIndexes = uniqPositiveNumbers(rhRegions);

        if (rhAvailable.length > 0) {
          if (rhRegionsIndexes.length === 0) {
            rhRegionsIndexes = rhAvailable;
          } else {
            const allowed = new Set(rhAvailable);
            const filtered = rhRegionsIndexes.filter((idx) => allowed.has(idx));
            rhRegionsIndexes = filtered.length > 0 ? filtered : [rhAvailable[0]];
          }
        }

        normalizedRegionsIndexes = rhRegionsIndexes;

        const rhDateFrom = typeof payload.date_from === "string" ? payload.date_from : "";
        const rhDateTo = typeof payload.date_to === "string" ? payload.date_to : "";

        if (!rhDateFrom || !rhDateTo) {
          return new Response(JSON.stringify({ error: "date_from and date_to are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const rhBody: JsonRecord = {
          project_id: String(rhProjectId),
          date1: rhDateFrom,
          date2: rhDateTo,
          show_headers: 1,
          show_exists_dates: 1,
          positions_fields: ["position"],
        };

        if (rhRegionsIndexes.length > 0) {
          rhBody.regions_indexes = rhRegionsIndexes.map((idx) => String(idx));
        }

        url = `${TV_BASE}/get/positions_2/history`;
        fetchBody = JSON.stringify(rhBody);
        break;
      }

      case "get-keywords": {
        url = `${TV_BASE}/get/keywords_2/keywords`;
        fetchBody = JSON.stringify(payload || {});
        break;
      }

      case "test-connection":
        url = `${TV_BASE}/get/projects_2/projects`;
        fetchBody = JSON.stringify({ limit: 1 });
        break;

      case "run-check": {
        if (!isRecord(payload) || !payload.project_id) {
          return new Response(JSON.stringify({ error: "payload.project_id is required for run-check" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        url = `${TV_BASE}/edit/positions_2/checker/go`;
        fetchBody = JSON.stringify({ project_id: Number(payload.project_id) });
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const resp = await fetch(url, { method, headers, body: fetchBody });
    const data = await resp.json();

    if (!resp.ok || data?.errors?.length) {
      const topvisorCode = Number(data?.errors?.[0]?.code);

      // Fallback for access errors: try other available regions for the same project
      if (action === "get-positions" && topvisorCode === 54 && requestedProjectId) {
        const fallbackRegions = await resolveRegionIndexes(requestedProjectId, headers);
        const tried = new Set(normalizedRegionsIndexes);
        const retryBody = (() => {
          if (typeof fetchBody !== "string") return null;
          try {
            const parsed = JSON.parse(fetchBody);
            return isRecord(parsed) ? (parsed as JsonRecord) : null;
          } catch {
            return null;
          }
        })();

        if (retryBody) {
          for (const idx of fallbackRegions) {
            if (tried.has(idx)) continue;

            const nextBody: JsonRecord = {
              ...retryBody,
              regions_indexes: [String(idx)],
            };

            const retryResp = await fetch(url, {
              method,
              headers,
              body: JSON.stringify(nextBody),
            });
            const retryData = await retryResp.json();

            if (retryResp.ok && !retryData?.errors?.length) {
              return new Response(JSON.stringify(retryData), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }
      }

      const errMsg = data?.errors?.[0]?.string || data?.message || `Topvisor API error (${resp.status})`;
      const isAuthError = topvisorCode === 53 || topvisorCode === 54;
      return new Response(JSON.stringify({ error: errMsg, code: topvisorCode, raw: data }), {
        status: isAuthError ? 200 : (resp.status >= 400 ? resp.status : 502),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

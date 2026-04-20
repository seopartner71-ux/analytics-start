import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface ProjectStats {
  top10: number;
  avgPos: number;
  visibility: number;
  top10Delta: number;
  avgPosDelta: number;
  visibilityDelta: number;
}

function computeStats(result: any, regionsIndexes: number[]): ProjectStats {
  const keywords = Array.isArray(result?.result) ? result.result : [];
  if (!keywords.length) return { top10: 0, avgPos: 0, visibility: 0, top10Delta: 0, avgPosDelta: 0, visibilityDelta: 0 };

  // Extract all dates from headers
  const headers = result?.headers || {};
  const allDates: string[] = [];
  
  for (const regionKey of Object.keys(headers)) {
    const regionDates = headers[regionKey];
    if (typeof regionDates === "object" && regionDates) {
      for (const dateKey of Object.keys(regionDates)) {
        if (!allDates.includes(dateKey)) allDates.push(dateKey);
      }
    }
  }
  allDates.sort();

  const latestDate = allDates[allDates.length - 1];
  const prevDate = allDates.length > 1 ? allDates[allDates.length - 2] : null;

  if (!latestDate) return { top10: 0, avgPos: 0, visibility: 0, top10Delta: 0, avgPosDelta: 0, visibilityDelta: 0 };

  // Gather positions for each keyword on the latest and previous dates
  const latestPositions: number[] = [];
  const prevPositions: number[] = [];

  for (const kw of keywords) {
    const posData = kw.position || kw.positions || {};
    
    for (const regionKey of Object.keys(posData)) {
      const dates = posData[regionKey];
      if (typeof dates !== "object" || !dates) continue;

      const latestVal = parsePosition(dates[latestDate]);
      if (latestVal !== null) latestPositions.push(latestVal);

      if (prevDate) {
        const prevVal = parsePosition(dates[prevDate]);
        if (prevVal !== null) prevPositions.push(prevVal);
      }
    }
  }

  const currentStats = calcFromPositions(latestPositions);
  const prevStats = prevPositions.length > 0 ? calcFromPositions(prevPositions) : null;

  return {
    top10: currentStats.top10,
    avgPos: currentStats.avgPos,
    visibility: currentStats.visibility,
    top10Delta: prevStats ? currentStats.top10 - prevStats.top10 : 0,
    avgPosDelta: prevStats ? +(currentStats.avgPos - prevStats.avgPos).toFixed(1) : 0,
    visibilityDelta: prevStats ? +(currentStats.visibility - prevStats.visibility).toFixed(1) : 0,
  };
}

function parsePosition(val: any): number | null {
  if (val === null || val === undefined || val === "" || val === "n/a") return null;
  const obj = typeof val === "object" ? val : { position: val };
  const pos = Number(obj?.position ?? obj);
  return Number.isFinite(pos) && pos > 0 ? pos : null;
}

function calcFromPositions(positions: number[]) {
  if (!positions.length) return { top10: 0, avgPos: 0, visibility: 0 };
  const top10 = positions.filter((p) => p <= 10).length;
  const avgPos = +(positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1);
  // Visibility: % of keywords in top-50
  const inTop50 = positions.filter((p) => p <= 50).length;
  const visibility = positions.length > 0 ? +((inTop50 / positions.length) * 100).toFixed(0) : 0;
  return { top10, avgPos, visibility };
}

export function useProjectsStats(projects: Array<{ id: string; topvisor_api_key?: string | null; topvisor_user_id?: string | null; topvisor_project_id?: string | null }>) {
  const projectsWithTopvisor = projects.filter(
    (p) => p.topvisor_api_key && p.topvisor_user_id && p.topvisor_project_id
  );

  return useQuery({
    queryKey: ["projects-stats", projectsWithTopvisor.map((p) => p.id).join(",")],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const monthAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

      const results: Record<string, ProjectStats> = {};

      await Promise.all(
        projectsWithTopvisor.map(async (project) => {
          try {
            const { data, error } = await supabase.functions.invoke("topvisor-api", {
              body: {
                action: "get-rankings-history",
                api_key: project.topvisor_api_key,
                user_id: project.topvisor_user_id,
                payload: {
                  project_id: Number(project.topvisor_project_id),
                  date_from: monthAgo,
                  date_to: today,
                },
              },
            });

            if (!error && data && !data.error) {
              results[project.id] = computeStats(data, []);
            }
          } catch {
            // skip failed projects
          }
        })
      );

      return results;
    },
    enabled: projectsWithTopvisor.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

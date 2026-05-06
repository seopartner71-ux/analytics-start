import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Cfg {
  partner1_id?: string | null;
  partner2_id?: string | null;
  partner1_share?: number;
  partner2_share?: number;
}

export function PartnersSettingsEditor() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<Cfg>({ partner1_share: 50, partner2_share: 50 });

  const { data: profiles = [] } = useQuery({
    queryKey: ["partners-all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const { data: raw } = useQuery({
    queryKey: ["partners-config"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "partners_config").maybeSingle();
      return data?.value || null;
    },
  });

  useEffect(() => {
    if (!raw) return;
    try { setCfg(JSON.parse(raw)); } catch { /* noop */ }
  }, [raw]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const value = JSON.stringify(cfg);
      const { error } = await supabase.from("app_settings").upsert({ key: "partners_config", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Настройки сохранены");
      qc.invalidateQueries({ queryKey: ["partners-config"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sumOk = useMemo(() => (cfg.partner1_share ?? 0) + (cfg.partner2_share ?? 0) === 100, [cfg]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Партнёры (раздел прибыли)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PartnerField
            label="Партнёр 1"
            profileId={cfg.partner1_id ?? ""}
            share={cfg.partner1_share ?? 50}
            profiles={profiles}
            onProfile={(v) => setCfg({ ...cfg, partner1_id: v || null })}
            onShare={(v) => setCfg({ ...cfg, partner1_share: v, partner2_share: 100 - v })}
          />
          <PartnerField
            label="Партнёр 2"
            profileId={cfg.partner2_id ?? ""}
            share={cfg.partner2_share ?? 50}
            profiles={profiles}
            onProfile={(v) => setCfg({ ...cfg, partner2_id: v || null })}
            onShare={(v) => setCfg({ ...cfg, partner2_share: v, partner1_share: 100 - v })}
          />
        </div>
        {!sumOk && <p className="text-xs text-amber-500">Сумма долей должна быть 100%</p>}
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !sumOk} className="gap-1.5">
          <Save className="h-4 w-4" /> Сохранить
        </Button>
      </CardContent>
    </Card>
  );
}

function PartnerField({
  label, profileId, share, profiles, onProfile, onShare,
}: {
  label: string;
  profileId: string;
  share: number;
  profiles: { user_id: string; full_name: string | null; email: string }[];
  onProfile: (v: string) => void;
  onShare: (v: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>{label}</Label>
      <Select value={profileId} onValueChange={onProfile}>
        <SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Доля, %</Label>
        <Input
          type="number" min={0} max={100}
          value={share}
          onChange={(e) => onShare(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
        />
      </div>
    </div>
  );
}

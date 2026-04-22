import { ruError } from "@/lib/error-messages";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KEY = "ai_assistant_system_prompt";

export function AiAssistantSettings() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("app_settings").select("id, value").eq("key", KEY).maybeSingle()
      .then(({ data }) => {
        setValue((data as any)?.value || "");
        setRowId((data as any)?.id || null);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (rowId) {
        const { error } = await supabase.from("app_settings").update({ value }).eq("id", rowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("app_settings").insert({ key: KEY, value }).select("id").single();
        if (error) throw error;
        setRowId(data.id);
      }
      toast.success("Системный промт сохранён");
    } catch (e: any) {
      toast.error(ruError(e, "Не удалось сохранить настройки"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Системный промт AI-ассистента
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Этот промт определяет поведение AI-ассистента для джунов. К нему автоматически добавляются: стандарты компании
          из базы знаний (категория «Стандарты компании»), список доступных статей и текущие задачи пользователя.
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={16}
              className="font-mono text-xs"
              placeholder="Ты внутренний SEO-ассистент компании..."
            />
            <Button onClick={save} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Сохранение…" : "Сохранить промт"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

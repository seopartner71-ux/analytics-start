import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Tpl {
  id: string;
  month: number;
  week: number;
  title: string;
  assignee_role: string;
  sort_order: number;
  is_active: boolean;
}

const ROLES = [
  { value: "seo", label: "SEO" },
  { value: "manager", label: "Менеджер" },
  { value: "director", label: "Директор" },
];

function SortableRow({ tpl, onChange, onDelete }: { tpl: Tpl; onChange: (patch: Partial<Tpl>) => void; onDelete: () => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tpl.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded-md bg-card">
      <button {...attributes} {...listeners} className="text-muted-foreground hover:text-foreground cursor-grab"><GripVertical className="h-4 w-4" /></button>
      <Input value={tpl.title} onChange={(e) => onChange({ title: e.target.value })} className="h-8 text-[13px] flex-1" />
      <Input type="number" min={1} max={12} value={tpl.week} onChange={(e) => onChange({ week: Number(e.target.value) })} className="h-8 w-16 text-[12px]" placeholder="Нед." />
      <Select value={tpl.assignee_role} onValueChange={(v) => onChange({ assignee_role: v })}>
        <SelectTrigger className="h-8 w-32 text-[12px]"><SelectValue /></SelectTrigger>
        <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value} className="text-[12px]">{r.label}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

export function OnboardingTaskTemplateEditor() {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<string>("1");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("onboarding_task_templates").select("*").order("sort_order");
    setTpls((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g: Record<number, Tpl[]> = { 1: [], 2: [], 3: [] };
    tpls.forEach((t) => g[t.month]?.push(t));
    return g;
  }, [tpls]);

  const updateLocal = (id: string, patch: Partial<Tpl>) => {
    setTpls((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = grouped[Number(period)];
    const oldIdx = list.findIndex((t) => t.id === active.id);
    const newIdx = list.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(list, oldIdx, newIdx).map((t, i) => ({ ...t, sort_order: (Number(period) - 1) * 100 + i + 1 }));
    setTpls((cur) => {
      const others = cur.filter((t) => t.month !== Number(period));
      return [...others, ...reordered].sort((a, b) => a.sort_order - b.sort_order);
    });
  };

  const addTask = () => {
    const p = Number(period);
    const list = grouped[p];
    const lastWeek = list.length ? list[list.length - 1].week : (p - 1) * 4 + 1;
    const newTpl: Tpl = {
      id: crypto.randomUUID(),
      month: p,
      week: lastWeek,
      title: "Новая задача",
      assignee_role: "seo",
      sort_order: (p - 1) * 100 + list.length + 1,
      is_active: true,
    };
    setTpls((cur) => [...cur, newTpl]);
  };

  const deleteTask = (id: string) => {
    setTpls((cur) => cur.filter((t) => t.id !== id));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Полная замена: удаляем все и вставляем заново
      const { error: delErr } = await supabase.from("onboarding_task_templates").delete().not("id", "is", null);
      if (delErr) throw delErr;
      const rows = tpls.map((t) => ({
        month: t.month,
        week: t.week,
        title: t.title,
        assignee_role: t.assignee_role,
        sort_order: t.sort_order,
        is_active: true,
      }));
      const { error: insErr } = await supabase.from("onboarding_task_templates").insert(rows);
      if (insErr) throw insErr;
      toast.success("Шаблон сохранён. Применится к новым проектам.");
      load();
    } catch (e: any) {
      toast.error("Ошибка сохранения: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold">Шаблон задач онбординга</h3>
          <p className="text-[12px] text-muted-foreground">Изменения применяются только к новым проектам. Существующие не затрагиваются.</p>
        </div>
        <Button size="sm" onClick={saveAll} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Сохранить шаблон
        </Button>
      </div>

      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>
          {[1, 2, 3].map((p) => (
            <TabsTrigger key={p} value={String(p)} className="text-[13px]">
              Период {p} <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{(grouped[p] || []).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {[1, 2, 3].map((p) => (
          <TabsContent key={p} value={String(p)} className="mt-3">
            <Card className="p-3 space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={(grouped[p] || []).map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {(grouped[p] || []).map((t) => (
                    <SortableRow
                      key={t.id}
                      tpl={t}
                      onChange={(patch) => updateLocal(t.id, patch)}
                      onDelete={() => deleteTask(t.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <Button size="sm" variant="outline" className="w-full h-8 text-[12px]" onClick={addTask}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Добавить задачу в Период {p}
              </Button>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

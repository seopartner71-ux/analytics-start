import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Building2, Edit2 } from "lucide-react";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string;
  head_id: string | null;
  is_active: boolean;
}

const DEFAULT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
];

export function DepartmentsEditor() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Department[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members-for-dept"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, department_id")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (d: Partial<Department>) => {
      if (d.id) {
        const { error } = await supabase
          .from("departments")
          .update({
            name: d.name,
            description: d.description,
            color: d.color,
            head_id: d.head_id,
            is_active: d.is_active,
          })
          .eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert({
          name: d.name!,
          description: d.description || null,
          color: d.color || "#3B82F6",
          head_id: d.head_id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success(editing?.id ? "Отдел обновлён" : "Отдел создан");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Отдел удалён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const memberCount = (deptId: string) => members.filter((m: any) => m.department_id === deptId).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Отделы компании
        </CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({ id: "", name: "", description: "", color: "#3B82F6", head_id: null, is_active: true })}>
              <Plus className="h-4 w-4 mr-1" /> Создать отдел
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Редактировать отдел" : "Новый отдел"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Название *</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="SEO отдел"
                  />
                </div>
                <div>
                  <Label className="text-xs">Описание</Label>
                  <Input
                    value={editing.description || ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Руководитель</Label>
                  <Select
                    value={editing.head_id || "none"}
                    onValueChange={(v) => setEditing({ ...editing, head_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— не выбрано —</SelectItem>
                      {members.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Цвет</Label>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {DEFAULT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditing({ ...editing, color: c })}
                        className={`h-7 w-7 rounded-md border-2 transition-all ${editing.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={() => editing && upsert.mutate(editing)} disabled={!editing?.name?.trim() || upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : departments.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Отделы ещё не созданы. Создайте первый, чтобы группировать сотрудников.
          </div>
        ) : (
          <div className="space-y-2">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className="h-9 w-9 rounded-md flex items-center justify-center" style={{ backgroundColor: d.color + "20", color: d.color }}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{d.name}</div>
                  {d.description && <div className="text-xs text-muted-foreground truncate">{d.description}</div>}
                </div>
                <Badge variant="secondary" className="text-[10px]">{memberCount(d.id)} чел.</Badge>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Удалить отдел «${d.name}»? Сотрудники останутся, но без отдела.`)) {
                      remove.mutate(d.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Download, Trash2, Loader2, FileText, Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("sheet") || type.includes("excel")) return FileSpreadsheet;
  return FileText;
}

export function TaskAttachmentsBlock({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: files = [] } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const uploadFiles = async (list: FileList | File[]) => {
    if (!user) return;
    const arr = Array.from(list);
    setUploading(true);
    try {
      for (const file of arr) {
        if (file.size > MAX_SIZE) {
          toast.error(`«${file.name}» больше 10 МБ`);
          continue;
        }
        const path = `${taskId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("task-attachments")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("task-attachments")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const { error: insErr } = await supabase.from("task_attachments").insert({
          task_id: taskId,
          user_id: user.id,
          file_name: file.name,
          file_url: signed?.signedUrl || "",
          file_path: path,
          file_size: file.size,
          file_type: file.type || "application/octet-stream",
        });
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Файлы загружены");
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  };

  const remove = useMutation({
    mutationFn: async (f: any) => {
      await supabase.storage.from("task-attachments").remove([f.file_path]);
      const { error } = await supabase.from("task_attachments").delete().eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Файл удалён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (f: any) => {
    const { data } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(f.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <Card id="task-section-attachments" className="bg-card shadow-sm border-border/60 rounded-xl scroll-mt-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Файлы</span>
            <span className="text-xs text-muted-foreground">({files.length})</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Прикрепить
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-lg border border-dashed transition-colors p-3 text-center text-xs text-muted-foreground",
            dragOver ? "border-primary bg-primary/5 text-primary" : "border-border/60"
          )}
        >
          Перетащите файлы сюда (PDF, DOC, XLSX, PNG, JPG · до 10 МБ)
        </div>

        <div className="space-y-1">
          {files.map((f: any) => {
            const Icon = fileIcon(f.file_type);
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-muted/40 group"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{f.file_name}</div>
                  <div className="text-xs text-muted-foreground">{formatSize(f.file_size)}</div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => download(f)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {f.user_id === user?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => remove.mutate(f)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {files.length === 0 && (
            <div className="text-center py-3 text-xs text-muted-foreground/60">
              Файлы не прикреплены
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

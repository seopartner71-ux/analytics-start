import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AddProjectDialogProps {
  onAdd: (project: { name: string; url: string; description: string }) => void;
}

export function AddProjectDialog({ onAdd }: AddProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const { t } = useTranslation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      toast.error(t("addProjectDialog.required"));
      return;
    }
    onAdd({ name: name.trim(), url: url.trim(), description: description.trim() });
    setName("");
    setUrl("");
    setDescription("");
    setOpen(false);
    toast.success(t("addProjectDialog.success"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("dashboard.addProject")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addProjectDialog.title")}</DialogTitle>
          <DialogDescription>{t("addProjectDialog.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("addProjectDialog.name")} *</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("addProjectDialog.namePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-url">{t("addProjectDialog.site")} *</Label>
            <Input
              id="project-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("addProjectDialog.sitePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">{t("addProjectDialog.descriptionLabel")}</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("addProjectDialog.descriptionPlaceholder")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("addProjectDialog.logo")}</Label>
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/40 transition-colors">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">{t("addProjectDialog.logoHint")}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("addProjectDialog.cancel")}
            </Button>
            <Button type="submit">{t("addProjectDialog.create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Building } from "lucide-react";
import { toast } from "sonner";

const FIELDS: { key: keyof RequisitesRow; label: string; type?: string; col?: 1 | 2 }[] = [
  { key: "legal_name", label: "Название юр. лица (ООО / ИП)", col: 2 },
  { key: "inn", label: "ИНН" },
  { key: "kpp", label: "КПП" },
  { key: "ogrn", label: "ОГРН / ОГРНИП" },
  { key: "director_name", label: "Руководитель (ФИО)" },
  { key: "bank_name", label: "Название банка" },
  { key: "bik", label: "БИК" },
  { key: "account_number", label: "Расчётный счёт" },
  { key: "correspondent_account", label: "Корр. счёт" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Телефон" },
];

type RequisitesRow = {
  id?: string;
  legal_name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  director_name: string | null;
  bank_name: string | null;
  bik: string | null;
  account_number: string | null;
  correspondent_account: string | null;
  legal_address: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
};

export function CompanyRequisitesEditor() {
  const qc = useQueryClient();
  const [form, setForm] = useState<RequisitesRow>({
    legal_name: "", inn: null, kpp: null, ogrn: null, director_name: null,
    bank_name: null, bik: null, account_number: null, correspondent_account: null,
    legal_address: null, email: null, phone: null, logo_url: null,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data } = useQuery({
    queryKey: ["company_requisites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_requisites").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as RequisitesRow | null;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (form.id) {
        const { error } = await supabase.from("company_requisites").update(form).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error, data: inserted } = await supabase.from("company_requisites").insert(form).select().single();
        if (error) throw error;
        setForm(inserted as RequisitesRow);
      }
      toast.success("Реквизиты сохранены");
      qc.invalidateQueries({ queryKey: ["company_requisites"] });
    } catch (e: any) {
      toast.error(ruError(e, "Не удалось сохранить реквизиты"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `company-logo/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("finance-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("finance-files").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Логотип загружен");
    } catch (e: any) {
      toast.error(ruError(e, "Не удалось загрузить логотип"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building className="h-4 w-4" /> Реквизиты компании
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Эти реквизиты автоматически подставляются в счета и PDF-документы.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.col === 2 ? "md:col-span-2" : ""}>
              <Label className="text-sm">{f.label}</Label>
              <Input
                type={f.type || "text"}
                value={(form[f.key] as string) || ""}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="mt-1"
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <Label className="text-sm">Юридический адрес</Label>
            <Textarea
              value={form.legal_address || ""}
              onChange={(e) => setForm({ ...form, legal_address: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-sm">Логотип</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.logo_url && <img src={form.logo_url} alt="logo" className="h-12 w-12 object-contain border rounded" />}
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
              />
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Сохранение…" : "Сохранить реквизиты"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

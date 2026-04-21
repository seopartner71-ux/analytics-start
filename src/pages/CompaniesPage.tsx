import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Building2, Globe, Phone, Mail, MapPin, Users, ArrowUpRight, Calendar, FileText, TrendingUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Company = Tables<"companies"> & {
  responsible?: Tables<"team_members"> | null;
  deals?: Tables<"deals">[];
};

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 avatar-ring ${className}`}>
      {initials}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ─── Add Company Dialog ─── */
function AddCompanyDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "Клиент", industry: "", website: "", phone: "", email: "", address: "", inn: "", description: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").insert({
        ...form,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Компания создана");
      setOpen(false);
      setForm({ name: "", type: "Клиент", industry: "", website: "", phone: "", email: "", address: "", inn: "", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shrink-0 shadow-sm">
          <Plus className="h-4 w-4" /> Создать
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Новая компания</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Название *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Тип</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Клиент">Клиент</SelectItem>
                  <SelectItem value="Партнёр">Партнёр</SelectItem>
                  <SelectItem value="Лид">Лид</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Отрасль</Label><Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} /></div>
            <div><Label className="text-xs">Сайт</Label><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Телефон</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label className="text-xs">E-Mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div><Label className="text-xs">Адрес</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <div><Label className="text-xs">ИНН</Label><Input value={form.inn} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))} /></div>
          <div><Label className="text-xs">Описание</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <Button onClick={() => mutation.mutate()} disabled={!form.name.trim() || mutation.isPending} className="w-full">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Создать компанию
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Company Detail Sheet ─── */
function CompanyDetailSheet({ company, open, onClose }: { company: Company | null; open: boolean; onClose: () => void }) {
  if (!company) return null;

  const dealCount = company.deals?.length || 0;
  const totalAmount = company.deals?.reduce((s, d) => s + (d.amount || 0), 0) || 0;
  const latestDealStatus = company.deals?.[0]?.status || "—";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[80vw] md:max-w-[80vw] p-0 overflow-y-auto" side="right">
        <SheetHeader className="p-0">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative px-6 py-6 flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center text-2xl font-bold text-primary shadow-sm">
                {company.logo || getInitials(company.name)}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl font-bold tracking-tight">{company.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="outline" className="text-[10px] font-medium">{company.type}</Badge>
                  {company.industry && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{company.industry}</span>
                    </>
                  )}
                </div>
              </div>
              {company.website && (
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                  <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight className="h-3.5 w-3.5" /> {company.website}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="general" className="px-6 pb-6">
          <TabsList className="mb-6 bg-muted/50 p-1 h-auto">
            <TabsTrigger value="general" className="text-xs px-4 py-1.5">Общие</TabsTrigger>
            <TabsTrigger value="deals" className="text-xs px-4 py-1.5">Сделки ({dealCount})</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs px-4 py-1.5">Проекты</TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-4 py-1.5">История</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-5 mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">О компании</h3>
                {company.description && <p className="text-sm text-foreground/80 leading-relaxed mb-5">{company.description}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.website && <InfoRow icon={<Globe className="h-4 w-4" />} label="Сайт" value={company.website} />}
                  {company.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Телефон" value={company.phone} />}
                  {company.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="E-Mail" value={company.email} />}
                  {company.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Адрес" value={company.address} />}
                  {company.industry && <InfoRow icon={<Building2 className="h-4 w-4" />} label="Отрасль" value={company.industry} />}
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Сотрудников" value={String(company.employee_count || 0)} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Дополнительно</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.inn && <InfoRow icon={<FileText className="h-4 w-4" />} label="ИНН" value={company.inn} />}
                  {company.responsible && <InfoRow icon={<Users className="h-4 w-4" />} label="Ответственный" value={company.responsible.full_name} />}
                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Дата создания" value={new Date(company.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals" className="mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                {dealCount > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-6 mb-4">
                      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold tracking-tight text-foreground">{totalAmount.toLocaleString("ru-RU")} ₽</p>
                        <p className="text-sm text-muted-foreground">{dealCount} сделок</p>
                      </div>
                    </div>
                    {company.deals?.map(d => (
                      <div key={d.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <span className="text-sm font-medium text-foreground">{d.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{(d.amount || 0).toLocaleString("ru-RU")} ₽</span>
                          <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm">Нет сделок</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6 text-center text-muted-foreground py-12">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium">Проекты компании будут отображены здесь</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6 text-center text-muted-foreground py-12">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium">История взаимодействий</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 group">
      <span className="text-muted-foreground/60 mt-0.5 group-hover:text-primary transition-colors">{icon}</span>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, responsible:team_members(*), deals(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });

  // Финансовые "сделки": оплаченные счета + платежи по имени клиента
  const { data: finance } = useQuery({
    queryKey: ["companies-finance-stats"],
    queryFn: async () => {
      const [inv, pay] = await Promise.all([
        supabase.from("invoices").select("client_name, amount, status"),
        supabase.from("financial_payments").select("client_name, contract_amount, paid_amount, status"),
      ]);
      return { invoices: inv.data || [], payments: pay.data || [] };
    },
  });

  const statsByName = new Map<string, { count: number; sum: number; status: string }>();
  const addStat = (name: string, sum: number, status: string) => {
    const k = (name || "").trim().toLowerCase();
    if (!k) return;
    const cur = statsByName.get(k) || { count: 0, sum: 0, status };
    cur.count += 1;
    cur.sum += Number(sum) || 0;
    cur.status = status || cur.status;
    statsByName.set(k, cur);
  };
  (finance?.invoices || []).forEach((i: any) => addStat(i.client_name, i.amount, i.status));
  (finance?.payments || []).forEach((p: any) => addStat(p.client_name, p.paid_amount || p.contract_amount, p.status));

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.responsible?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Компании</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего: <span className="font-medium text-foreground">{companies.length}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск компании..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/30 border-border/60 focus:bg-card transition-colors" />
          </div>
          <AddCompanyDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Нет компаний. Создайте первую!</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="crm-table min-w-[700px]">
            <thead>
              <tr>
                <th className="w-10"><Checkbox /></th>
                <th>Компания</th>
                <th>Сделки / Статус</th>
                <th>Ответственный</th>
                <th>Дата создания</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((c, i) => {
                  const finStat = statsByName.get(c.name.trim().toLowerCase());
                  const dealCount = (c.deals?.length || 0) + (finStat?.count || 0);
                  const totalSum = (c.deals?.reduce((s, d) => s + (d.amount || 0), 0) || 0) + (finStat?.sum || 0);
                  const latestStatus = c.deals?.[0]?.status || finStat?.status || "—";
                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      onClick={() => setSelectedCompany(c)}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 ring-1 ring-primary/10">
                            {c.logo || getInitials(c.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">{c.type}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <p className="text-sm text-foreground font-medium">
                            {dealCount} {dealCount === 1 ? "сделка" : dealCount >= 2 && dealCount <= 4 ? "сделки" : "сделок"}
                          </p>
                          {totalSum > 0 && (
                            <p className="text-[11px] text-muted-foreground">{totalSum.toLocaleString("ru-RU")} ₽</p>
                          )}
                          <Badge variant="secondary" className="text-[10px] font-medium">{latestStatus}</Badge>
                        </div>
                      </td>
                      <td>
                        {c.responsible ? (
                          <div className="flex items-center gap-2">
                            <AvatarCircle initials={getInitials(c.responsible.full_name)} className="h-7 w-7" />
                            <span className="text-sm text-foreground">{c.responsible.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20"
          >
            <span className="text-sm text-muted-foreground">Отмечено: <span className="font-semibold text-foreground">{selected.size}</span></span>
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">Применить</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <CompanyDetailSheet company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  );
}

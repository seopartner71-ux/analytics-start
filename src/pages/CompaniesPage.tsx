import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Building2, Globe, Phone, Mail, MapPin, Users, ArrowUpRight, Calendar, FileText, TrendingUp } from "lucide-react";
import { COMPANIES, Company } from "@/data/crm-mock";
import { motion, AnimatePresence } from "framer-motion";

function AvatarCircle({ initials, className = "", color }: { initials: string; className?: string; color?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 avatar-ring ${className}`}
      style={color ? { backgroundColor: `${color}20`, color } : {}}
    >
      {initials}
    </div>
  );
}

/* ─── Company Detail Sheet ─── */
function CompanyDetailSheet({ company, open, onClose }: { company: Company | null; open: boolean; onClose: () => void }) {
  if (!company) return null;

  const statusColor = company.deals.status === "В работе"
    ? "hsl(var(--primary))"
    : company.deals.status === "Согласование"
      ? "hsl(var(--warning))"
      : company.deals.status === "Закрыта"
        ? "hsl(var(--success))"
        : "hsl(var(--muted-foreground))";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[80vw] md:max-w-[80vw] p-0 overflow-y-auto" side="right">
        {/* Header with gradient accent */}
        <SheetHeader className="p-0">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative px-6 py-6 flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center text-2xl font-bold text-primary shadow-sm">
                {company.logo}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl font-bold tracking-tight">{company.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium"
                    style={{ borderColor: statusColor, color: statusColor }}
                  >
                    {company.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{company.industry}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                <ArrowUpRight className="h-3.5 w-3.5" /> {company.website}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="general" className="px-6 pb-6">
          <TabsList className="mb-6 bg-muted/50 p-1 h-auto">
            <TabsTrigger value="general" className="text-xs px-4 py-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">Общие</TabsTrigger>
            <TabsTrigger value="deals" className="text-xs px-4 py-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">Сделки</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs px-4 py-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">Проекты</TabsTrigger>
            <TabsTrigger value="history" className="text-xs px-4 py-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">История</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-5 mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">О компании</h3>
                <p className="text-sm text-foreground/80 leading-relaxed mb-5">{company.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={<Globe className="h-4 w-4" />} label="Сайт" value={company.website} isLink />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Телефон" value={company.phone} />
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="E-Mail" value={company.email} />
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Адрес" value={company.address} />
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Отрасль" value={company.industry} />
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Сотрудников" value={String(company.employees)} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Дополнительно</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={<FileText className="h-4 w-4" />} label="ИНН" value={company.inn} />
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Ответственный" value={company.responsible.name} />
                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Дата создания" value={new Date(company.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals" className="mt-0">
            <Card className="border-border/60 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold tracking-tight text-foreground">{company.deals.amount}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{company.deals.count} сделок</span>
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: statusColor, color: statusColor }}>
                        {company.deals.status}
                      </Badge>
                    </div>
                  </div>
                </div>
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

function InfoRow({ icon, label, value, isLink }: { icon: React.ReactNode; label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex items-start gap-3 group">
      <span className="text-muted-foreground/60 mt-0.5 group-hover:text-primary transition-colors">{icon}</span>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium ${isLink ? "text-primary hover:underline cursor-pointer" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = COMPANIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.responsible.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Компании</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего: <span className="font-medium text-foreground">{COMPANIES.length}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск компании..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/30 border-border/60 focus:bg-card transition-colors" />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0 shadow-sm">
            <Plus className="h-4 w-4" /> Создать
          </Button>
        </div>
      </div>

      {/* Table */}
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
              {filtered.map((c, i) => (
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
                        {c.logo}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.type}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <p className="text-sm text-foreground font-medium">{c.deals.count} сделок</p>
                      <Badge variant="secondary" className="text-[10px] font-medium">{c.deals.status}</Badge>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <AvatarCircle initials={c.responsible.avatar} className="h-7 w-7" />
                      <span className="text-sm text-foreground">{c.responsible.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Selection bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20"
          >
            <span className="text-sm text-muted-foreground">Отмечено: <span className="font-semibold text-foreground">{selected.size}</span> / {COMPANIES.length}</span>
            <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">Применить</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <CompanyDetailSheet company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  );
}

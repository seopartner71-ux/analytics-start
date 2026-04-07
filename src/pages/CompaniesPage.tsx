import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Building2, Globe, Phone, Mail, MapPin, Users } from "lucide-react";
import { COMPANIES, Company } from "@/data/crm-mock";

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

function CompanyDetailSheet({ company, open, onClose }: { company: Company | null; open: boolean; onClose: () => void }) {
  if (!company) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[80vw] md:max-w-[80vw] p-0 overflow-y-auto" side="right">
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {company.logo}
            </div>
            <div>
              <SheetTitle className="text-xl">{company.name}</SheetTitle>
              <Badge variant="secondary" className="mt-1">{company.type}</Badge>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="general" className="p-6">
          <TabsList className="mb-6">
            <TabsTrigger value="general">Общие</TabsTrigger>
            <TabsTrigger value="deals">Сделки</TabsTrigger>
            <TabsTrigger value="projects">Проекты</TabsTrigger>
            <TabsTrigger value="history">История</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">О компании</h3>
                <p className="text-sm text-foreground mb-4">{company.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={<Globe className="h-4 w-4" />} label="Сайт" value={company.website} />
                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Телефон" value={company.phone} />
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="E-Mail" value={company.email} />
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Адрес" value={company.address} />
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Отрасль" value={company.industry} />
                  <InfoRow icon={<Users className="h-4 w-4" />} label="Сотрудников" value={String(company.employees)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Дополнительно</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={null} label="ИНН" value={company.inn} />
                  <InfoRow icon={null} label="Ответственный" value={company.responsible.name} />
                  <InfoRow icon={null} label="Дата создания" value={company.createdAt} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            <Card>
              <CardContent className="p-5">
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-lg font-medium mb-1">Сделки: {company.deals.count}</p>
                  <p>Статус: {company.deals.status}</p>
                  <p className="text-xl font-semibold text-foreground mt-2">{company.deals.amount}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card><CardContent className="p-5 text-center text-muted-foreground py-8">Проекты компании будут отображены здесь</CardContent></Card>
          </TabsContent>
          <TabsContent value="history">
            <Card><CardContent className="p-5 text-center text-muted-foreground py-8">История взаимодействий</CardContent></Card>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Компании</h1>
          <p className="text-sm text-muted-foreground">Всего: {COMPANIES.length}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск компании..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Создать
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 p-3"><Checkbox /></th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Компания</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Сделки / Статус</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Ответственный</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Дата создания</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelectedCompany(c)}>
                <td className="p-3" onClick={e => e.stopPropagation()}>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {c.logo}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.type}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div>
                    <p className="text-sm text-foreground">{c.deals.count} сделок</p>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">{c.deals.status}</Badge>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <AvatarCircle initials={c.responsible.avatar} className="h-7 w-7" />
                    <span className="text-sm text-foreground">{c.responsible.name}</span>
                  </div>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{c.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">Отмечено: {selected.size} / {COMPANIES.length}</span>
          <Button variant="outline" size="sm">Применить</Button>
        </div>
      )}

      <CompanyDetailSheet company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  );
}

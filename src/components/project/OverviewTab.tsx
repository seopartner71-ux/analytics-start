import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, LineChart, Globe } from "lucide-react";

interface ServiceCardProps {
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  onConnect: () => void;
}

function ServiceCard({ name, icon, connected, onConnect }: ServiceCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            {icon}
          </div>
          <span className="font-medium text-foreground">{name}</span>
        </div>
        {connected ? (
          <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
            {t("project.services.connected")}
          </Badge>
        ) : (
          <Button variant="outline" size="sm" onClick={onConnect}>
            {t("project.services.connect")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface OverviewTabProps {
  services: { yandexMetrika: boolean; ga4: boolean; webmaster: boolean };
  onToggleService: (key: string) => void;
}

export function OverviewTab({ services, onToggleService }: OverviewTabProps) {
  const { t } = useTranslation();

  const serviceList = [
    { key: "yandexMetrika", name: t("project.services.yandexMetrika"), icon: <BarChart3 className="h-5 w-5 text-muted-foreground" /> },
    { key: "ga4", name: t("project.services.ga4"), icon: <LineChart className="h-5 w-5 text-muted-foreground" /> },
    { key: "webmaster", name: t("project.services.webmaster"), icon: <Globe className="h-5 w-5 text-muted-foreground" /> },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("project.services.title")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {serviceList.map((s) => (
          <ServiceCard
            key={s.key}
            name={s.name}
            icon={s.icon}
            connected={services[s.key as keyof typeof services]}
            onConnect={() => onToggleService(s.key)}
          />
        ))}
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDateRange, type TrafficChannel } from "@/contexts/DateRangeContext";
import { Filter } from "lucide-react";

const CHANNELS: TrafficChannel[] = ["all", "organic", "direct", "referral", "social", "ad"];

export function ChannelFilter() {
  const { t } = useTranslation();
  const { channel, setChannel } = useDateRange();

  return (
    <Select value={channel} onValueChange={(v) => setChannel(v as TrafficChannel)}>
      <SelectTrigger className="w-[160px] h-8 text-xs">
        <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CHANNELS.map((ch) => (
          <SelectItem key={ch} value={ch}>
            {t(`channels.${ch}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

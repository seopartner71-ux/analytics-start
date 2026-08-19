import { CashTransferBlock } from "@/components/finance/CashTransferBlock";
import { PageTitle } from "@/components/finance/primitives";

export default function CashPage() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <PageTitle title="Касса" subtitle="Пополнение кассы и переводы между счетами" />
      <CashTransferBlock />
    </div>
  );
}

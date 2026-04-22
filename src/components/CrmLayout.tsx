import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { AiAssistantFab } from "@/components/ai/AiAssistantFab";
import { MessengerPanel } from "@/components/messenger/MessengerPanel";
import { MessengerProvider } from "@/contexts/MessengerContext";
import { useSilentTimeTracker } from "@/hooks/useSilentTimeTracker";

export function CrmLayout({ children }: { children: ReactNode }) {
  useSilentTimeTracker();
  return (
    <SidebarProvider>
      <MessengerProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 md:pr-14">
            <PageHeader />
            <main className="flex-1 p-3 sm:p-4 md:p-6 animate-in fade-in duration-300 overflow-x-hidden">
              {children}
            </main>
          </div>
          <AiAssistantFab />
          <MessengerPanel />
        </div>
      </MessengerProvider>
    </SidebarProvider>
  );
}

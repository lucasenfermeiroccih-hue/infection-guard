import { createFileRoute, Outlet, redirect, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Plus, LogOut } from "lucide-react";
import { STORAGE_KEYS, readLS, removeLS } from "@/lib/storage";
import type { Session } from "@/lib/types";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/kanban": "Quadro Kanban",
  "/actions": "Ações 5W2H",
  "/actions/new": "Nova Ação 5W2H",
  "/reports": "Relatórios",
  "/settings": "Configurações",
};

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const s = readLS<Session | null>(STORAGE_KEYS.session, null);
    if (!s) throw redirect({ to: "/" });
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[path] ?? (path.startsWith("/actions/") ? "Detalhes da Ação" : "CCIH 5W2H");

  const logout = () => {
    removeLS(STORAGE_KEYS.session);
    navigate({ to: "/" });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-background flex items-center gap-2 px-3 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-base font-semibold flex-1 truncate">{title}</h1>
            <Button asChild size="sm">
              <Link to="/actions/new"><Plus className="h-4 w-4 mr-1" />Nova Ação</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-1" />Sair
            </Button>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

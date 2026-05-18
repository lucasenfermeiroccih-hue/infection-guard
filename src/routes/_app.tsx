import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Plus, LogOut } from "lucide-react";
import { STORAGE_KEYS, removeLS, writeLS } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/kanban-api";
import { AppContext } from "@/lib/app-context";
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
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const title = titles[path] ?? (path.startsWith("/actions/") ? "Detalhes da Ação" : "CCIH 5W2H");
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        removeLS(STORAGE_KEYS.session);
        navigate({ to: "/" });
      } else {
        const local: Session = {
          userId: session.user.id,
          name: session.user.email ?? "Usuário",
          role: "ccih",
        };
        writeLS(STORAGE_KEYS.session, local);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/" });
      } else {
        setUserId(data.session.user.id);
        checkIsAdmin().then(setIsAdmin);
        setChecked(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    removeLS(STORAGE_KEYS.session);
    navigate({ to: "/" });
  };

  if (!checked) return null;

  return (
    <AppContext.Provider value={{ isAdmin, userId }}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-muted/30">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 border-b bg-background flex items-center gap-2 px-3 sticky top-0 z-10">
              <SidebarTrigger />
              <h1 className="text-base font-semibold flex-1 truncate">{title}</h1>
              {path !== "/kanban" && (
                <Button asChild size="sm">
                  <Link to="/actions/new"><Plus className="h-4 w-4 mr-1" />Nova Ação</Link>
                </Button>
              )}
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
    </AppContext.Provider>
  );
}

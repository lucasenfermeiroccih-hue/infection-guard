import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, KanbanSquare, ListChecks, FileText, Settings, LogOut, ShieldCheck } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { STORAGE_KEYS, removeLS, readLS } from "@/lib/storage";
import type { Session } from "@/lib/types";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Kanban", url: "/kanban", icon: KanbanSquare },
  { title: "Ações 5W2H", url: "/actions", icon: ListChecks },
  { title: "Relatórios", url: "/reports", icon: FileText },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const session = typeof window !== "undefined" ? readLS<Session | null>(STORAGE_KEYS.session, null) : null;

  const isActive = (u: string) => path === u || path.startsWith(u + "/");

  const logout = () => {
    removeLS(STORAGE_KEYS.session);
    navigate({ to: "/" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-8 w-8 rounded-md bg-primary/10 grid place-items-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-sm font-semibold">CCIH 5W2H</div>
              <div className="text-xs text-muted-foreground">Controle de Infecção</div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url} className="flex items-center gap-2">
                      <it.icon className="h-4 w-4" />
                      {!collapsed && <span>{it.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && session && (
          <div className="px-2 pb-1 text-xs text-muted-foreground">
            <div className="font-medium text-foreground truncate">{session.name}</div>
            <div className="capitalize">{session.role}</div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

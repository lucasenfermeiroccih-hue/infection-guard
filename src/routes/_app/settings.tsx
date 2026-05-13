import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STORAGE_KEYS, readLS, writeLS } from "@/lib/storage";
import type { AppSettings, Role, User } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — CCIH 5W2H" },
      { name: "description", content: "Gestão de acessos granulares (RBAC) e parâmetros do sistema." },
    ],
  }),
  component: SettingsPage,
});

const ROLE_LABEL: Record<Role, string> = {
  ccih: "CCIH",
  diretoria: "Diretoria",
  assistencial: "Assistencial",
};

function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ notifyEmail: true, notifyPush: false });

  useEffect(() => {
    setUsers(readLS<User[]>(STORAGE_KEYS.users, []));
    setSettings(readLS<AppSettings>(STORAGE_KEYS.settings, { notifyEmail: true, notifyPush: false }));
  }, []);

  const updateRole = (id: string, role: Role) => {
    const next = users.map((u) => u.id === id ? { ...u, role } : u);
    setUsers(next); writeLS(STORAGE_KEYS.users, next);
    toast.success("Permissão atualizada");
  };

  const updateSetting = (k: keyof AppSettings, v: boolean) => {
    const next = { ...settings, [k]: v };
    setSettings(next); writeLS(STORAGE_KEYS.settings, next);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold">Configurações</h2>
        <p className="text-sm text-muted-foreground">Permissões da equipe e preferências de notificação.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários e Permissões (RBAC)</CardTitle>
          <CardDescription>Defina níveis de acesso por perfil.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-48">Permissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => updateRole(u.id, v as Role)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["ccih", "diretoria", "assistencial"] as Role[]).map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificações de Alerta</CardTitle>
          <CardDescription>Configurar avisos para atrasos e prazos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Notificações por e-mail</Label>
              <p className="text-xs text-muted-foreground">Receber alertas no e-mail institucional.</p>
            </div>
            <Switch checked={settings.notifyEmail} onCheckedChange={(v) => updateSetting("notifyEmail", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Notificações push</Label>
              <p className="text-xs text-muted-foreground">Avisos em tempo real no navegador.</p>
            </div>
            <Switch checked={settings.notifyPush} onCheckedChange={(v) => updateSetting("notifyPush", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

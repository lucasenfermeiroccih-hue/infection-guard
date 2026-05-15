import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users, Building2, ShieldCheck } from "lucide-react";
import { STORAGE_KEYS, readLS, writeLS } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { useAppCtx } from "@/lib/app-context";
import type { AppSettings } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — CCIH 5W2H" },
      { name: "description", content: "Usuários do hospital e preferências do sistema." },
    ],
  }),
  component: SettingsPage,
});

// ─── Role labels (mirror of IRASControl) ────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  hospital_admin: "Administrador",
  nurse_ccih: "Enfermeiro(a) CCIH",
  doctor: "Médico(a)",
  doctor_scih: "Médico(a) SCIH",
  nurse_tech_scih: "Téc. Enf. SCIH",
  lab_tech: "Técnico Lab.",
  biologist: "Biólogo(a)",
  administrative: "Administrativo",
  viewer: "Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-50 text-red-700 border-red-200",
  hospital_admin: "bg-primary/10 text-primary border-primary/30",
  nurse_ccih: "bg-blue-50 text-blue-700 border-blue-200",
  doctor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  doctor_scih: "bg-emerald-50 text-emerald-800 border-emerald-200",
  nurse_tech_scih: "bg-blue-50 text-blue-800 border-blue-200",
  lab_tech: "bg-amber-50 text-amber-700 border-amber-200",
  biologist: "bg-purple-50 text-purple-700 border-purple-200",
  administrative: "bg-slate-100 text-slate-700 border-slate-200",
  viewer: "bg-muted text-muted-foreground border-border",
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface HospitalMember {
  userId: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  roles: string[];
}

interface HospitalInfo {
  name: string;
  city: string;
  bedCount: number | null;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const { isAdmin } = useAppCtx();
  const [members, setMembers] = useState<HospitalMember[]>([]);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(
    readLS<AppSettings>(STORAGE_KEYS.settings, { notifyEmail: true, notifyPush: false })
  );

  const hospitalId = typeof window !== "undefined"
    ? localStorage.getItem("selected_hospital_id")
    : null;

  useEffect(() => {
    if (!hospitalId) { setLoading(false); return; }

    const load = async () => {
      try {
        // Load hospital info
        const { data: hosp } = await (supabase
          .from("hospitals")
          .select("name, city, bed_count")
          .eq("id", hospitalId)
          .maybeSingle() as any);

        if (hosp) {
          setHospital({ name: hosp.name, city: hosp.city, bedCount: hosp.bed_count });
        }

        // Load hospital users with profiles and roles
        const { data: huData } = await (supabase
          .from("hospital_users")
          .select("user_id, is_primary_admin")
          .eq("hospital_id", hospitalId) as any);

        if (!huData?.length) { setLoading(false); return; }

        const userIds = huData.map((r: any) => r.user_id);
        const adminMap = new Map(huData.map((r: any) => [r.user_id, r.is_primary_admin]));

        const [{ data: profiles }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds) as any,
          supabase.from("user_roles").select("user_id, role").in("user_id", userIds) as any,
        ]);

        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        const rolesMap = new Map<string, string[]>();
        for (const r of roles ?? []) {
          const arr = rolesMap.get(r.user_id) ?? [];
          arr.push(r.role);
          rolesMap.set(r.user_id, arr);
        }

        const list: HospitalMember[] = userIds.map((uid: string) => {
          const profile = profileMap.get(uid) as any;
          return {
            userId: uid,
            fullName: profile?.full_name ?? "—",
            email: profile?.email ?? "—",
            isAdmin: adminMap.get(uid) === true,
            roles: rolesMap.get(uid) ?? [],
          };
        });

        // Sort: admins first, then alphabetically
        list.sort((a, b) => {
          if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
          return a.fullName.localeCompare(b.fullName);
        });

        setMembers(list);
      } catch (e: any) {
        toast.error("Erro ao carregar usuários: " + (e?.message ?? ""));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [hospitalId]);

  const updateSetting = (k: keyof AppSettings, v: boolean) => {
    const next = { ...settings, [k]: v };
    setSettings(next);
    writeLS(STORAGE_KEYS.settings, next);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold">Configurações</h2>
        <p className="text-sm text-muted-foreground">Equipe do hospital e preferências do sistema.</p>
      </div>

      {/* Hospital info */}
      {hospital && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Unidade Hospitalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Hospital</p>
                <p className="font-semibold">{hospital.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cidade</p>
                <p className="font-semibold">{hospital.city}</p>
              </div>
              {hospital.bedCount != null && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Leitos</p>
                  <p className="font-semibold">{hospital.bedCount}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Equipe do Hospital
          </CardTitle>
          <CardDescription>
            Usuários cadastrados na unidade via IRASControl.
            {!isAdmin && " Apenas administradores podem gerenciar acessos."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Carregando usuários...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {hospitalId
                ? "Nenhum usuário encontrado nesta unidade."
                : "Nenhuma unidade selecionada. Acesse via IRASControl para sincronizar."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cargo / Perfil</TableHead>
                  <TableHead className="w-32 text-center">Acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {m.fullName}
                        {m.isAdmin && (
                          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" title="Administrador principal" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.roles.length > 0
                          ? m.roles.map((r) => (
                              <Badge
                                key={r}
                                variant="outline"
                                className={`text-[11px] font-medium ${ROLE_COLORS[r] ?? ""}`}
                              >
                                {ROLE_LABELS[r] ?? r}
                              </Badge>
                            ))
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={m.isAdmin
                          ? "bg-primary/10 text-primary border-primary/30 text-[11px]"
                          : "bg-muted text-muted-foreground text-[11px]"}
                      >
                        {m.isAdmin ? "Admin" : "Membro"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações de Alerta</CardTitle>
          <CardDescription>Configurar avisos para atrasos e prazos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Notificações por e-mail</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Receber alertas no e-mail cadastrado.</p>
            </div>
            <Switch
              checked={settings.notifyEmail}
              onCheckedChange={(v) => updateSetting("notifyEmail", v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Notificações push</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Avisos em tempo real no navegador.</p>
            </div>
            <Switch
              checked={settings.notifyPush}
              onCheckedChange={(v) => updateSetting("notifyPush", v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

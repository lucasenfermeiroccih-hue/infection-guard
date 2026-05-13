import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2 } from "lucide-react";
import { STORAGE_KEYS, readLS, writeLS } from "@/lib/storage";
import type { Action5W2H, ActionStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/actions/$id")({
  head: () => ({ meta: [{ title: "Detalhes da Ação — CCIH" }] }),
  component: ActionDetail,
});

const STATUS_LABEL: Record<ActionStatus, string> = {
  planejado: "Planejado", em_andamento: "Em Andamento", concluido: "Concluído",
};

function ActionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [action, setAction] = useState<Action5W2H | null>(null);

  useEffect(() => {
    const all = readLS<Action5W2H[]>(STORAGE_KEYS.actions, []);
    setAction(all.find((a) => a.id === id) ?? null);
  }, [id]);

  if (!action) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Ação não encontrada.</p>
        <Button asChild variant="link"><Link to="/actions">Voltar</Link></Button>
      </div>
    );
  }

  const updateStatus = (s: ActionStatus) => {
    const all = readLS<Action5W2H[]>(STORAGE_KEYS.actions, []);
    const next = all.map((a) => a.id === id ? { ...a, status: s } : a);
    writeLS(STORAGE_KEYS.actions, next);
    setAction({ ...action, status: s });
    toast.success("Status atualizado");
  };

  const remove = () => {
    if (!confirm("Remover esta ação?")) return;
    const all = readLS<Action5W2H[]>(STORAGE_KEYS.actions, []);
    writeLS(STORAGE_KEYS.actions, all.filter((a) => a.id !== id));
    toast.success("Ação removida");
    navigate({ to: "/actions" });
  };

  const rows: [string, string][] = [
    ["What — O quê", action.what],
    ["Why — Por quê", action.why],
    ["Where — Onde", action.where],
    ["Who — Quem", action.who],
    ["When — Quando", action.when],
    ["How — Como", action.how],
    ["How Much — Quanto", action.howMuch || "—"],
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild><Link to="/actions"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{action.what}</CardTitle>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{action.infectionType}</Badge>
              <Badge>{STATUS_LABEL[action.status]}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={action.status} onValueChange={(v) => updateStatus(v as ActionStatus)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["planejado", "em_andamento", "concluido"] as ActionStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="destructive" size="icon" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-3">
                <dt className="text-sm font-medium text-muted-foreground">{k}</dt>
                <dd className="col-span-2 text-sm">{v}</dd>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-4 py-3">
              <dt className="text-sm font-medium text-muted-foreground">Criada em</dt>
              <dd className="col-span-2 text-sm">{new Date(action.createdAt).toLocaleString("pt-BR")}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

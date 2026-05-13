import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ListChecks,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Clock,
  CircleDashed,
  Flame,
  KanbanSquare,
} from "lucide-react";
import { STORAGE_KEYS, readLS } from "@/lib/storage";
import { listActions } from "@/lib/actions-api";
import type { Action5W2H, KanbanBoard } from "@/lib/types";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CCIH 5W2H" },
      {
        name: "description",
        content:
          "Indicadores de conclusão, andamento e tarefas das ferramentas Kanban e 5W2H.",
      },
    ],
  }),
  component: DashboardPage,
});

type ColTone = "todo" | "doing" | "done" | "other";

function classifyColumn(title: string): ColTone {
  const t = title.toLowerCase();
  if (/(a fazer|tarefa a fazer|todo|planejad|backlog)/.test(t)) return "todo";
  if (/(andamento|progresso|doing|in progress|execu)/.test(t)) return "doing";
  if (/(conclu|done|finaliz|feito)/.test(t)) return "done";
  return "other";
}

function DashboardPage() {
  const [actions, setActions] = useState<Action5W2H[]>([]);
  const [board, setBoard] = useState<KanbanBoard>({
    title: "",
    columns: [],
    tasks: [],
  });

  useEffect(() => {
    setActions(readLS<Action5W2H[]>(STORAGE_KEYS.actions, []));
    setBoard(
      readLS<KanbanBoard>(STORAGE_KEYS.kanban, {
        title: "",
        columns: [],
        tasks: [],
      }),
    );
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // 5W2H stats
  const a = useMemo(() => {
    const todo = actions.filter((x) => x.status === "planejado").length;
    const doing = actions.filter((x) => x.status === "em_andamento").length;
    const done = actions.filter((x) => x.status === "concluido").length;
    const overdue = actions.filter(
      (x) => x.status !== "concluido" && x.when < today,
    ).length;
    return { total: actions.length, todo, doing, done, overdue };
  }, [actions, today]);

  // Kanban stats
  const k = useMemo(() => {
    const colMap = new Map(board.columns.map((c) => [c.id, classifyColumn(c.title)]));
    let todo = 0,
      doing = 0,
      done = 0,
      other = 0;
    board.tasks.forEach((t) => {
      const tone = colMap.get(t.columnId) ?? "other";
      if (tone === "todo") todo++;
      else if (tone === "doing") doing++;
      else if (tone === "done") done++;
      else other++;
    });
    return { total: board.tasks.length, todo, doing, done, other };
  }, [board]);

  const totals = {
    total: a.total + k.total,
    todo: a.todo + k.todo,
    doing: a.doing + k.doing,
    done: a.done + k.done,
    critical: a.overdue,
  };

  const adesao = totals.total
    ? Math.round((totals.done / totals.total) * 100)
    : 0;

  // Bar chart: comparação Kanban vs 5W2H por status
  const compareData = [
    { status: "A Fazer", Kanban: k.todo, "5W2H": a.todo },
    { status: "Em Andamento", Kanban: k.doing, "5W2H": a.doing },
    { status: "Concluído", Kanban: k.done, "5W2H": a.done },
  ];

  // Pie: distribuição global
  const pieData = [
    { name: "A Fazer", value: totals.todo, color: "hsl(0 75% 55%)" },
    { name: "Em Andamento", value: totals.doing, color: "hsl(45 90% 50%)" },
    { name: "Concluído", value: totals.done, color: "hsl(140 65% 42%)" },
  ];

  const kpis = [
    {
      label: "Total de tarefas",
      value: totals.total,
      icon: ListChecks,
      hint: `${a.total} 5W2H · ${k.total} Kanban`,
      tone: "text-primary",
    },
    {
      label: "A fazer",
      value: totals.todo,
      icon: CircleDashed,
      hint: "Pendentes de início",
      tone: "text-red-600",
    },
    {
      label: "Em andamento",
      value: totals.doing,
      icon: Clock,
      hint: "Em execução",
      tone: "text-yellow-600",
    },
    {
      label: "Concluídas",
      value: totals.done,
      icon: CheckCircle2,
      hint: "Finalizadas",
      tone: "text-green-600",
    },
    {
      label: "Tarefas críticas",
      value: totals.critical,
      icon: Flame,
      hint: "5W2H com prazo vencido",
      tone: "text-destructive",
    },
    {
      label: "Adesão a protocolos",
      value: `${adesao}%`,
      icon: Activity,
      hint: "Conclusão geral",
      tone: "text-primary",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Visão geral</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores das ferramentas Kanban e 5W2H.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild>
            <Link to="/actions/new">
              <Plus className="h-4 w-4 mr-1" />
              Nova Ação 5W2H
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/kanban">
              <KanbanSquare className="h-4 w-4 mr-1" />
              Nova Ação Kanban
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
              <k.icon className={`h-4 w-4 ${k.tone}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{k.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolução Kanban × 5W2H por status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Kanban" fill="hsl(200 75% 45%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="5W2H" fill="hsl(280 60% 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição geral das tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {totals.critical > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">
              {totals.critical} ação(ões) 5W2H com prazo vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link to="/actions">Ver ações 5W2H</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingDown, ListChecks, AlertTriangle, Plus } from "lucide-react";
import { STORAGE_KEYS, readLS } from "@/lib/storage";
import type { Action5W2H, IrasPoint } from "@/lib/types";
import { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CCIH 5W2H" },
      { name: "description", content: "Indicadores de IRAS e progresso de ações de controle de infecção." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [actions, setActions] = useState<Action5W2H[]>([]);
  const [iras, setIras] = useState<IrasPoint[]>([]);

  useEffect(() => {
    setActions(readLS<Action5W2H[]>(STORAGE_KEYS.actions, []));
    setIras(readLS<IrasPoint[]>(STORAGE_KEYS.iras, []));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const inProgress = actions.filter((a) => a.status === "em_andamento").length;
  const overdue = actions.filter((a) => a.status !== "concluido" && a.when < today).length;
  const lastRate = useMemo(() => {
    if (!iras.length) return 0;
    const last = iras[iras.length - 1].date;
    const ofMonth = iras.filter((p) => p.date === last);
    return +(ofMonth.reduce((s, p) => s + p.rate, 0) / ofMonth.length).toFixed(2);
  }, [iras]);

  const adesao = 87;

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    iras.forEach((p) => {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[p.sector] = p.rate;
      byDate.set(p.date, row);
    });
    return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [iras]);

  const sectors = Array.from(new Set(iras.map((p) => p.sector)));
  const colors = ["hsl(200 75% 45%)", "hsl(160 70% 40%)", "hsl(30 85% 55%)", "hsl(280 60% 55%)"];

  const kpis = [
    { label: "Taxa IRAS (média)", value: `${lastRate}‰`, icon: Activity, hint: "Por 1.000 paciente-dia" },
    { label: "Adesão a protocolos", value: `${adesao}%`, icon: TrendingDown, hint: "Higienização de mãos" },
    { label: "Ações em andamento", value: inProgress, icon: ListChecks, hint: `${actions.length} no total` },
    { label: "Ações atrasadas", value: overdue, icon: AlertTriangle, hint: "Prazo vencido" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Visão geral</h2>
          <p className="text-sm text-muted-foreground">Indicadores de infecção hospitalar e ações em curso.</p>
        </div>
        <Button asChild>
          <Link to="/actions/new"><Plus className="h-4 w-4 mr-1" />Nova Ação 5W2H</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{k.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolução das taxas de IRAS por setor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {sectors.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

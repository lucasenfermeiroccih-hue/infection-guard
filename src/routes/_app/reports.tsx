import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText } from "lucide-react";
import { listActions } from "@/lib/actions-api";
import { SECTORS, INFECTION_TYPES, type Action5W2H, type ActionStatus } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Relatórios — CCIH 5W2H" },
      { name: "description", content: "Geração de evidências para auditorias e diretoria." },
    ],
  }),
  component: ReportsPage,
});

const STATUS_LABEL: Record<ActionStatus, string> = {
  planejado: "Planejado", em_andamento: "Em Andamento", concluido: "Concluído",
};

const ALL = "__all__";

function ReportsPage() {
  const [all, setAll] = useState<Action5W2H[]>([]);
  const [sector, setSector] = useState<string>(ALL);
  const [infection, setInfection] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  useEffect(() => { setAll(readLS<Action5W2H[]>(STORAGE_KEYS.actions, [])); }, []);

  const filtered = useMemo(() => all.filter((a) =>
    (sector === ALL || a.where === sector) &&
    (infection === ALL || a.infectionType === infection) &&
    (status === ALL || a.status === status)
  ), [all, sector, infection, status]);

  const exportXlsx = () => {
    const rows = filtered.map((a) => ({
      "What": a.what, "Why": a.why, "Where": a.where, "Who": a.who,
      "When": a.when, "How": a.how, "How Much": a.howMuch,
      "Tipo Infecção": a.infectionType, "Status": STATUS_LABEL[a.status],
      "Criada em": new Date(a.createdAt).toLocaleDateString("pt-BR"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ações 5W2H");
    XLSX.writeFile(wb, `ccih_acoes_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Excel gerado");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("CCIH — Relatório Executivo de Ações 5W2H", 14, 16);
    doc.setFontSize(10);
    doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, 14, 22);
    doc.text(`Total de ações: ${filtered.length}`, 14, 28);
    autoTable(doc, {
      startY: 34,
      head: [["What", "Setor", "Responsável", "Prazo", "Tipo", "Status"]],
      body: filtered.map((a) => [a.what, a.where, a.who, a.when, a.infectionType, STATUS_LABEL[a.status]]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 110, 140] },
    });
    doc.save(`ccih_relatorio_${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF gerado");
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Relatórios e Exportação</h2>
        <p className="text-sm text-muted-foreground">Filtre as ações e exporte para auditorias ou diretoria.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros avançados</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de infecção</Label>
            <Select value={infection} onValueChange={setInfection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {INFECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="planejado">Planejado</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <Button onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Exportar Excel</Button>
        <Button variant="secondary" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />Gerar PDF Executivo</Button>
        <span className="text-sm text-muted-foreground self-center ml-2">{filtered.length} ações</span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>What</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium max-w-xs truncate">{a.what}</TableCell>
                  <TableCell>{a.where}</TableCell>
                  <TableCell>{a.who}</TableCell>
                  <TableCell>{a.when}</TableCell>
                  <TableCell><Badge variant="secondary">{a.infectionType}</Badge></TableCell>
                  <TableCell>{STATUS_LABEL[a.status]}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma ação corresponde aos filtros.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

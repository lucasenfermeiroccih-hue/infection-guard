import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, User as UserIcon } from "lucide-react";
import { STORAGE_KEYS, readLS, writeLS } from "@/lib/storage";
import type { Action5W2H, ActionStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/actions/")({
  head: () => ({
    meta: [
      { title: "Ações 5W2H — CCIH" },
      { name: "description", content: "Monitoramento visual do progresso das ações preventivas." },
    ],
  }),
  component: ActionsBoard,
});

const COLUMNS: { id: ActionStatus; title: string; tone: string }[] = [
  { id: "planejado", title: "Planejado", tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  { id: "em_andamento", title: "Em Andamento", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { id: "concluido", title: "Concluído", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
];

function ActionsBoard() {
  const [actions, setActions] = useState<Action5W2H[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { setActions(readLS<Action5W2H[]>(STORAGE_KEYS.actions, [])); }, []);

  const persist = (a: Action5W2H[]) => { setActions(a); writeLS(STORAGE_KEYS.actions, a); };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    const targetCol = COLUMNS.find((c) => c.id === overId)?.id
      ?? actions.find((a) => a.id === overId)?.status;
    if (!targetCol) return;
    persist(actions.map((a) => a.id === id ? { ...a, status: targetCol } : a));
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold">Gerenciamento de Ações</h2>
          <p className="text-sm text-muted-foreground">Arraste cartões entre as colunas para atualizar o status.</p>
        </div>
        <Button asChild><Link to="/actions/new"><Plus className="h-4 w-4 mr-1" />Nova Ação</Link></Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = actions.filter((a) => a.status === col.id);
            return (
              <StatusColumn key={col.id} id={col.id} title={col.title} tone={col.tone} items={items} />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function StatusColumn({ id, title, tone, items }: { id: ActionStatus; title: string; tone: string; items: Action5W2H[] }) {
  const { setNodeRef } = useSortable({ id });
  return (
    <div ref={setNodeRef} className="bg-muted/40 rounded-lg flex flex-col min-h-[60vh]">
      <div className="p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tone}`}>{title}</span>
        </div>
        <span className="text-xs bg-background border rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((a) => <ActionCardSortable key={a.id} action={a} />)}
        </SortableContext>
        {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Sem ações</div>}
      </div>
    </div>
  );
}

function ActionCardSortable({ action }: { action: Action5W2H }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const navigate = useNavigate();
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="cursor-pointer hover:shadow-md transition"
        onClick={() => navigate({ to: "/actions/$id", params: { id: action.id } })}
      >
        <CardContent className="p-3 space-y-2">
          <div className="font-medium text-sm leading-snug">{action.what}</div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{action.infectionType}</Badge>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{action.where}</div>
            <div className="flex items-center gap-1.5"><UserIcon className="h-3 w-3" />{action.who}</div>
            <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{action.when}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

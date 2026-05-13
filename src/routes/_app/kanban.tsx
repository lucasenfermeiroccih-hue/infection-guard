import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, closestCorners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, X, GripVertical, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS, readLS, writeLS, removeLS } from "@/lib/storage";
import type { KanbanColumn, KanbanTask, Recurrence } from "@/lib/types";
import {
  loadBoard, createColumn, updateColumnTitle, deleteColumn, reorderColumns,
  createTask, moveTask, reassignTasks, deleteTask,
} from "@/lib/kanban-api";
import { Repeat } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban — CCIH 5W2H" },
      { name: "description", content: "Quadro Kanban com colunas e tarefas para organização da equipe." },
    ],
  }),
  component: KanbanPage,
});

function KanbanPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("Quadro CCIH");
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskCol, setNewTaskCol] = useState<string>("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<Recurrence>("none");
  const [removeColId, setRemoveColId] = useState<string | null>(null);
  const [moveTargetCol, setMoveTargetCol] = useState<string>("");
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColTitle, setEditingColTitle] = useState("");

  useEffect(() => {
    setTitle(readLS<string>("ccih_kanban_title", "Quadro CCIH"));
    loadBoard()
      .then((b) => { setColumns(b.columns); setTasks(b.tasks); })
      .catch((e) => toast.error(e.message));
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const sortedColumns = useMemo(() => [...columns].sort((a, b) => a.order - b.order), [columns]);

  const onDragStart = (e: DragStartEvent) => {
    const t = tasks.find((x) => x.id === e.active.id);
    if (t) setActiveTask(t);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const overTask = tasks.find((t) => t.id === overId);
    const overCol = columns.find((c) => c.id === overId);
    const targetCol = overCol?.id ?? overTask?.columnId;
    if (!targetCol) return;
    const prev = tasks;
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, columnId: targetCol } : t)));
    try { await moveTask(taskId, targetCol); }
    catch (err) { setTasks(prev); toast.error(err instanceof Error ? err.message : "Erro"); }
  };

  const saveTitle = () => {
    if (!titleDraft.trim()) { toast.error("Título não pode ser vazio"); return; }
    const t = titleDraft.trim();
    setTitle(t);
    writeLS("ccih_kanban_title", t);
    setEditingTitle(false);
  };

  const addColumn = async () => {
    if (!newColTitle.trim()) { toast.error("Título obrigatório"); return; }
    try {
      const col = await createColumn(newColTitle.trim(), columns.length);
      setColumns([...columns, col]);
      setNewColTitle(""); setNewColOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) { toast.error("Título obrigatório"); return; }
    if (!newTaskCol) { toast.error("Selecione uma coluna"); return; }
    try {
      const t = await createTask({
        columnId: newTaskCol,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        recurrence: newTaskRecurrence,
      });
      setTasks([...tasks, t]);
      setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskRecurrence("none"); setNewTaskOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const removeTask = async (id: string) => {
    const prev = tasks;
    setTasks(tasks.filter((t) => t.id !== id));
    try { await deleteTask(id); }
    catch (e) { setTasks(prev); toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const saveColTitle = async (id: string) => {
    if (!editingColTitle.trim()) { toast.error("Título não pode ser vazio"); return; }
    const t = editingColTitle.trim();
    setColumns(columns.map((c) => c.id === id ? { ...c, title: t } : c));
    setEditingColId(null);
    try { await updateColumnTitle(id, t); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const confirmRemoveColumn = async (mode: "delete" | "move") => {
    if (!removeColId) return;
    try {
      if (mode === "delete") {
        // cascade deletes tasks via FK
        await deleteColumn(removeColId);
        setTasks(tasks.filter((t) => t.columnId !== removeColId));
      } else {
        if (!moveTargetCol) { toast.error("Selecione a coluna destino"); return; }
        await reassignTasks(removeColId, moveTargetCol);
        await deleteColumn(removeColId);
        setTasks(tasks.map((t) => t.columnId === removeColId ? { ...t, columnId: moveTargetCol } : t));
      }
      const remaining = columns.filter((c) => c.id !== removeColId).map((c, i) => ({ ...c, order: i }));
      setColumns(remaining);
      await reorderColumns(remaining.map((c) => ({ id: c.id, position: c.order })));
      setRemoveColId(null); setMoveTargetCol("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const logout = async () => { await supabase.auth.signOut(); removeLS(STORAGE_KEYS.session); navigate({ to: "/" }); };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center justify-between gap-2 p-4 border-b bg-background">
        {editingTitle ? (
          <div className="flex gap-2 items-center">
            <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="h-8 w-64" />
            <Button size="sm" onClick={saveTitle}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Cancelar</Button>
          </div>
        ) : (
          <h2 className="text-lg font-semibold cursor-pointer" onClick={() => { setTitleDraft(board.title); setEditingTitle(true); }}>
            {board.title}
          </h2>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewColOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova Coluna</Button>
          <Button size="sm" onClick={() => { setNewTaskCol(sortedColumns[0]?.id ?? ""); setNewTaskOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Nova Tarefa
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-1" />Sair</Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full min-w-max pb-2">
            {sortedColumns.map((col) => {
              const colTasks = board.tasks.filter((t) => t.columnId === col.id);
              return (
                <ColumnView
                  key={col.id}
                  column={col}
                  tasks={colTasks}
                  isEditingTitle={editingColId === col.id}
                  editTitleValue={editingColTitle}
                  onEditTitle={() => { setEditingColId(col.id); setEditingColTitle(col.title); }}
                  onChangeTitle={setEditingColTitle}
                  onSaveTitle={() => saveColTitle(col.id)}
                  onCancelTitle={() => setEditingColId(null)}
                  onRemove={() => setRemoveColId(col.id)}
                  onRemoveTask={removeTask}
                />
              );
            })}
            {sortedColumns.length === 0 && (
              <div className="text-muted-foreground text-sm">Nenhuma coluna ainda. Crie sua primeira coluna.</div>
            )}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} onRemove={() => {}} dragging />}
          </DragOverlay>
        </DndContext>
      </div>

      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova coluna</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)} placeholder="Ex: Em revisão" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewColOpen(false)}>Cancelar</Button>
            <Button onClick={addColumn}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select value={newTaskCol} onValueChange={setNewTaskCol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sortedColumns.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} />
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={newTaskRecurrence} onValueChange={(v) => setNewTaskRecurrence(v as Recurrence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não se repete</SelectItem>
                  <SelectItem value="daily">Diariamente</SelectItem>
                  <SelectItem value="weekly">Semanalmente</SelectItem>
                  <SelectItem value="monthly">Mensalmente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
            <Button onClick={addTask}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeColId} onOpenChange={(o) => !o && setRemoveColId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover coluna</DialogTitle>
            <DialogDescription>O que fazer com as tarefas desta coluna?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="destructive" className="w-full" onClick={() => confirmRemoveColumn("delete")}>
              <Trash2 className="h-4 w-4 mr-2" />Remover tarefas associadas
            </Button>
            <div className="space-y-2">
              <Label>Mover tarefas para:</Label>
              <Select value={moveTargetCol} onValueChange={setMoveTargetCol}>
                <SelectTrigger><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
                <SelectContent>
                  {board.columns.filter((c) => c.id !== removeColId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={() => confirmRemoveColumn("move")} disabled={!moveTargetCol}>
                Mover e remover coluna
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveColId(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColumnView({
  column, tasks, isEditingTitle, editTitleValue,
  onEditTitle, onChangeTitle, onSaveTitle, onCancelTitle, onRemove, onRemoveTask,
}: {
  column: KanbanColumn;
  tasks: KanbanTask[];
  isEditingTitle: boolean;
  editTitleValue: string;
  onEditTitle: () => void;
  onChangeTitle: (s: string) => void;
  onSaveTitle: () => void;
  onCancelTitle: () => void;
  onRemove: () => void;
  onRemoveTask: (id: string) => void;
}) {
  const { setNodeRef } = useSortable({ id: column.id });
  const t = column.title.toLowerCase();
  const tone =
    /(a fazer|tarefa a fazer|todo|planejad)/.test(t)
      ? { bar: "bg-red-500", bg: "bg-red-500/10", text: "text-red-700 dark:text-red-300" }
      : /(andamento|progresso|doing|in progress)/.test(t)
      ? { bar: "bg-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-700 dark:text-yellow-300" }
      : /(conclu|done|finaliz)/.test(t)
      ? { bar: "bg-green-500", bg: "bg-green-500/10", text: "text-green-700 dark:text-green-300" }
      : { bar: "bg-muted-foreground/30", bg: "bg-muted/40", text: "" };
  return (
    <div className={`w-72 shrink-0 ${tone.bg} rounded-lg flex flex-col max-h-full overflow-hidden`} ref={setNodeRef}>
      <div className={`h-1 ${tone.bar}`} />
      <div className="p-3 flex items-center gap-2 border-b">
        {isEditingTitle ? (
          <Input
            autoFocus
            value={editTitleValue}
            onChange={(e) => onChangeTitle(e.target.value)}
            onBlur={onSaveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") onSaveTitle(); if (e.key === "Escape") onCancelTitle(); }}
            className="h-7"
          />
        ) : (
          <button className={`font-medium text-sm flex-1 text-left truncate ${tone.text}`} onClick={onEditTitle}>{column.title}</button>
        )}
        <span className="text-xs bg-background border rounded-full px-2 py-0.5">{tasks.length}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto flex-1">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <SortableTask key={t.id} task={t} onRemove={() => onRemoveTask(t.id)} />)}
        </SortableContext>
        {tasks.length === 0 && <div className="text-xs text-muted-foreground p-2 text-center">Sem tarefas</div>}
      </div>
    </div>
  );
}

function SortableTask({ task, onRemove }: { task: KanbanTask; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onRemove={onRemove} />
    </div>
  );
}

function TaskCard({ task, onRemove, dragging }: { task: KanbanTask; onRemove: () => void; dragging?: boolean }) {
  return (
    <div className={`bg-card border rounded-md p-2.5 shadow-sm flex gap-2 group ${dragging ? "shadow-lg" : ""}`}>
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{task.title}</div>
        {task.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</div>}
        {task.recurrence && task.recurrence !== "none" && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary rounded px-1.5 py-0.5">
            <Repeat className="h-3 w-3" />
            {task.recurrence === "daily" ? "Diária" : task.recurrence === "weekly" ? "Semanal" : "Mensal"}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, closestCenter, KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, X, Trash2, MoreHorizontal, Repeat2, CalendarDays,
  CalendarRange, RefreshCw, KanbanSquare, GripVertical,
  CheckCircle2, Circle, UserCircle2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { KanbanColumn, KanbanTask, Recurrence, HospitalUser } from "@/lib/types";
import {
  loadBoard, createColumn, updateColumnTitle, deleteColumn, reorderColumns,
  createTask, updateTask, moveTask, reassignTasks, deleteTask,
  setTaskStatus, listHospitalUsers,
} from "@/lib/kanban-api";
import { useAppCtx } from "@/lib/app-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({ meta: [{ title: "Kanban — CCIH" }] }),
  component: KanbanPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Não se repete",
  daily: "Diariamente",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
};

const RECURRENCE_ICONS: Record<Recurrence, React.ReactNode> = {
  none: null,
  daily: <RefreshCw className="h-3 w-3" />,
  weekly: <CalendarDays className="h-3 w-3" />,
  monthly: <CalendarRange className="h-3 w-3" />,
};

const RECURRENCE_COLORS: Record<Recurrence, string> = {
  none: "",
  daily: "bg-red-100 text-red-700 border-red-200",
  weekly: "bg-blue-100 text-blue-700 border-blue-200",
  monthly: "bg-purple-100 text-purple-700 border-purple-200",
};

const PRIORITY_BORDER: Record<KanbanTask["priority"], string> = {
  low: "border-l-slate-300",
  normal: "border-l-blue-400",
  high: "border-l-red-500",
};

const PRIORITY_LABELS: Record<KanbanTask["priority"], string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

function KanbanPage() {
  const { isAdmin } = useAppCtx();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [hospitalUsers, setHospitalUsers] = useState<HospitalUser[]>([]);
  const [boardTitle, setBoardTitle] = useState("Quadro CCIH");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Modais
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: "", description: "", colId: "",
    recurrence: "none" as Recurrence,
    assignedTo: "",
    priority: "normal" as KanbanTask["priority"],
  });
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", description: "", recurrence: "none" as Recurrence,
    assignedTo: "", priority: "normal" as KanbanTask["priority"],
  });
  const [deleteColId, setDeleteColId] = useState<string | null>(null);
  const [moveToColId, setMoveToColId] = useState("");

  // DnD
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadBoard()
      .then((b) => { setColumns(b.columns); setTasks(b.tasks); })
      .catch((e) => toast.error(e.message));
    listHospitalUsers().then(setHospitalUsers);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedCols = [...columns].sort((a, b) => a.order - b.order);
  const activeCol = columns.find((c) => c.id === activeColId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);

  // ── DnD handlers ──
  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (columns.find((c) => c.id === id)) setActiveColId(id);
    else setActiveTaskId(id);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveColId(null);
    setActiveTaskId(null);
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (columns.find((c) => c.id === activeId)) {
      const oldIdx = sortedCols.findIndex((c) => c.id === activeId);
      const newIdx = sortedCols.findIndex((c) => c.id === overId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = [...sortedCols];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);
      const updated = reordered.map((c, i) => ({ ...c, order: i }));
      setColumns(updated);
      try { await reorderColumns(updated.map((c) => ({ id: c.id, position: c.order }))); }
      catch { toast.error("Erro ao reordenar colunas"); }
      return;
    }

    const overCol = columns.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t.id === overId);
    const targetColId = overCol?.id ?? overTask?.columnId;
    if (!targetColId) return;
    setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, columnId: targetColId } : t));
    try { await moveTask(activeId, targetColId); }
    catch { toast.error("Erro ao mover tarefa"); }
  };

  // ── Board title ──
  const saveBoardTitle = () => {
    const t = titleDraft.trim();
    if (!t) { toast.error("Título não pode ser vazio"); return; }
    setBoardTitle(t);
    setEditingTitle(false);
  };

  // ── Column handlers ──
  const handleAddColumn = async () => {
    const t = newColTitle.trim();
    if (!t) { toast.error("Informe o título da coluna"); return; }
    try {
      const col = await createColumn(t, columns.length);
      setColumns((prev) => [...prev, col]);
      setNewColTitle(""); setNewColOpen(false);
      toast.success("Coluna criada");
    } catch { toast.error("Erro ao criar coluna"); }
  };

  const handleRenameColumn = async (id: string, title: string) => {
    if (!title.trim()) { toast.error("Título não pode ser vazio"); return; }
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
    try { await updateColumnTitle(id, title); }
    catch { toast.error("Erro ao renomear coluna"); }
  };

  const handleDeleteColumn = async (mode: "delete" | "move") => {
    if (!deleteColId) return;
    try {
      if (mode === "move") {
        if (!moveToColId) { toast.error("Selecione a coluna destino"); return; }
        await reassignTasks(deleteColId, moveToColId);
        setTasks((prev) => prev.map((t) => t.columnId === deleteColId ? { ...t, columnId: moveToColId } : t));
      } else {
        setTasks((prev) => prev.filter((t) => t.columnId !== deleteColId));
      }
      await deleteColumn(deleteColId);
      const remaining = columns.filter((c) => c.id !== deleteColId).map((c, i) => ({ ...c, order: i }));
      setColumns(remaining);
      await reorderColumns(remaining.map((c) => ({ id: c.id, position: c.order })));
      toast.success("Coluna removida");
    } catch { toast.error("Erro ao remover coluna"); }
    setDeleteColId(null); setMoveToColId("");
  };

  // ── Task handlers ──
  const handleAddTask = async () => {
    const { title, description, colId, recurrence, assignedTo, priority } = newTaskData;
    if (!title.trim()) { toast.error("Informe o título da tarefa"); return; }
    if (!colId) { toast.error("Selecione uma coluna"); return; }
    try {
      const t = await createTask({
        columnId: colId,
        title: title.trim(),
        description: description.trim() || undefined,
        recurrence,
        assignedTo: assignedTo || undefined,
        priority,
      });
      setTasks((prev) => [...prev, t]);
      setNewTaskData({ title: "", description: "", colId: sortedCols[0]?.id ?? "", recurrence: "none", assignedTo: "", priority: "normal" });
      setNewTaskOpen(false);
      toast.success("Tarefa criada");
    } catch { toast.error("Erro ao criar tarefa"); }
  };

  const handleAddCardInline = useCallback(async (colId: string, title: string) => {
    try {
      const t = await createTask({ columnId: colId, title, recurrence: "none", priority: "normal" });
      setTasks((prev) => [...prev, t]);
    } catch { toast.error("Erro ao criar tarefa"); }
  }, []);

  const handleDeleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await deleteTask(id); }
    catch { toast.error("Erro ao remover tarefa"); }
  }, []);

  const handleToggleStatus = useCallback(async (task: KanbanTask) => {
    const next = task.status === "completed" ? "in_progress" : "completed";
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    try { await setTaskStatus(task.id, next); }
    catch { toast.error("Erro ao atualizar status"); }
  }, []);

  const openEditTask = useCallback((task: KanbanTask) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      recurrence: task.recurrence ?? "none",
      assignedTo: task.assignedTo ?? "",
      priority: task.priority,
    });
    setEditTaskOpen(true);
  }, []);

  const handleEditTask = async () => {
    if (!editingTask) return;
    if (!editForm.title.trim()) { toast.error("Título não pode ser vazio"); return; }
    try {
      await updateTask(editingTask.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        recurrence: editForm.recurrence,
        assignedTo: editForm.assignedTo || null,
        priority: editForm.priority,
      });
      const assignedUser = hospitalUsers.find((u) => u.userId === editForm.assignedTo);
      setTasks((prev) => prev.map((t) => t.id === editingTask.id ? {
        ...t,
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        recurrence: editForm.recurrence,
        assignedTo: editForm.assignedTo || undefined,
        assignedToName: assignedUser?.fullName,
        priority: editForm.priority,
      } : t));
      setEditTaskOpen(false);
      setEditingTask(null);
      toast.success("Tarefa atualizada");
    } catch { toast.error("Erro ao atualizar tarefa"); }
  };

  const otherCols = columns.filter((c) => c.id !== deleteColId);

  return (
    <div
      className="flex flex-col h-[calc(100vh-3.5rem)]"
      style={{ background: "linear-gradient(135deg,#1565C0 0%,#0D47A1 60%,#1A237E 100%)" }}
    >
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-black/20 backdrop-blur-sm border-b border-white/10">
        <KanbanSquare className="h-5 w-5 text-white shrink-0" />

        {editingTitle ? (
          <Input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveBoardTitle}
            onKeyDown={(e) => { if (e.key === "Enter") saveBoardTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            className="h-8 w-56 bg-white/20 border-white/40 text-white placeholder:text-white/60 font-semibold"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(boardTitle); setEditingTitle(true); }}
            className="text-white font-semibold text-base hover:bg-white/10 px-2 py-1 rounded transition-colors"
          >
            {boardTitle}
          </button>
        )}

        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 border border-white/30" onClick={() => setNewColOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Nova Coluna
            </Button>
            <Button
              size="sm"
              className="bg-white text-blue-800 hover:bg-white/90 font-semibold"
              onClick={() => { setNewTaskData((p) => ({ ...p, colId: sortedCols[0]?.id ?? "" })); setNewTaskOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />Atribuir Tarefa
            </Button>
          </div>
        )}
        {!isAdmin && <div className="ml-auto text-white/60 text-xs">Suas tarefas atribuídas</div>}
      </div>

      {/* ── Board ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SortableContext items={sortedCols.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div className="flex gap-3 h-full items-start w-max pb-2">
              {sortedCols.map((col) => (
                <SortableColumn
                  key={col.id}
                  column={col}
                  tasks={tasks.filter((t) => t.columnId === col.id)}
                  isAdmin={isAdmin}
                  onRename={(title) => handleRenameColumn(col.id, title)}
                  onDelete={() => { setDeleteColId(col.id); setMoveToColId(""); }}
                  onAddCard={(title) => handleAddCardInline(col.id, title)}
                  onDeleteTask={handleDeleteTask}
                  onToggleStatus={handleToggleStatus}
                  onEditTask={openEditTask}
                />
              ))}

              {isAdmin && (
                <AddListInline onAdd={async (title) => {
                  try {
                    const col = await createColumn(title, columns.length);
                    setColumns((prev) => [...prev, col]);
                  } catch { toast.error("Erro ao criar lista"); }
                }} />
              )}
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeCol && (
              <div className="w-72 bg-[#ebecf0] rounded-xl shadow-2xl p-3 rotate-2 opacity-95">
                <span className="font-semibold text-sm text-gray-800">{activeCol.title}</span>
              </div>
            )}
            {activeTask && <TaskCardGhost task={activeTask} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Modal Nova Coluna ── */}
      <Dialog open={newColOpen} onOpenChange={setNewColOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Coluna</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              autoFocus
              placeholder="Ex: Em revisão"
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewColOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddColumn}>Criar Coluna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Atribuir Tarefa ── */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Atribuir Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select value={newTaskData.colId} onValueChange={(v) => setNewTaskData((p) => ({ ...p, colId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
                <SelectContent>
                  {sortedCols.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input
                autoFocus
                placeholder="Título da tarefa"
                value={newTaskData.title}
                onChange={(e) => setNewTaskData((p) => ({ ...p, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                rows={3}
                value={newTaskData.description}
                onChange={(e) => setNewTaskData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Repeat2 className="h-4 w-4" />Recorrência</Label>
                <Select value={newTaskData.recurrence} onValueChange={(v) => setNewTaskData((p) => ({ ...p, recurrence: v as Recurrence }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RECURRENCE_LABELS) as [Recurrence, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={newTaskData.priority} onValueChange={(v) => setNewTaskData((p) => ({ ...p, priority: v as KanbanTask["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><UserCircle2 className="h-4 w-4" />Atribuir a</Label>
              <Select value={newTaskData.assignedTo} onValueChange={(v) => setNewTaskData((p) => ({ ...p, assignedTo: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar usuário (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Sem atribuição —</SelectItem>
                  {hospitalUsers.map((u) => (
                    <SelectItem key={u.userId} value={u.userId}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTask}>Criar e Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Editar Tarefa ── */}
      <Dialog open={editTaskOpen} onOpenChange={setEditTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título <span className="text-destructive">*</span></Label>
              <Input
                autoFocus
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={editForm.recurrence} onValueChange={(v) => setEditForm((p) => ({ ...p, recurrence: v as Recurrence }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(RECURRENCE_LABELS) as [Recurrence, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm((p) => ({ ...p, priority: v as KanbanTask["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><UserCircle2 className="h-4 w-4" />Atribuído a</Label>
                <Select value={editForm.assignedTo} onValueChange={(v) => setEditForm((p) => ({ ...p, assignedTo: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem atribuição" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Sem atribuição —</SelectItem>
                    {hospitalUsers.map((u) => (
                      <SelectItem key={u.userId} value={u.userId}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditTask}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Remover Coluna ── */}
      <AlertDialog open={!!deleteColId} onOpenChange={(o) => !o && setDeleteColId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Esta coluna possui <strong>{tasks.filter((t) => t.columnId === deleteColId).length}</strong> tarefa(s).
              O que deseja fazer com elas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            {otherCols.length > 0 && (
              <div className="space-y-2">
                <Label>Mover tarefas para outra coluna:</Label>
                <div className="flex gap-2">
                  <Select value={moveToColId} onValueChange={setMoveToColId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar coluna" /></SelectTrigger>
                    <SelectContent>
                      {otherCols.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button disabled={!moveToColId} onClick={() => handleDeleteColumn("move")}>Mover e remover</Button>
                </div>
              </div>
            )}
            <Button variant="destructive" className="w-full" onClick={() => handleDeleteColumn("delete")}>
              <Trash2 className="h-4 w-4 mr-2" />Remover coluna e todas as tarefas
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sortable Column ──────────────────────────────────────────────────────────

function SortableColumn({ column, tasks, isAdmin, onRename, onDelete, onAddCard, onDeleteTask, onToggleStatus, onEditTask }: {
  column: KanbanColumn;
  tasks: KanbanTask[];
  isAdmin: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddCard: (title: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleStatus: (task: KanbanTask) => void;
  onEditTask: (task: KanbanTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="w-72 shrink-0 flex flex-col max-h-[calc(100vh-9rem)] rounded-xl bg-[#ebecf0] shadow-xl">
      <ColumnHeader
        title={column.title}
        count={tasks.length}
        dragProps={isAdmin ? { ...attributes, ...listeners } : {}}
        isAdmin={isAdmin}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2 min-h-[2rem]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard
              key={t.id}
              task={t}
              isAdmin={isAdmin}
              onDelete={() => onDeleteTask(t.id)}
              onToggleStatus={() => onToggleStatus(t)}
              onEdit={() => onEditTask(t)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4 border-2 border-dashed border-gray-300 rounded-lg">
            Sem tarefas
          </div>
        )}
      </div>
      {isAdmin && <AddCardInline onAdd={onAddCard} />}
    </div>
  );
}

// ─── Column Header ────────────────────────────────────────────────────────────

function ColumnHeader({ title, count, dragProps, isAdmin, onRename, onDelete }: {
  title: string; count: number; dragProps: object; isAdmin: boolean;
  onRename: (t: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (!t) { toast.error("Título não pode ser vazio"); setDraft(title); setEditing(false); return; }
    if (t !== title) onRename(t);
    setEditing(false);
  };

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-2.5 select-none rounded-t-xl ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
      {...dragProps}
    >
      {isAdmin && <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />}
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 text-sm font-semibold bg-white border border-blue-500 rounded px-2 py-0.5 outline-none"
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(title); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          className="flex-1 text-sm font-semibold text-gray-800 text-left truncate hover:text-blue-700 transition-colors"
          onClick={() => isAdmin && setEditing(true)}
        >
          {title}
        </button>
      )}
      <span className="text-xs font-medium text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 shrink-0">{count}</span>
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-gray-300 text-gray-500 shrink-0" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>Renomear coluna</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />Remover coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ─── Sortable Card ────────────────────────────────────────────────────────────

function SortableCard({ task, isAdmin, onDelete, onToggleStatus, onEdit }: {
  task: KanbanTask;
  isAdmin: boolean;
  onDelete: () => void;
  onToggleStatus: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.15 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...(isAdmin ? { ...attributes, ...listeners } : {})}>
      <TaskCard task={task} isAdmin={isAdmin} onDelete={onDelete} onToggleStatus={onToggleStatus} onEdit={onEdit} />
    </div>
  );
}

function TaskCard({ task, isAdmin, onDelete, onToggleStatus, onEdit }: {
  task: KanbanTask;
  isAdmin: boolean;
  onDelete: () => void;
  onToggleStatus: () => void;
  onEdit: () => void;
}) {
  const done = task.status === "completed";
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${PRIORITY_BORDER[task.priority]} px-3 py-2.5 group hover:shadow-md transition-all`}>
      <div className="flex items-start gap-2">
        {/* Status toggle */}
        <button
          className="mt-0.5 shrink-0 text-gray-400 hover:text-green-600 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
          title={done ? "Marcar como pendente" : "Marcar como concluída"}
        >
          {done
            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
            : <Circle className="h-4 w-4" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${done ? "line-through text-gray-400" : "text-gray-800"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-1 mt-2">
            {task.recurrence && task.recurrence !== "none" && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RECURRENCE_COLORS[task.recurrence]}`}>
                {RECURRENCE_ICONS[task.recurrence]}
                {RECURRENCE_LABELS[task.recurrence]}
              </span>
            )}
            {task.priority !== "normal" && (
              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${task.priority === "high" ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {task.assignedToName && (
              <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                <UserCircle2 className="h-3 w-3" />{task.assignedToName}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-0.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {isAdmin && (
            <button
              className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCardGhost({ task }: { task: KanbanTask }) {
  return (
    <div className="w-64 bg-white rounded-lg shadow-2xl border border-blue-300 px-3 py-2.5 rotate-3 opacity-95">
      <p className="text-sm font-medium text-gray-800">{task.title}</p>
    </div>
  );
}

// ─── Inline Add Card ──────────────────────────────────────────────────────────

function AddCardInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 80);
  }, [open]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const submit = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
    setTimeout(() => ref.current?.focus(), 80);
  };
  const cancel = (e: React.SyntheticEvent) => { e.stopPropagation(); setOpen(false); setValue(""); };

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 w-full px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-200 rounded-b-xl transition-colors font-medium"
        onPointerDown={stop}
        onClick={(e) => { stop(e); setOpen(true); }}
      >
        <Plus className="h-4 w-4" />Adicionar cartão
      </button>
    );
  }

  return (
    <div className="px-2 pb-2 pt-1 space-y-2" onPointerDown={stop} onClick={stop}>
      <textarea
        ref={ref}
        rows={3}
        className="w-full text-sm border border-blue-400 rounded-lg px-3 py-2 resize-none outline-none shadow-sm bg-white"
        placeholder="Inserir título do cartão..."
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPointerDown={stop}
        onClick={stop}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(e); }
          if (e.key === "Escape") cancel(e);
        }}
      />
      <div className="flex items-center gap-2">
        <button type="button" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium" onPointerDown={stop} onClick={submit}>
          Adicionar cartão
        </button>
        <button type="button" className="p-1 text-gray-500 hover:text-gray-800 rounded" onPointerDown={stop} onClick={cancel}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ─── Inline Add List ──────────────────────────────────────────────────────────

function AddListInline({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 80);
  }, [open]);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const submit = async (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const t = value.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      await onAdd(t);
      setValue("");
      setTimeout(() => ref.current?.focus(), 80);
    } catch { toast.error("Erro ao criar lista"); }
    finally { setSaving(false); }
  };
  const cancel = (e: React.SyntheticEvent) => { e.stopPropagation(); setOpen(false); setValue(""); };

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-2 w-72 shrink-0 px-4 py-3 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors"
        onPointerDown={stop}
        onClick={(e) => { stop(e); setOpen(true); }}
      >
        <Plus className="h-5 w-5" />Criar nova lista
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-[#ebecf0] rounded-xl p-2.5 space-y-2 shadow-xl" onPointerDown={stop} onClick={stop}>
      <input
        ref={ref}
        type="text"
        className="w-full text-sm border border-blue-400 rounded-lg px-3 py-2 outline-none bg-white shadow-sm"
        placeholder="Inserir título da lista..."
        spellCheck={false}
        value={value}
        onPointerDown={stop}
        onClick={stop}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") submit(e); if (e.key === "Escape") cancel(e); }}
      />
      <div className="flex items-center gap-2">
        <button type="button" disabled={saving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm rounded-lg font-medium" onPointerDown={stop} onClick={submit}>
          {saving ? "Criando..." : "Criar lista"}
        </button>
        <button type="button" className="p-1 text-gray-500 hover:text-gray-800 rounded" onPointerDown={stop} onClick={cancel}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

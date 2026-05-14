import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  Plus, X, Trash2, MoreHorizontal, LogOut, Repeat2, CalendarDays,
  CalendarRange, RefreshCw, KanbanSquare, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEYS, removeLS } from "@/lib/storage";
import type { KanbanColumn, KanbanTask, Recurrence } from "@/lib/types";
import {
  loadBoard, createColumn, updateColumnTitle, deleteColumn, reorderColumns,
  createTask, moveTask, reassignTasks, deleteTask,
} from "@/lib/kanban-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({ meta: [{ title: "Kanban — CCIH" }] }),
  component: KanbanPage,
});

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

// ─── Main Page ────────────────────────────────────────────────────────────────

function KanbanPage() {
  const navigate = useNavigate();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [boardTitle, setBoardTitle] = useState("Quadro CCIH");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Modais
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({ title: "", description: "", colId: "", recurrence: "none" as Recurrence });
  const [deleteColId, setDeleteColId] = useState<string | null>(null);
  const [moveToColId, setMoveToColId] = useState("");

  // DnD
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadBoard()
      .then((b) => { setColumns(b.columns); setTasks(b.tasks); })
      .catch((e) => toast.error(e.message));
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
    const { title, description, colId, recurrence } = newTaskData;
    if (!title.trim()) { toast.error("Informe o título da tarefa"); return; }
    if (!colId) { toast.error("Selecione uma coluna"); return; }
    try {
      const t = await createTask({ columnId: colId, title: title.trim(), description: description.trim() || undefined, recurrence });
      setTasks((prev) => [...prev, t]);
      setNewTaskData({ title: "", description: "", colId: sortedCols[0]?.id ?? "", recurrence: "none" });
      setNewTaskOpen(false);
      toast.success("Tarefa criada");
    } catch { toast.error("Erro ao criar tarefa"); }
  };

  const handleAddCardInline = useCallback(async (colId: string, title: string) => {
    try {
      const t = await createTask({ columnId: colId, title, recurrence: "none" });
      setTasks((prev) => [...prev, t]);
    } catch { toast.error("Erro ao criar tarefa"); }
  }, []);

  const handleDeleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await deleteTask(id); }
    catch { toast.error("Erro ao remover tarefa"); }
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    removeLS(STORAGE_KEYS.session);
    navigate({ to: "/" });
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
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveBoardTitle}
              onKeyDown={(e) => { if (e.key === "Enter") saveBoardTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              className="h-8 w-56 bg-white/20 border-white/40 text-white placeholder:text-white/60 font-semibold"
            />
          </div>
        ) : (
          <button
            onClick={() => { setTitleDraft(boardTitle); setEditingTitle(true); }}
            className="text-white font-semibold text-base hover:bg-white/10 px-2 py-1 rounded transition-colors"
          >
            {boardTitle}
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20 border border-white/30"
            onClick={() => setNewColOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />Nova Coluna
          </Button>
          <Button
            size="sm"
            className="bg-white text-blue-800 hover:bg-white/90 font-semibold"
            onClick={() => { setNewTaskData((p) => ({ ...p, colId: sortedCols[0]?.id ?? "" })); setNewTaskOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" />Nova Tarefa
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" />Sair
          </Button>
        </div>
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
                  onRename={(title) => handleRenameColumn(col.id, title)}
                  onDelete={() => { setDeleteColId(col.id); setMoveToColId(""); }}
                  onAddCard={(title) => handleAddCardInline(col.id, title)}
                  onDeleteTask={handleDeleteTask}
                />
              ))}

              {/* Inline add list */}
              <AddListInline onAdd={async (title) => {
                try {
                  const col = await createColumn(title, columns.length);
                  setColumns((prev) => [...prev, col]);
                } catch { toast.error("Erro ao criar lista"); }
              }} />
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

      {/* ── Modal Nova Tarefa ── */}
      <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Repeat2 className="h-4 w-4" />Recorrência</Label>
              <Select
                value={newTaskData.recurrence}
                onValueChange={(v) => setNewTaskData((p) => ({ ...p, recurrence: v as Recurrence }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(RECURRENCE_LABELS) as [Recurrence, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewTaskOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddTask}>Criar Tarefa</Button>
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
                  <Button
                    disabled={!moveToColId}
                    onClick={() => handleDeleteColumn("move")}
                  >
                    Mover e remover
                  </Button>
                </div>
              </div>
            )}

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleDeleteColumn("delete")}
            >
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

function SortableColumn({ column, tasks, onRename, onDelete, onAddCard, onDeleteTask }: {
  column: KanbanColumn;
  tasks: KanbanTask[];
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddCard: (title: string) => void;
  onDeleteTask: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.25 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="w-72 shrink-0 flex flex-col max-h-[calc(100vh-9rem)] rounded-xl bg-[#ebecf0] shadow-xl">
      <ColumnHeader
        title={column.title}
        count={tasks.length}
        dragProps={{ ...attributes, ...listeners }}
        onRename={onRename}
        onDelete={onDelete}
      />

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2 min-h-[2rem]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} onDelete={() => onDeleteTask(t.id)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-4 border-2 border-dashed border-gray-300 rounded-lg">
            Sem tarefas
          </div>
        )}
      </div>

      <AddCardInline onAdd={onAddCard} />
    </div>
  );
}

// ─── Column Header ────────────────────────────────────────────────────────────

function ColumnHeader({ title, count, dragProps, onRename, onDelete }: {
  title: string; count: number; dragProps: object;
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
      className="flex items-center gap-1.5 px-3 py-2.5 cursor-grab active:cursor-grabbing select-none rounded-t-xl"
      {...dragProps}
    >
      <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />

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
          onClick={() => setEditing(true)}
        >
          {title}
        </button>
      )}

      <span className="text-xs font-medium text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 shrink-0">{count}</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded hover:bg-gray-300 text-gray-500 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
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
    </div>
  );
}

// ─── Sortable Card ────────────────────────────────────────────────────────────

function SortableCard({ task, onDelete }: { task: KanbanTask; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.15 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onDelete={onDelete} />
    </div>
  );
}

function TaskCard({ task, onDelete }: { task: KanbanTask; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2.5 group hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.recurrence && task.recurrence !== "none" && (
            <span className={`inline-flex items-center gap-1 mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${RECURRENCE_COLORS[task.recurrence]}`}>
              {RECURRENCE_ICONS[task.recurrence]}
              {RECURRENCE_LABELS[task.recurrence]}
            </span>
          )}
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 shrink-0 mt-0.5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
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

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
    ref.current?.focus();
  };

  if (!open) {
    return (
      <button
        className="flex items-center gap-1.5 w-full px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-200 rounded-b-xl transition-colors font-medium"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />Adicionar cartão
      </button>
    );
  }

  return (
    <div className="px-2 pb-2 pt-1 space-y-2">
      <textarea
        ref={ref}
        rows={3}
        className="w-full text-sm border border-blue-400 rounded-lg px-3 py-2 resize-none outline-none shadow-sm bg-white"
        placeholder="Inserir título do cartão..."
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } if (e.key === "Escape") { setOpen(false); setValue(""); } }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} className="bg-blue-600 hover:bg-blue-700">Adicionar cartão</Button>
        <button className="p-1 text-gray-500 hover:text-gray-800 rounded" onClick={() => { setOpen(false); setValue(""); }}>
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
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const submit = async () => {
    const t = value.trim();
    if (!t) return;
    await onAdd(t);
    setValue("");
    ref.current?.focus();
  };

  if (!open) {
    return (
      <button
        className="flex items-center gap-2 w-72 shrink-0 px-4 py-3 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors backdrop-blur-sm"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-5 w-5" />Criar nova lista
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-[#ebecf0] rounded-xl p-2.5 space-y-2 shadow-xl">
      <input
        ref={ref}
        type="text"
        className="w-full text-sm border border-blue-400 rounded-lg px-3 py-2 outline-none bg-white shadow-sm"
        placeholder="Inserir título da lista..."
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} className="bg-blue-600 hover:bg-blue-700">Criar lista</Button>
        <button className="p-1 text-gray-500 hover:text-gray-800 rounded" onClick={() => { setOpen(false); setValue(""); }}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

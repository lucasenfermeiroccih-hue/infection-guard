import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, closestCenter,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { KanbanColumn, KanbanTask } from "@/lib/types";
import {
  loadBoard, createColumn, updateColumnTitle, deleteColumn, reorderColumns,
  createTask, moveTask, deleteTask,
} from "@/lib/kanban-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [{ title: "Kanban — CCIH 5W2H" }],
  }),
  component: KanbanPage,
});

function KanbanPage() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [deleteColId, setDeleteColId] = useState<string | null>(null);

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

    // Column reorder
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
      catch (err) { toast.error("Erro ao reordenar colunas"); }
      return;
    }

    // Card move between columns
    const overCol = columns.find((c) => c.id === overId);
    const overTask = tasks.find((t) => t.id === overId);
    const targetColId = overCol?.id ?? overTask?.columnId;
    if (!targetColId) return;
    setTasks((prev) => prev.map((t) => t.id === activeId ? { ...t, columnId: targetColId } : t));
    try { await moveTask(activeId, targetColId); }
    catch { toast.error("Erro ao mover cartão"); }
  };

  const handleAddColumn = async (title: string) => {
    try {
      const col = await createColumn(title, columns.length);
      setColumns((prev) => [...prev, col]);
    } catch { toast.error("Erro ao criar lista"); }
  };

  const handleRenameColumn = async (id: string, title: string) => {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, title } : c));
    try { await updateColumnTitle(id, title); }
    catch { toast.error("Erro ao renomear"); }
  };

  const handleDeleteColumn = async () => {
    if (!deleteColId) return;
    try {
      await deleteColumn(deleteColId);
      setTasks((prev) => prev.filter((t) => t.columnId !== deleteColId));
      setColumns((prev) => prev.filter((c) => c.id !== deleteColId));
    } catch { toast.error("Erro ao remover lista"); }
    setDeleteColId(null);
  };

  const handleAddCard = async (colId: string, title: string) => {
    try {
      const t = await createTask({ columnId: colId, title, recurrence: "none" });
      setTasks((prev) => [...prev, t]);
    } catch { toast.error("Erro ao criar cartão"); }
  };

  const handleDeleteCard = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await deleteTask(id); }
    catch { toast.error("Erro ao remover cartão"); }
  }, []);

  return (
    <div
      className="h-[calc(100vh-3.5rem)] w-full overflow-x-auto overflow-y-hidden"
      style={{ background: "linear-gradient(135deg, #1565C0 0%, #0D47A1 50%, #1A237E 100%)" }}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext items={sortedCols.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 p-4 h-full items-start w-max">
            {sortedCols.map((col) => (
              <SortableColumn
                key={col.id}
                column={col}
                tasks={tasks.filter((t) => t.columnId === col.id)}
                onRename={(title) => handleRenameColumn(col.id, title)}
                onDelete={() => setDeleteColId(col.id)}
                onAddCard={(title) => handleAddCard(col.id, title)}
                onDeleteCard={handleDeleteCard}
              />
            ))}

            <AddListInline onAdd={handleAddColumn} />
          </div>
        </SortableContext>

        <DragOverlay>
          {activeCol && (
            <ColumnShell title={activeCol.title} count={tasks.filter((t) => t.columnId === activeCol.id).length} />
          )}
          {activeTask && <CardShell title={activeTask.title} description={activeTask.description} />}
        </DragOverlay>
      </DndContext>

      <AlertDialog open={!!deleteColId} onOpenChange={(o) => !o && setDeleteColId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lista</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os cartões desta lista serão removidos permanentemente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteColumn} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableColumn({ column, tasks, onRename, onDelete, onAddCard, onDeleteCard }: {
  column: KanbanColumn;
  tasks: KanbanTask[];
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddCard: (title: string) => void;
  onDeleteCard: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="w-72 shrink-0 flex flex-col max-h-[calc(100vh-6rem)] rounded-xl bg-[#ebecf0] shadow-lg">
      <ColumnHeader
        title={column.title}
        count={tasks.length}
        dragHandleProps={{ ...attributes, ...listeners }}
        onRename={onRename}
        onDelete={onDelete}
      />
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard key={t.id} task={t} onDelete={() => onDeleteCard(t.id)} />
          ))}
        </SortableContext>
      </div>
      <AddCardInline onAdd={onAddCard} />
    </div>
  );
}

function ColumnHeader({ title, count, dragHandleProps, onRename, onDelete }: {
  title: string;
  count: number;
  dragHandleProps: object;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t && t !== title) onRename(t);
    else setDraft(title);
    setEditing(false);
  };

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 cursor-grab active:cursor-grabbing select-none rounded-t-xl"
      {...dragHandleProps}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 text-sm font-semibold bg-white border border-blue-400 rounded px-2 py-0.5 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(title); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 text-sm font-semibold text-gray-800 truncate cursor-pointer"
          onClick={() => setEditing(true)}
        >
          {title}
        </span>
      )}
      <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">{count}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-gray-200 text-gray-500" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />Remover lista
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SortableCard({ task, onDelete }: { task: KanbanTask; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.2 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardShell title={task.title} description={task.description} onDelete={onDelete} />
    </div>
  );
}

function CardShell({ title, description, onDelete }: { title: string; description?: string; onDelete?: () => void }) {
  return (
    <div className="bg-white rounded-lg shadow-sm px-3 py-2 group flex items-start gap-2 cursor-pointer hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">{title}</p>
        {description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{description}</p>}
      </div>
      {onDelete && (
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 text-gray-400 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ColumnShell({ title, count }: { title: string; count: number }) {
  return (
    <div className="w-72 bg-[#ebecf0] rounded-xl shadow-xl opacity-90 p-3">
      <span className="text-sm font-semibold text-gray-800">{title}</span>
      <span className="ml-2 text-xs text-gray-500">({count})</span>
    </div>
  );
}

function AddCardInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) textareaRef.current?.focus(); }, [open]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
    textareaRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        className="flex items-center gap-1 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-b-xl transition-colors"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />Adicionar cartão
      </button>
    );
  }

  return (
    <div className="px-2 pb-2 space-y-1">
      <textarea
        ref={textareaRef}
        rows={3}
        className="w-full text-sm border border-blue-400 rounded-lg px-3 py-2 resize-none outline-none shadow-sm bg-white"
        placeholder="Inserir título do cartão..."
        value={value}
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
      />
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
          onClick={submit}
        >
          Adicionar cartão
        </button>
        <button className="p-1 text-gray-500 hover:text-gray-800" onClick={() => { setOpen(false); setValue(""); }}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function AddListInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        className="flex items-center gap-2 w-72 shrink-0 px-4 py-3 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-colors"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-5 w-5" />Criar nova lista
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 bg-[#ebecf0] rounded-xl p-2 space-y-2 shadow-lg">
      <input
        ref={inputRef}
        type="text"
        className="w-full text-sm border border-blue-400 rounded-lg px-3 py-2 outline-none bg-white shadow-sm"
        placeholder="Inserir título da lista..."
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }}
      />
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium"
          onClick={submit}
        >
          Criar lista
        </button>
        <button className="p-1 text-gray-500 hover:text-gray-800" onClick={() => { setOpen(false); setValue(""); }}>
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

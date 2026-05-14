import { supabase } from "@/integrations/supabase/client";
import type { KanbanColumn, KanbanTask, Recurrence } from "./types";

type ColRow = { id: string; user_id: string; title: string; position: number };
type TaskRow = {
  id: string;
  user_id: string;
  column_id: string;
  title: string;
  description: string | null;
  recurrence: Recurrence;
  position: number;
};

const colFromRow = (r: ColRow): KanbanColumn => ({ id: r.id, title: r.title, order: r.position });
const taskFromRow = (r: TaskRow): KanbanTask => ({
  id: r.id,
  columnId: r.column_id,
  title: r.title,
  description: r.description ?? undefined,
  recurrence: r.recurrence,
});

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Não autenticado");
  return data.user.id;
}

export async function loadBoard(): Promise<{ columns: KanbanColumn[]; tasks: KanbanTask[] }> {
  const [{ data: cols, error: e1 }, { data: tasks, error: e2 }] = await Promise.all([
    supabase.from("ccih_kanban_columns").select("*").order("position"),
    supabase.from("ccih_kanban_tasks").select("*").order("position"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    columns: (cols as ColRow[]).map(colFromRow),
    tasks: (tasks as TaskRow[]).map(taskFromRow),
  };
}

export async function createColumn(title: string, position: number): Promise<KanbanColumn> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("ccih_kanban_columns")
    .insert({ user_id, title, position })
    .select()
    .single();
  if (error) throw error;
  return colFromRow(data as ColRow);
}

export async function updateColumnTitle(id: string, title: string) {
  const { error } = await supabase.from("ccih_kanban_columns").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteColumn(id: string) {
  const { error } = await supabase.from("ccih_kanban_columns").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderColumns(ordered: { id: string; position: number }[]) {
  await Promise.all(
    ordered.map(({ id, position }) =>
      supabase.from("ccih_kanban_columns").update({ position }).eq("id", id),
    ),
  );
}

export async function createTask(input: {
  columnId: string;
  title: string;
  description?: string;
  recurrence: Recurrence;
}): Promise<KanbanTask> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("ccih_kanban_tasks")
    .insert({
      user_id,
      column_id: input.columnId,
      title: input.title,
      description: input.description ?? null,
      recurrence: input.recurrence,
      position: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return taskFromRow(data as TaskRow);
}

export async function moveTask(id: string, columnId: string) {
  const { error } = await supabase.from("ccih_kanban_tasks").update({ column_id: columnId }).eq("id", id);
  if (error) throw error;
}

export async function reassignTasks(fromColumn: string, toColumn: string) {
  const { error } = await supabase
    .from("ccih_kanban_tasks")
    .update({ column_id: toColumn })
    .eq("column_id", fromColumn);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("ccih_kanban_tasks").delete().eq("id", id);
  if (error) throw error;
}

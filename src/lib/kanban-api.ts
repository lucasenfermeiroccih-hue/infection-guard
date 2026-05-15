import { supabase } from "@/integrations/supabase/client";
import type { KanbanColumn, KanbanTask, Recurrence, HospitalUser } from "./types";

type ColRow = {
  id: string;
  user_id: string;
  title: string;
  position: number;
  hospital_id: string | null;
};
type TaskRow = {
  id: string;
  user_id: string;
  column_id: string;
  hospital_id: string | null;
  title: string;
  description: string | null;
  recurrence: Recurrence;
  position: number;
  assigned_to: string | null;
  assigned_by: string | null;
  priority: string;
  status: string;
  last_completed_at: string | null;
};

function getHospitalId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("selected_hospital_id");
}

const colFromRow = (r: ColRow): KanbanColumn => ({
  id: r.id,
  title: r.title,
  order: r.position,
  hospitalId: r.hospital_id ?? undefined,
});

const taskFromRow = (r: TaskRow & { profiles?: { full_name: string } | null }): KanbanTask => ({
  id: r.id,
  columnId: r.column_id,
  hospitalId: r.hospital_id ?? undefined,
  title: r.title,
  description: r.description ?? undefined,
  recurrence: r.recurrence,
  position: r.position,
  assignedTo: r.assigned_to ?? undefined,
  assignedBy: r.assigned_by ?? undefined,
  assignedToName: (r as any).profiles?.full_name ?? undefined,
  priority: (r.priority as KanbanTask["priority"]) ?? "normal",
  status: (r.status as KanbanTask["status"]) ?? "in_progress",
  lastCompletedAt: r.last_completed_at ?? undefined,
});

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Não autenticado");
  return data.user.id;
}

export async function loadBoard(): Promise<{ columns: KanbanColumn[]; tasks: KanbanTask[] }> {
  const hospitalId = getHospitalId();

  let colQuery = supabase.from("kanban_columns").select("*").order("position");
  let taskQuery = supabase
    .from("kanban_tasks")
    .select("*, profiles(full_name)")
    .order("position");

  if (hospitalId) {
    colQuery = colQuery.eq("hospital_id", hospitalId) as any;
    taskQuery = taskQuery.eq("hospital_id", hospitalId) as any;
  }

  const [{ data: cols, error: e1 }, { data: tasks, error: e2 }] = await Promise.all([
    colQuery,
    taskQuery,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    columns: (cols as ColRow[]).map(colFromRow),
    tasks: (tasks as any[]).map(taskFromRow),
  };
}

export async function listHospitalUsers(): Promise<HospitalUser[]> {
  const hospitalId = getHospitalId();
  if (!hospitalId) return [];

  const { data, error } = await supabase
    .from("hospital_users")
    .select("user_id, profiles(full_name, email)")
    .eq("hospital_id", hospitalId) as any;

  if (error) return [];

  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? row.profiles?.email ?? "Usuário",
    email: row.profiles?.email ?? "",
  }));
}

export async function checkIsAdmin(): Promise<boolean> {
  const hospitalId = getHospitalId();
  if (!hospitalId) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;

  const { data: row } = await supabase
    .from("hospital_users")
    .select("is_primary_admin")
    .eq("hospital_id", hospitalId)
    .eq("user_id", data.user.id)
    .maybeSingle() as any;

  return row?.is_primary_admin === true;
}

export async function createColumn(title: string, position: number): Promise<KanbanColumn> {
  const user_id = await uid();
  const hospital_id = getHospitalId();
  const { data, error } = await supabase
    .from("kanban_columns")
    .insert({ user_id, title, position, hospital_id })
    .select()
    .single();
  if (error) throw error;
  return colFromRow(data as ColRow);
}

export async function updateColumnTitle(id: string, title: string) {
  const { error } = await supabase.from("kanban_columns").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteColumn(id: string) {
  const { error } = await supabase.from("kanban_columns").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderColumns(ordered: { id: string; position: number }[]) {
  await Promise.all(
    ordered.map(({ id, position }) =>
      supabase.from("kanban_columns").update({ position }).eq("id", id),
    ),
  );
}

export async function createTask(input: {
  columnId: string;
  title: string;
  description?: string;
  recurrence: Recurrence;
  position?: number;
  assignedTo?: string;
  priority?: KanbanTask["priority"];
}): Promise<KanbanTask> {
  const user_id = await uid();
  const hospital_id = getHospitalId();
  const { data, error } = await supabase
    .from("kanban_tasks")
    .insert({
      user_id,
      column_id: input.columnId,
      hospital_id,
      title: input.title,
      description: input.description ?? null,
      recurrence: input.recurrence,
      position: input.position ?? 0,
      assigned_to: input.assignedTo ?? null,
      assigned_by: input.assignedTo ? user_id : null,
      priority: input.priority ?? "normal",
      status: "in_progress",
    })
    .select("*, profiles(full_name)")
    .single();
  if (error) throw error;
  return taskFromRow(data as any);
}

export async function updateTask(id: string, input: {
  title?: string;
  description?: string | null;
  recurrence?: Recurrence;
  assignedTo?: string | null;
  priority?: KanbanTask["priority"];
}) {
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.recurrence !== undefined) update.recurrence = input.recurrence;
  if ("assignedTo" in input) update.assigned_to = input.assignedTo ?? null;
  if (input.priority !== undefined) update.priority = input.priority;

  if (update.assigned_to !== undefined) {
    const user_id = await uid();
    update.assigned_by = update.assigned_to ? user_id : null;
  }

  const { error } = await supabase.from("kanban_tasks").update(update).eq("id", id);
  if (error) throw error;
}

export async function setTaskStatus(id: string, status: KanbanTask["status"]) {
  const update: Record<string, unknown> = { status };
  if (status === "completed") update.last_completed_at = new Date().toISOString();
  const { error } = await supabase.from("kanban_tasks").update(update).eq("id", id);
  if (error) throw error;
}

export async function moveTask(id: string, columnId: string, position?: number) {
  const update: Record<string, unknown> = { column_id: columnId };
  if (position !== undefined) update.position = position;
  const { error } = await supabase.from("kanban_tasks").update(update).eq("id", id);
  if (error) throw error;
}

export async function reorderTasks(ordered: { id: string; position: number }[]) {
  await Promise.all(
    ordered.map(({ id, position }) =>
      supabase.from("kanban_tasks").update({ position }).eq("id", id),
    ),
  );
}

export async function reassignTasks(fromColumn: string, toColumn: string) {
  const { error } = await supabase
    .from("kanban_tasks")
    .update({ column_id: toColumn })
    .eq("column_id", fromColumn);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("kanban_tasks").delete().eq("id", id);
  if (error) throw error;
}

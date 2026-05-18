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
  kanban_task_assignees?: { user_id: string; profiles: { full_name: string } | null }[];
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

const taskFromRow = (r: TaskRow): KanbanTask => {
  const assignees = r.kanban_task_assignees ?? [];
  return {
    id: r.id,
    columnId: r.column_id,
    hospitalId: r.hospital_id ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    recurrence: r.recurrence,
    position: r.position,
    assignedTo: assignees.length > 0 ? assignees.map((a) => a.user_id) : undefined,
    assignedBy: r.assigned_by ?? undefined,
    assignedToNames: assignees.length > 0 ? assignees.map((a) => a.profiles?.full_name ?? "Usuário") : undefined,
    priority: (r.priority as KanbanTask["priority"]) ?? "normal",
    status: (r.status as KanbanTask["status"]) ?? "in_progress",
    lastCompletedAt: r.last_completed_at ?? undefined,
  };
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Não autenticado");
  return data.user.id;
}

export async function loadBoard(filterByUserId?: string): Promise<{ columns: KanbanColumn[]; tasks: KanbanTask[] }> {
  const hospitalId = getHospitalId();

  let colQuery = supabase.from("kanban_columns").select("*").order("position");
  let taskQuery = supabase.from("kanban_tasks").select("*").order("position");

  if (hospitalId) {
    colQuery = colQuery.eq("hospital_id", hospitalId) as any;
    taskQuery = taskQuery.eq("hospital_id", hospitalId) as any;
  }

  // Para usuários não-admin: filtra apenas as tarefas atribuídas ao usuário
  let allowedTaskIds: string[] | null = null;
  if (filterByUserId) {
    const { data: aRows } = await (supabase as any)
      .from("kanban_task_assignees")
      .select("task_id")
      .eq("user_id", filterByUserId);
    allowedTaskIds = (aRows ?? []).map((r: any) => r.task_id);
    if (allowedTaskIds!.length === 0) {
      const { data: cols, error: e1 } = await colQuery;
      if (e1) throw e1;
      return { columns: (cols as ColRow[]).map(colFromRow), tasks: [] };
    }
    taskQuery = taskQuery.in("id", allowedTaskIds!) as any;
  }

  const [{ data: cols, error: e1 }, { data: tasks, error: e2 }] = await Promise.all([
    colQuery,
    taskQuery,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  // Busca responsáveis de todas as tarefas (sem embed PostgREST para evitar ambiguidade)
  const taskIds = (tasks as TaskRow[]).map((t) => t.id);
  const assigneesByTask = new Map<string, { user_id: string; profiles: { full_name: string } | null }[]>();
  if (taskIds.length > 0) {
    const { data: aRows } = await (supabase as any)
      .from("kanban_task_assignees")
      .select("task_id, user_id")
      .in("task_id", taskIds);
    const rows: { task_id: string; user_id: string }[] = aRows ?? [];
    // Busca nomes em profiles diretamente
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds) as any;
      for (const p of profileRows ?? []) nameMap.set(p.user_id, p.full_name ?? "Usuário");
    }
    for (const a of rows) {
      if (!assigneesByTask.has(a.task_id)) assigneesByTask.set(a.task_id, []);
      assigneesByTask.get(a.task_id)!.push({ user_id: a.user_id, profiles: { full_name: nameMap.get(a.user_id) ?? "Usuário" } });
    }
  }

  return {
    columns: (cols as ColRow[]).map(colFromRow),
    tasks: (tasks as TaskRow[]).map((t) => taskFromRow({ ...t, kanban_task_assignees: assigneesByTask.get(t.id) ?? [] })),
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
  assignedTo?: string[];
  priority?: KanbanTask["priority"];
}): Promise<KanbanTask> {
  const user_id = await uid();
  const hospital_id = getHospitalId();
  const firstAssignee = input.assignedTo?.[0] ?? null;
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
      assigned_to: firstAssignee,
      assigned_by: firstAssignee ? user_id : null,
      priority: input.priority ?? "normal",
      status: "in_progress",
    })
    .select()
    .single();
  if (error) throw error;

  if (input.assignedTo && input.assignedTo.length > 0) {
    await (supabase as any)
      .from("kanban_task_assignees")
      .insert(input.assignedTo.map((assigneeId) => ({ task_id: data.id, user_id: assigneeId })));
  }

  // Recarrega responsáveis sem embed PostgREST
  let assigneesRows: { user_id: string; profiles: { full_name: string } | null }[] = [];
  if (input.assignedTo && input.assignedTo.length > 0) {
    const nameMap = new Map<string, string>();
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", input.assignedTo) as any;
    for (const p of profileRows ?? []) nameMap.set(p.user_id, p.full_name ?? "Usuário");
    assigneesRows = input.assignedTo.map((uid) => ({ user_id: uid, profiles: { full_name: nameMap.get(uid) ?? "Usuário" } }));
  }
  return taskFromRow({ ...(data as TaskRow), kanban_task_assignees: assigneesRows });
}

export async function updateTask(id: string, input: {
  title?: string;
  description?: string | null;
  recurrence?: Recurrence;
  assignedTo?: string[] | null;
  priority?: KanbanTask["priority"];
}) {
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.recurrence !== undefined) update.recurrence = input.recurrence;
  if (input.priority !== undefined) update.priority = input.priority;

  if ("assignedTo" in input) {
    const firstAssignee = input.assignedTo?.[0] ?? null;
    update.assigned_to = firstAssignee;
    const user_id = await uid();
    update.assigned_by = firstAssignee ? user_id : null;
  }

  const { error } = await supabase.from("kanban_tasks").update(update).eq("id", id);
  if (error) throw error;

  if ("assignedTo" in input) {
    await (supabase as any).from("kanban_task_assignees").delete().eq("task_id", id);
    if (input.assignedTo && input.assignedTo.length > 0) {
      await (supabase as any)
        .from("kanban_task_assignees")
        .insert(input.assignedTo.map((assigneeId) => ({ task_id: id, user_id: assigneeId })));
    }
  }
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

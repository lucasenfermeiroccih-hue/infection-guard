export type Role = "ccih" | "diretoria" | "assistencial";

export interface Session {
  userId: string;
  name: string;
  role: Role;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type ActionStatus = "planejado" | "em_andamento" | "concluido";

export const SECTORS = [
  "UTI Neonatal",
  "UTI Adulto",
  "UTI Pediátrica",
  "Centro Cirúrgico",
  "Enfermaria",
  "Pronto Socorro",
  "Hemodiálise",
  "Maternidade",
] as const;

export type Sector = (typeof SECTORS)[number];

export const INFECTION_TYPES = [
  "ICSC-CVC",
  "PAV",
  "ITU-CA",
  "ISC",
  "Outros",
] as const;

export type InfectionType = (typeof INFECTION_TYPES)[number];

export interface Action5W2H {
  id: string;
  what: string;
  why: string;
  where: Sector;
  who: string;
  when: string; // ISO date
  how: string;
  howMuch: string;
  status: ActionStatus;
  infectionType: InfectionType;
  createdAt: string;
}

export type Recurrence = "none" | "daily" | "weekly" | "monthly";
export type TaskPriority = "low" | "normal" | "high";
export type TaskStatus = "in_progress" | "completed";

export interface HospitalUser {
  userId: string;
  fullName: string;
  email: string;
}

export interface KanbanTask {
  id: string;
  columnId: string;
  hospitalId?: string;
  title: string;
  description?: string;
  recurrence?: Recurrence;
  position: number;
  assignedTo?: string;
  assignedBy?: string;
  assignedToName?: string;
  priority: TaskPriority;
  status: TaskStatus;
  lastCompletedAt?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  order: number;
  hospitalId?: string;
}

export interface KanbanBoard {
  title: string;
  columns: KanbanColumn[];
  tasks: KanbanTask[];
}

export interface AppSettings {
  notifyEmail: boolean;
  notifyPush: boolean;
}

export interface IrasPoint {
  date: string; // YYYY-MM
  rate: number;
  sector: Sector;
}

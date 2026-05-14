import { supabase } from "@/integrations/supabase/client";
import type { Action5W2H, ActionStatus, InfectionType, Sector } from "./types";

type Row = {
  id: string;
  user_id: string;
  hospital_id: string | null;
  what: string;
  why: string;
  where_sector: string;
  who: string;
  when_date: string;
  how: string;
  how_much: string | null;
  status: ActionStatus;
  infection_type: string;
  created_at: string;
  updated_at: string;
};

function getHospitalId(): string | null {
  return localStorage.getItem("selected_hospital_id");
}

const fromRow = (r: Row): Action5W2H => ({
  id: r.id,
  what: r.what,
  why: r.why,
  where: r.where_sector as Sector,
  who: r.who,
  when: r.when_date,
  how: r.how,
  howMuch: r.how_much ?? "",
  status: r.status,
  infectionType: r.infection_type as InfectionType,
  createdAt: r.created_at,
});

export async function listActions(): Promise<Action5W2H[]> {
  const hospitalId = getHospitalId();
  let query = supabase.from("actions").select("*").order("created_at", { ascending: false });
  if (hospitalId) query = query.eq("hospital_id", hospitalId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function getAction(id: string): Promise<Action5W2H | null> {
  const { data, error } = await supabase.from("actions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

export async function createAction(
  input: Omit<Action5W2H, "id" | "createdAt" | "status"> & { status?: ActionStatus }
): Promise<Action5W2H> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("actions")
    .insert({
      user_id: userId,
      hospital_id: getHospitalId(),
      what: input.what,
      why: input.why,
      where_sector: input.where,
      who: input.who,
      when_date: input.when,
      how: input.how,
      how_much: input.howMuch || null,
      status: input.status ?? "planejado",
      infection_type: input.infectionType,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function updateActionStatus(id: string, status: ActionStatus) {
  const { error } = await supabase.from("actions").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteAction(id: string) {
  const { error } = await supabase.from("actions").delete().eq("id", id);
  if (error) throw error;
}

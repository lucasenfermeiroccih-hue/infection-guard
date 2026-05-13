import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STORAGE_KEYS, readLS, writeLS, uid } from "@/lib/storage";
import { SECTORS, INFECTION_TYPES, type Action5W2H, type Sector, type InfectionType, type User } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/actions/new")({
  head: () => ({
    meta: [
      { title: "Nova Ação 5W2H — CCIH" },
      { name: "description", content: "Formulário estruturado para planejamento de intervenções 5W2H." },
    ],
  }),
  component: NewActionPage,
});

const schema = z.object({
  what: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
  why: z.string().trim().min(3).max(500),
  where: z.enum(SECTORS),
  who: z.string().trim().min(2).max(120),
  when: z.string().min(1, "Defina uma data"),
  how: z.string().trim().min(3).max(500),
  howMuch: z.string().trim().max(60).optional().default(""),
  infectionType: z.enum(INFECTION_TYPES),
});

type FormValues = z.infer<typeof schema>;

function NewActionPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => { setUsers(readLS<User[]>(STORAGE_KEYS.users, [])); }, []);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      what: "", why: "", where: "UTI Adulto" as Sector, who: "",
      when: new Date().toISOString().slice(0, 10), how: "", howMuch: "",
      infectionType: "ICSC-CVC" as InfectionType,
    },
  });

  const onSubmit = (data: FormValues) => {
    const all = readLS<Action5W2H[]>(STORAGE_KEYS.actions, []);
    const action: Action5W2H = {
      id: uid(),
      ...data,
      howMuch: data.howMuch ?? "",
      status: "planejado",
      createdAt: new Date().toISOString(),
    };
    writeLS(STORAGE_KEYS.actions, [action, ...all]);
    toast.success("Ação criada e responsáveis notificados");
    navigate({ to: "/actions" });
  };

  const fields: { name: keyof FormValues; label: string; placeholder: string; long?: boolean }[] = [
    { name: "what", label: "What — O quê?", placeholder: "Ex: Reforço de higienização das mãos" },
    { name: "why", label: "Why — Por quê?", placeholder: "Justificativa (protocolos ANVISA, indicadores...)", long: true },
    { name: "how", label: "How — Como?", placeholder: "Plano de execução, recursos necessários...", long: true },
    { name: "howMuch", label: "How Much — Quanto custa?", placeholder: "Ex: R$ 1.200" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Nova Ação 5W2H</CardTitle>
          <CardDescription>Planejamento estruturado conforme metodologia 5W2H.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{fields[0].label}</Label>
              <Input {...register("what")} placeholder={fields[0].placeholder} />
              {errors.what && <p className="text-xs text-destructive">{errors.what.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>{fields[1].label}</Label>
              <Textarea {...register("why")} placeholder={fields[1].placeholder} rows={3} />
              {errors.why && <p className="text-xs text-destructive">{errors.why.message}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Where — Onde?</Label>
                <Select value={watch("where")} onValueChange={(v) => setValue("where", v as Sector)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Who — Quem (responsável)?</Label>
                <Select value={watch("who")} onValueChange={(v) => setValue("who", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.who && <p className="text-xs text-destructive">{errors.who.message}</p>}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>When — Quando (prazo)?</Label>
                <Input type="date" {...register("when")} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de infecção alvo</Label>
                <Select value={watch("infectionType")} onValueChange={(v) => setValue("infectionType", v as InfectionType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INFECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{fields[2].label}</Label>
              <Textarea {...register("how")} placeholder={fields[2].placeholder} rows={3} />
              {errors.how && <p className="text-xs text-destructive">{errors.how.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>{fields[3].label}</Label>
              <Input {...register("howMuch")} placeholder={fields[3].placeholder} />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/actions" })}>Cancelar</Button>
              <Button type="submit">Salvar Ação</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import {
  STORAGE_KEYS,
  readLS,
  writeLS,
  uid,
} from "./storage";
import type {
  Action5W2H,
  AppSettings,
  IrasPoint,
  KanbanBoard,
  User,
} from "./types";

export function ensureSeed() {
  if (typeof window === "undefined") return;
  if (readLS<boolean>(STORAGE_KEYS.seeded, false)) return;

  const users: User[] = [
    { id: uid(), name: "Dra. Marina Souza", email: "marina@ccih.hosp", role: "ccih" },
    { id: uid(), name: "Enf. Carla Lima", email: "carla@ccih.hosp", role: "assistencial" },
    { id: uid(), name: "Dr. Paulo Mendes", email: "paulo@ccih.hosp", role: "diretoria" },
    { id: uid(), name: "Enf. Chefe João Silva", email: "joao@ccih.hosp", role: "assistencial" },
  ];
  writeLS<User[]>(STORAGE_KEYS.users, users);

  const actions: Action5W2H[] = [
    {
      id: uid(),
      what: "Reforço de higienização das mãos",
      why: "Aderência abaixo da meta ANVISA (RDC 42/2010)",
      where: "UTI Neonatal",
      who: users[3].name,
      when: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      how: "Treinamento presencial + auditoria semanal",
      howMuch: "R$ 1.200",
      status: "em_andamento",
      infectionType: "ICSC-CVC",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      what: "Bundle de prevenção de PAV",
      why: "Aumento de 12% nos casos de PAV no último trimestre",
      where: "UTI Adulto",
      who: users[0].name,
      when: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      how: "Implementação de checklist diário",
      howMuch: "R$ 3.500",
      status: "planejado",
      infectionType: "PAV",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid(),
      what: "Auditoria de cateter vesical",
      why: "Reduzir ITU-CA conforme meta institucional",
      where: "Enfermaria",
      who: users[1].name,
      when: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
      how: "Inspeção diária e remoção precoce",
      howMuch: "R$ 800",
      status: "concluido",
      infectionType: "ITU-CA",
      createdAt: new Date().toISOString(),
    },
  ];
  writeLS<Action5W2H[]>(STORAGE_KEYS.actions, actions);

  const col1 = uid(), col2 = uid(), col3 = uid();
  const kanban: KanbanBoard = {
    title: "Quadro CCIH",
    columns: [
      { id: col1, title: "A Fazer", order: 0 },
      { id: col2, title: "Em Andamento", order: 1 },
      { id: col3, title: "Concluído", order: 2 },
    ],
    tasks: [
      { id: uid(), columnId: col1, title: "Atualizar POP de higienização", description: "Revisar com base na RDC 36/2013" },
      { id: uid(), columnId: col2, title: "Treinamento equipe noturna", description: "Centro Cirúrgico" },
      { id: uid(), columnId: col3, title: "Relatório mensal IRAS", description: "Enviado à diretoria" },
    ],
  };
  writeLS<KanbanBoard>(STORAGE_KEYS.kanban, kanban);

  const settings: AppSettings = { notifyEmail: true, notifyPush: false };
  writeLS<AppSettings>(STORAGE_KEYS.settings, settings);

  const months = 8;
  const sectors = ["UTI Neonatal", "UTI Adulto", "Centro Cirúrgico"] as const;
  const series: IrasPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ym = d.toISOString().slice(0, 7);
    sectors.forEach((s, idx) => {
      const base = 4.5 - idx * 0.4;
      const trend = (months - i) * 0.15;
      series.push({
        date: ym,
        sector: s,
        rate: Math.max(0.5, +(base - trend + Math.random() * 0.6).toFixed(2)),
      });
    });
  }
  writeLS<IrasPoint[]>(STORAGE_KEYS.iras, series);

  writeLS(STORAGE_KEYS.seeded, true);
}

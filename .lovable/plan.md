# CCIH 5W2H — Plano de Implementação

App de planejamento e monitoramento de ações de controle de infecção hospitalar usando metodologia 5W2H, com Kanban, dashboard de indicadores, relatórios exportáveis e RBAC.

## Escopo desta primeira entrega

Versão **frontend-only com persistência em localStorage** (mock auth, mock data). Sem Lovable Cloud nesta etapa — facilita prototipagem rápida das 7 telas. Backend real (auth hospitalar, banco, RBAC server-side, notificações) pode ser ativado depois.

## Stack e bibliotecas

- TanStack Start + React 19 + Tailwind v4 (já configurado)
- shadcn/ui (já presente)
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag & drop do Kanban
- `recharts` — gráfico evolutivo de IRAS
- `react-hook-form` + `zod` — validação dos formulários 5W2H
- `xlsx` — exportação Excel
- `jspdf` + `jspdf-autotable` — PDF executivo
- `date-fns` — datas
- `sonner` (já presente) — notificações

## Estrutura de rotas

```
src/routes/
  __root.tsx              shell + QueryClient + Toaster
  index.tsx               /         → Login (conforme spec)
  _app.tsx                layout autenticado: sidebar + topbar + <Outlet/>
  _app/dashboard.tsx      /dashboard   KPIs + gráfico IRAS
  _app/kanban.tsx         /kanban      Quadro Kanban genérico
  _app/actions.index.tsx  /actions     Kanban de status das ações 5W2H
  _app/actions.new.tsx    /actions/new Formulário 5W2H
  _app/actions.$id.tsx    /actions/:id Detalhes da ação
  _app/reports.tsx        /reports     Filtros + export Excel/PDF
  _app/settings.tsx       /settings    Usuários, permissões, notificações
```

Guarda de auth: `_app.tsx` usa `beforeLoad` para checar `localStorage.ccih_session`; redireciona para `/` se ausente.

## Modelo de dados (localStorage)

```ts
ccih_session    : { userId, name, role: 'ccih'|'diretoria'|'assistencial' }
ccih_actions    : Action5W2H[]   // what, why, where, who, when, how, howMuch, status, sector, infectionType
ccih_kanban     : { columns: Column[], tasks: Task[] }   // quadro genérico
ccih_users      : User[]         // para tela settings
ccih_settings   : { notifyEmail, notifyPush }
ccih_iras_series: { date, rate, sector }[]  // série mock para gráfico
```

Seed inicial criado em `src/lib/seed.ts` na primeira visita.

## Telas — detalhes de implementação

**Login (`/`)** — card centralizado, inputs "Credencial / Token", botão "Entrar via Biometria" (mock). Salva sessão e navega para `/dashboard`.

**Dashboard (`/dashboard`)** — grid de KPI cards (Taxa IRAS, Adesão a protocolos, Ações em andamento, Ações atrasadas), botão CTA "Nova Ação 5W2H" → `/actions/new`, gráfico de linha Recharts com evolução IRAS por mês.

**Kanban genérico (`/kanban`)** — colunas em scroll horizontal, dnd-kit para arrastar cards e reordenar colunas, título de coluna editável inline (bloqueio de string vazia), modal de remoção de coluna com escolha (excluir tarefas vs. mover para outra coluna), modais de criação de coluna/tarefa, botão "Sair" no topbar.

**Criar Ação (`/actions/new`)** — formulário 5W2H completo com os 7 campos (What, Why, Where, Who, When, How, How Much). Validação Zod com limites de tamanho. Selects para setor (UTI Neonatal, UTI Adulto, Centro Cirúrgico, Enfermaria, etc.) e responsável (lista de usuários). Salva e dispara toast.

**Gerenciamento (`/actions`)** — Kanban especializado em 3 colunas fixas (Planejado, Em Andamento, Concluído). Cada card mostra What + setor + responsável + prazo; clique → `/actions/:id`.

**Detalhes (`/actions/:id`)** — exibe os 7 campos, status, histórico, botões editar/excluir.

**Relatórios (`/reports`)** — filtros (setor, tipo de infecção ICSC-CVC/PAV/ITU-CA/ISC, status, intervalo de datas), tabela de resultados, botão "Exportar Excel" (xlsx.utils.json_to_sheet) e "Gerar PDF Executivo" (jsPDF + autotable com cabeçalho institucional).

**Configurações (`/settings`)** — tabela de usuários com select de role (CCIH / Diretoria / Assistencial), toggles para notificações push e e-mail. Persistido em localStorage.

## Layout compartilhado

`_app.tsx` renderiza Sidebar (Dashboard, Kanban, Ações, Relatórios, Configurações) + Topbar (título da página, botão "Nova Ação", avatar com Sair) + `<Outlet/>`. Tema clean médico-hospitalar: azul/teal primário, cinza neutro, com tokens em `src/styles.css` (oklch). Suporte a dark mode.

## Detalhes técnicos

- Tudo client-side; sem server functions nesta fase
- DnD: `DndContext` + `SortableContext` para colunas e cards
- Formulários: `react-hook-form` + `zodResolver`
- Persistência: hook `useLocalStorage<T>(key, initial)` em `src/hooks/`
- RBAC mock: helper `hasRole(role)` lê sessão; oculta itens da sidebar/botões conforme role
- SEO: cada rota define `head()` com title/description próprios

## Ordem de execução

1. Instalar deps (`@dnd-kit/core @dnd-kit/sortable recharts xlsx jspdf jspdf-autotable react-hook-form @hookform/resolvers zod date-fns`)
2. Tokens de design + tema em `styles.css`
3. Tipos, seed e hook `useLocalStorage`
4. Layout `_app` + guarda de auth + Sidebar/Topbar
5. Login (`/`)
6. Dashboard
7. Kanban genérico (`/kanban`) com dnd-kit
8. Formulário 5W2H + lista/Kanban de ações + detalhes
9. Relatórios + exports
10. Configurações + RBAC mock

## Observações / decisões em aberto

- A spec lista Login em `/` **e** Dashboard separado — segui isso (raiz = login). Confirme se prefere `/login` em vez de `/`.
- Auth/biometria reais ficarão como mock; quando quiser persistência real e RBAC server-side, ativamos Lovable Cloud.
- Notificações por e-mail/push são apenas toggles visuais nesta fase.

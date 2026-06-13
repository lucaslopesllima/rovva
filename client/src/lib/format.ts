// Formatadores compartilhados (antes duplicados em Kanban/Finance/Routes/Catalog).

// moeda com centavos (financeiro, catálogo)
export const brl = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// moeda sem centavos (KPIs/cards, onde centavo é ruído)
export const brl0 = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// 'YYYY-MM-DD' -> data pt-BR (T00:00:00 evita shift de fuso)
export const fmtDate = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');

export const todayStr = (): string => new Date().toISOString().slice(0, 10);

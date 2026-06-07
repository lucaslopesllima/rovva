export interface Recommendation {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: number;
  municipio_id: number;
  uf: string;
  porte: string;
  capital_social: string;
  lat: number;
  lon: number;
  score: number;
  reason: {
    cnae_match: 'classe' | 'divisao' | 'secao' | 'nenhum';
    cnae_principal: number;
    distancia_km: number;
    porte: string;
    capital_social: number;
    componentes: { cnae: number; proximidade: number; porte: number };
  };
}

export interface Profile {
  org_id: string;
  cnaes_alvo: number[];
  territorio_municipios: number[];
  territorio_raio_km: number | null;
  pesos: { cnae: number; proximidade: number; porte: number };
}

export interface Municipio { id: number; nome: string; uf: string; regiao: string }

export interface CnaeItem { codigo: number; descricao: string; secao: string; divisao: number }
export interface CnaeGrupo { divisao: number; secao: string; itens: CnaeItem[] }

export interface Stage { id: number; nome: string; ordem: number }

export interface RepresentedCompany {
  id: number; nome: string; cnpj: string | null; segmento: string | null;
  site: string | null; contato: string | null; notas: string | null; ativo: boolean;
}
export interface KanbanCard {
  id: number; company_id: number; stage_id: number | null; status: string;
  valor_estimado: string | null; notas: string | null; razao_social: string; nome_fantasia: string | null;
  uf: string; municipio_id: number; cidade: string | null;
  cnpj: string; cnae_principal: number; porte: string; capital_social: string;
  // FKs into the prospecção cadastros + their joined labels.
  represented_id: number | null; representada: string | null;
  marca_id: number | null; marca: string | null;
  contatos: { id: number; nome: string; cargo: string | null }[];
  catalogo: { id: number; nome: string; codigo: string | null; preco: string | null }[];
  cenario_id: number | null; cenario: string | null;
  acao_id: number | null; acao: string | null;
  data_contato: string | null; previsao_data: string | null;
}

export interface CompanyDetail {
  id: number; cnpj: string; razao_social: string; nome_fantasia: string | null;
  cnae_principal: number; cnae_descricao: string | null; cnae_secundarios: number[];
  uf: string; municipio_id: number | null; cidade: string | null; regiao: string;
  porte: string; capital_social: string; situacao_cadastral: string; source: string;
  lat: number | null; lon: number | null; raw_data: Record<string, unknown> | null;
}

export interface CatalogItem {
  id: number; nome: string; codigo: string | null; descricao: string | null;
  preco: string | null; represented_id: number | null; ativo: boolean;
}

export interface Brand { id: number; represented_id: number; nome: string }
export interface Contact {
  id: number; nome: string; cargo: string | null; email: string | null; telefone: string | null;
  company_id: number | null; represented_id: number | null;
}
export interface NamedItem { id: number; nome: string }

export interface Relationship {
  id: number; company_id: number; stage_id: number | null; status: string;
  valor_estimado: string | null; notas: string | null; razao_social: string;
}

export interface Activity {
  id: number; tipo: string; titulo: string; start_at: string; end_at: string | null;
  company_id: number | null; status: string; razao_social: string | null;
}

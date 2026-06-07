# Prospecta — Prospecção inteligente para representantes comerciais

SaaS multi-tenant que, a partir de uma **base compartilhada de empresas** (Receita
Federal), recomenda a cada representante quais empresas abordar — priorizando por
**CNAE-alvo + proximidade geográfica + porte**, dentro do território dele. Em volta há
um CRM leve: perfil-alvo, recomendação explicável (lista + mapa), funil kanban e agenda.

> WhatsApp/inbox está **fora de escopo** (fase 2).

---

## Princípio de dados — base compartilhada

A tabela `companies` é uma **base única e global**, comum a todos os tenants:

- Nunca é escopada por `org_id`, nunca é duplicada por tenant.
- É populada/atualizada **exclusivamente pelo ETL da Receita**. Para a aplicação,
  `companies` é **somente-leitura** — nenhuma rota de usuário insere/edita/apaga empresa.
- Tenants não possuem empresas. Eles criam **referências** em `company_relationships`
  (ponteiro `org → company` com estado próprio: status, stage, owner, notas, valor).
- A MESMA empresa pode ser referenciada por vários tenants, cada um com seu
  relacionamento isolado. `UNIQUE(org_id, company_id)` garante 1 referência por tenant.
- "Meu funil" = `company_relationships JOIN companies WHERE org_id = me`.
- A recomendação lê `companies` (global) e **exclui** as já referenciadas pelo tenant
  (`NOT EXISTS` em `company_relationships`).

---

## Arquitetura

Um único `docker compose`, 2 serviços, pensado para uma VPS barata:

- **db** — `postgis/postgis:16-3.4`, volume persistente, healthcheck.
- **app** — container Node multi-stage que builda o React (Vite) e, no mesmo
  processo, o Fastify serve os estáticos **e** a API (`/api/*`).

Sem Redis, sem fila, sem nginx separado.

### Stack (mínimo de dependências)

| Camada   | Tech                                                                    |
|----------|-------------------------------------------------------------------------|
| Backend  | Node 24 LTS · TypeScript (rodado nativo, type-stripping) · Fastify · `pg` (SQL cru) · `jose` (JWT) · scrypt (`node:crypto`) |
| Banco    | PostgreSQL 16 + PostGIS + `pg_trgm`                                      |
| Frontend | React 19 · Vite 6 · react-router · Leaflet + react-leaflet (OSM) · Tailwind v4 |
| ETL      | CLI Node standalone, streaming/batch                                     |

Sem ORM, sem axios/lodash/moment, sem lib de componentes UI. `fetch` nativo, `Intl`,
`node:crypto`. Migrations = arquivos `.sql` versionados rodados por um script próprio.

---

## Subir o projeto

Há dois arquivos compose:

| Arquivo                     | Para quê                                  | Como rodar                              |
|-----------------------------|-------------------------------------------|-----------------------------------------|
| `docker-compose.yml`        | **Desenvolvimento** (padrão, hot reload)  | `docker compose up`                     |
| `docker-compose.prod.yml`   | **Produção** (build estático) — só na VPS | `./deploy.sh`                           |

### Desenvolvimento (local, hot reload) — `docker compose up`

```bash
docker compose up        # UI :5173 (Vite/HMR) · API :8080 (node --watch)
```

- O código é bind-mounted: editou `.tsx` → HMR no browser; editou o servidor → Fastify
  reinicia em ~1s. `node_modules` ficam em volumes nomeados (instalados no container).
- Migrations rodam no boot do `app`. Acesse **http://localhost:5173** → **Criar conta**
  (cria org + admin + etapas padrão do kanban + perfil-alvo vazio).
- Não precisa de `.env` no dev (valores embutidos no compose).

### Produção (na VPS) — `./deploy.sh`

```bash
cp .env.example .env     # defina JWT_SECRET (forte!) e POSTGRES_PASSWORD
./deploy.sh              # build + up -d + health + prune
```

`deploy.sh` roda **só na VPS**: valida o `.env` (recusa segredos fracos), faz `git pull`
(se for repo), builda a imagem multi-stage, sobe `docker-compose.prod.yml`, espera o
`/api/health` e limpa imagens antigas. App em `http://<vps>:${APP_PORT:-8080}` (coloque
um proxy/TLS na frente em produção). `SKIP_GIT=1 ./deploy.sh` pula o pull.

### Rodar migrations manualmente (opcional)

```bash
# dev
docker compose exec app node scripts/migrate.ts
# prod
docker compose -f docker-compose.prod.yml exec app node scripts/migrate.ts
```

O runner cria `schema_migrations`, aplica `migrations/*.sql` em ordem (uma vez cada)
e re-aplica `migrations/seeds/*.sql` (idempotentes via `ON CONFLICT`).

---

## ETL — carregar uma UF da Receita Federal

O ETL é o **único escritor** de `companies` com `source='rfb'`. Idempotente
(UPSERT por CNPJ). Processa em streaming + lotes (aguenta milhões de linhas sem
estourar memória) usando tabelas de staging `UNLOGGED`.

### Arquivos de entrada (dados abertos da RFB)

CSV `latin1`, delimitador `;`, sem cabeçalho, campos podendo vir entre aspas. Baixe
e descompacte num diretório, depois monte-o no container:

- **Estabelecimentos** (`ESTABELE*`): trazem UF, município (código RFB), CNAE, situação.
- **Empresas** (`EMPRE*`): trazem razão social, capital social, porte (por raiz do CNPJ).
- **Simples** (`SIMPLES*`, opcional): usado para **excluir MEI** (`OPCAO_MEI='S'`).
- **De-para de município** (CSV `rfb;ibge`, opcional): converte o código de município
  da RFB para o código **IBGE** usado em `municipios` (necessário para `geom`).

> Sem o Simples, MEI **não** é excluído. Sem o de-para, `municipio_id`/`geom` ficam
> nulos (a recomendação por município/raio depende deles).

### Rodar

```bash
# na VPS (produção). Coloque os CSVs (e opcionalmente depara.csv) em ./rfb-data
docker compose -f docker-compose.prod.yml run --rm \
  -v "$PWD/rfb-data:/data" app \
  node etl/etl.ts --uf SP --in /data \
    --estab ESTABELE --empresas EMPRE \
    --simples SIMPLES --municipio-map depara.csv --batch 5000
# (no dev é o mesmo, sem o -f: docker compose run --rm -v ... app node etl/etl.ts ...)
```

O ETL filtra **situação ativa** (`02`), exclui MEI, junta estabelecimentos+empresas
pela raiz do CNPJ, mapeia município→centroide para preencher `geom`, faz UPSERT em
`companies` e marca a UF em `enabled_regions`. Re-runs atualizam, sem duplicar.

---

## Funcionalidade central: recomendação

Endpoint `GET /api/recommend` — empresas ranqueadas em **uma** query SQL, paginada,
sem N+1. Filtra por: em `enabled_regions` ∩ território do tenant (municípios **ou**
`ST_DWithin` por raio) ∩ `situacao='ativa'` − já referenciadas pelo tenant.

```
score = w_cnae·fit_cnae + w_prox·proximidade + w_porte·porte
  fit_cnae:    classe=1.0 · mesma divisão=0.6 · mesma seção=0.3   (derivado dos cnaes_alvo)
  proximidade: 1 − ST_Distance/normal                            (decaimento)
  porte:       proxy por porte + capital_social (log-normalizado)
```

Cada empresa retorna um campo `reason` (jsonb) explicando o score (match de CNAE,
distância em km, porte e os componentes) — a recomendação é **explicável** na UI.
Pesos vêm de `target_profiles.pesos`.

### Prova de uso de índice (EXPLAIN ANALYZE)

Ver [`docs/EXPLAIN.txt`](docs/EXPLAIN.txt) — `EXPLAIN (ANALYZE, BUFFERS)` rodado sobre
**1.600.000 empresas** (1,52M ativas). Resumo:

- Território por município → **Bitmap Index Scan on `companies_municipio_ativa_idx`**
  (btree **parcial** `WHERE situacao='ativa'`). Sem seq scan na base inteira.
- Território por raio → **Bitmap Index Scan on `companies_geom_ativa_idx`** (GIST parcial).
- `NOT EXISTS` (já no funil) → anti-join pelo índice tenant `(org_id, …)`.
- Sort em memória (`work_mem` elevado por sessão), sem spill em disco.
- **~0,35 s no pior caso** (3 municípios de região metropolitana, ~101k candidatos
  pontuados). Territórios típicos respondem em dezenas de ms.

Os índices parciais (`WHERE situacao_cadastral='ativa'`) mantêm a estrutura pequena —
só empresas ativas são consultadas.

---

## Backup (cron de `pg_dump`)

Backup diário comprimido, mantendo 14 dias. Adicione ao crontab da VPS:

```bash
# crontab -e   (02:30 todo dia) — usa o compose de produção
30 2 * * * cd /opt/prospecta && docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U postgres -Fc rs | gzip > /opt/backups/rs-$(date +\%F).sql.gz
# limpeza dos > 14 dias
35 2 * * * find /opt/backups -name 'rs-*.sql.gz' -mtime +14 -delete
```

Restaurar:

```bash
gunzip -c /opt/backups/rs-2026-01-01.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db pg_restore -U postgres -d rs --clean --if-exists
```

> `companies` é reconstruível pelo ETL; o que **precisa** de backup é o dado de tenant
> (`organizations`, `users`, `company_relationships`, `stages`, `activities`,
> `target_profiles`). O dump acima cobre tudo.

---

## Desenvolvimento sem Docker (opcional)

O fluxo padrão de dev é `docker compose up` (ver acima). Sem Docker:

```bash
docker compose up -d db
cd server && npm install && DATABASE_URL=postgres://postgres:postgres@localhost:5432/rs \
  JWT_SECRET=dev node scripts/migrate.ts && npm run dev      # API :8080, node --watch
cd client && npm install && npm run dev                      # UI  :5173, proxy /api -> :8080
```

`server/`: `npm run typecheck` checa tipos. `client/`: `npm run build` valida o build.

---

## Multi-tenant & segurança

- JWT carrega `org_id`; **toda** query tenant-scoped filtra por `org_id` do token.
- `companies` é leitura pública entre tenants; só `company_relationships` e demais
  tabelas tenant são isoladas por `org_id`.
- Senhas com `scrypt` (`node:crypto`), comparação `timingSafeEqual`.
- (Opcional, defesa extra) RLS do Postgres pode ser adicionada por cima do isolamento
  em aplicação — não é necessário, pois todas as queries já filtram `org_id`.

## Estrutura

```
.
├── docker-compose.yml        # DEV (padrão): hot reload — `docker compose up`
├── docker-compose.prod.yml   # PRODUÇÃO (VPS): build estático
├── deploy.sh                 # deploy na VPS (build + up + health + prune)
├── Dockerfile                # multi-stage: build client -> runtime serve API+estáticos
├── docs/EXPLAIN.txt          # EXPLAIN ANALYZE comentado da recomendação
├── server/
│   ├── migrations/           # 001..005 .sql + seeds/ + schema_migrations
│   ├── scripts/migrate.ts    # runner idempotente
│   ├── etl/etl.ts            # CLI ETL RFB -> companies (streaming/batch)
│   └── src/
│       ├── index.ts          # Fastify: API + estáticos
│       ├── db.ts auth.ts      config.ts
│       ├── sql/recommend.ts  # builder da query de recomendação
│       └── routes/           # auth, profile, recommend, cnae, relationships, stages, activities
└── client/
    └── src/                  # React: Login, Recommend (mapa+lista), Profile, Kanban, Agenda
```
# prospecta

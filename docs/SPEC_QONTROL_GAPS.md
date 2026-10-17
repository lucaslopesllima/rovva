# Spec: lacunas mapeadas contra o Qontrol (2026-10-17)

Origem: análise do site qontrol.com.br (CRM de lead inbound no WhatsApp) cruzada com o
código do Rovva. Só entra aqui o que o Rovva **não tem** e que resolve dor real de
representante têxtil. O que já existe (caixa compartilhada de WhatsApp, Kanban com dono e
datas, mensagem agendada em série, relatório por vendedor, importação por CNPJ e por PDF da
representada) **não** se repete.

Regras para quem implementar:

- Ler `CLAUDE.md` e `_memoria/` antes. Tom e nomes na UI seguem a metáfora território/rota.
- Cada item é independente e pode virar um commit. Ordem sugerida: 1 → 2 → 3 → 4 → 5 → 6 → 7.
- Testes rodam no container: `docker compose run --rm web npm test` (client) e
  `cd server && npm test` com Postgres/PostGIS do docker (ver `server/test/helpers.ts`).
- Não adicionar dependência nova. Nenhum item precisa.
- Migrações: próximo número livre é `088`. Idempotentes (`IF NOT EXISTS`).
- bigint do pg chega como string: comparar id com `Number()` nos dois lados.
- Permissões: reusar códigos existentes em `server/src/permissions.ts`. Só o item 5 cria
  um código novo.

Convenção de esforço: P = até 1 dia, M = 2 a 5 dias.

---

## 1. Cliente sumido: recência de pedido por cliente (P)

**Dor.** Carteira de 120 clientes, 40 compraram no trimestre, 80 parados que o
representante não enxerga. Hoje o alerta de inatividade (`dashboard.ts` 5a e
`notifications.ts` item 4) só olha `status = 'prospect'`, e a tela Clientes não mostra data
do último pedido.

**Dados.** `orders.faturado_em` (timestamptz) com `status IN ('faturado','entregue')`,
`orders.company_id`, `orders.org_id`. Índice `orders_company_idx (company_id)` já existe.
Limiar: `organizations.inatividade_dias` (já existe, default 30, editável em
Configurações).

### 1a. Backend

`server/src/routes/relationships.ts`

- Em `REL_LABELS` (ou subquery equivalente no `GET /api/relationships`), acrescentar:
  ```sql
  (SELECT max(o.faturado_em)::date::text FROM orders o
    WHERE o.company_id = r.company_id AND o.org_id = r.org_id
      AND o.status IN ('faturado','entregue')) AS ultimo_pedido
  ```
  Devolver também `dias_sem_pedido` calculado em SQL
  (`(current_date - max(...)::date)::int`) ou no client, tanto faz. Preferir SQL.

`server/src/routes/dashboard.ts`

- Nova query 5c, mesmo padrão de 5a (respeita `inatOwner`/`inatParams`):
  ```sql
  SELECT r.id, r.company_id, c.razao_social, c.nome_fantasia,
         max(o.faturado_em)::date::text AS ultimo_pedido,
         (current_date - max(o.faturado_em)::date)::int AS dias
  FROM company_relationships r
  JOIN companies c ON c.id = r.company_id
  JOIN orders o ON o.company_id = r.company_id AND o.org_id = r.org_id
                AND o.status IN ('faturado','entregue')
  WHERE r.org_id = $1 AND r.status = 'cliente' AND r.ativo
  GROUP BY r.id, c.razao_social, c.nome_fantasia
  HAVING max(o.faturado_em) < current_date - $2::int
  ORDER BY dias DESC LIMIT 20
  ```
  Expor como `alertas.sem_pedido`.
- Novo KPI `positivacao_90`: clientes ativos com pedido faturado nos últimos 90 dias
  dividido por clientes ativos. Devolver `{ com_pedido, total, pct }`.

`server/src/routes/notifications.ts`

- Quinto SELECT em `computeAlerts`, mesma query acima filtrada por
  `r.owner_user_id = $2`, `LIMIT 20`. `tipo: 'sem_pedido'`, `chave: 'sem_pedido:${r.id}'`,
  título `Cliente sem pedido há ${dias} dias: ${razao_social}`, payload
  `{ relationship_id, company_id, dias }`.
- O limiar vem de `organizations.inatividade_dias` (buscar uma vez no começo da função).

### 1b. Frontend

`client/src/pages/Clientes.tsx`

- Na linha do cliente, abaixo do nome, badge com semáforo por regra (sem IA):
  - sem pedido nunca: `Badge tone="neutral"` "sem pedido"
  - ≤ 30 dias: `tone="success"` "pedido há N dias"
  - 31 a 90 dias: `tone="warn"`
  - > 90 dias: `tone="danger"`
- Ordenação opcional "mais tempo sem pedido" (select simples no topo da lista).

`client/src/pages/Dashboard.tsx`

- `StatCard` "Positivação 90 dias" ao lado dos existentes: valor `pct%`, sub
  `"${com_pedido} de ${total} clientes com pedido"`. Link para Clientes.
- Card "Clientes sem pedido" espelhando "Clientes sem contato" (mesmo layout, usa
  `alertas.sem_pedido`). Subtítulo: "Clientes ativos sem pedido faturado há mais de
  {inatividade_dias} dias."

`client/src/App.tsx` (notificações): renderizar `tipo === 'sem_pedido'` com link para
`/clientes` ou para o funil do relationship, igual a `parado`.

### 1c. Testes

`server/test/routes-dashboard.test.ts`: org com 2 clientes, um com pedido faturado ontem,
outro faturado há 100 dias. `alertas.sem_pedido` traz só o segundo; `positivacao_90` =
`{1, 2, 50}`. `server/test/routes-funil.test.ts` ou novo: `GET /api/relationships?status=cliente`
devolve `ultimo_pedido`.

### 1d. Aceite

Abrir Clientes e ver, por cliente, há quantos dias foi o último pedido com cor. Painel mostra
positivação e lista de clientes sumidos. Notificação aparece para o dono do vínculo.

---

## 2. ATRASADO e "dias nesta etapa" no card do funil (P)

**Dor.** Promessa com data vencida some no meio do funil. `previsao_data` já chega no card
mas não vira sinal. `stage_changed_at` existe no banco (`relationships.ts:373` atualiza) mas
não chega no client.

### 2a. Backend

`server/src/routes/relationships.ts`: adicionar `r.stage_changed_at::date::text AS
stage_changed_at` em `REL_COLS` e em `RET_COLS` (sem alias de tabela). Nada mais.

Também corrigir o escopo dos alertas de "parado" para incluir clientes:

- `dashboard.ts` 5b e `notifications.ts` item 4: trocar `r.status = 'prospect'` por
  `r.status IN ('prospect','cliente') AND r.ativo`. Manter o restante.

### 2b. Frontend

`client/src/pages/Kanban.tsx`, em `CardItem`:

- Se `previsao_data < hoje` e o card não está em stage final: `Badge tone="danger"`
  "atrasado" com `title="Previsão: dd/mm/aaaa"`.
- Linha discreta `text-[10px] text-ink-400`: "há N dias nesta etapa" (N de
  `stage_changed_at`). Com N ≥ 30, `text-amber-600`.
- Ordenação dentro da coluna: atrasados primeiro, depois por `stage_changed_at` mais antigo.
  Só reordenar na renderização, não no drag.
- Tipo `Card` recebe `stage_changed_at: string | null`.

Dica: já existe `dias` em `Dashboard.tsx` para o mesmo cálculo. Centralizar um helper
`diasDesde(iso)` em `client/src/lib/format.ts` se ainda não houver algo parecido. Olhar antes.

### 2c. Testes

`client` não tem teste de componente obrigatório. Backend: teste existente de funil deve
continuar; acrescentar assert de que `stage_changed_at` vem no `GET`.

### 2d. Aceite

Abrir o funil: cartão com previsão vencida tem badge vermelho; todo cartão mostra há quantos
dias está na etapa; atrasados vão para o topo da coluna.

---

## 3. "Minhas conversas" no WhatsApp do escritório (P)

**Dor.** Um número do escritório, vários vendedores, 200 chats na mesma lista. O Rovva já
vincula chat a `relationship_id`, mas não filtra por dono.

### 3a. Backend

`server/src/routes/whatsapp.ts`, `GET /api/whatsapp/chats`:

- Aceitar query `?minhas=1`. Quando presente: `AND r.owner_user_id = $2` (o alias `r` já
  está no `CHAT_LABELS_SQL`).
- Acrescentar em `CHAT_LABELS_SQL` (`server/src/whatsapp.ts`): `r.owner_user_id,
  ou.nome AS owner_nome` com `LEFT JOIN users ou ON ou.id = r.owner_user_id`. Atualizar
  `ChatRow`.

### 3b. Frontend

`client/src/pages/WhatsApp.tsx`:

- Toggle "Todas | Minhas" acima da lista (perto da busca, linha ~1387 onde `filtered` é
  calculado). Persistir em `localStorage` com try/catch, chave `wa.minhas`.
- Só mostrar o toggle quando a org tem mais de um usuário (já existe algo que lista
  usuários para "transferir"? reusar; senão mostrar sempre, custo zero).
- No cabeçalho do chat, nome do dono em cinza quando `owner_nome` existe e não é o próprio
  usuário.

### 3c. Testes

`server/test/routes-whatsapp-actions.test.ts`: dois usuários, dois chats vinculados a
relationships de donos diferentes; `?minhas=1` devolve só o do usuário logado.

### 3d. Aceite

Vendedor liga "Minhas" e vê só os chats dos clientes dele. Chat de cliente de outro vendedor
mostra o nome do dono.

---

## 4. Cobertura e positivação por vendedor (P/M)

**Dor do escritório.** Não enxerga se o vendedor está visitando e não vendendo, ou vendendo
sempre para os mesmos 20. Relatório de vendas por vendedor existe; o diagnóstico não.

### 4a. Backend

`server/src/permissions.ts`: novo código `reports.positivacao`, label
"Relatórios: cobertura e positivação", módulo Financeiro. Adicionar aos mesmos conjuntos
onde `reports.coverage` aparece (linhas ~230 e ~249).

`server/src/routes/reports.ts`, `GET /api/reports/positivacao`:

- Query: `from`, `to` (default: mês corrente via `range()`), `user_id` opcional
  (`ownerClause` já trata admin vs vendedor).
- Uma SQL por vendedor (`users` da org):
  ```sql
  WITH ativos AS (
    SELECT r.owner_user_id, r.company_id
    FROM company_relationships r
    WHERE r.org_id = $1 AND r.status = 'cliente' AND r.ativo
  ),
  visitados AS (
    SELECT DISTINCT a.owner_user_id, a.company_id
    FROM activities a
    WHERE a.org_id = $1 AND a.status = 'feito' AND a.company_id IS NOT NULL
      AND a.start_at >= $2::date AND a.start_at < ($3::date + 1)
  ),
  compraram AS (
    SELECT DISTINCT o.owner_user_id, o.company_id
    FROM orders o
    WHERE o.org_id = $1 AND o.status IN ('faturado','entregue')
      AND o.faturado_em >= $2::date AND o.faturado_em < ($3::date + 1)
  )
  SELECT u.id AS user_id, u.nome,
         count(DISTINCT at.company_id)::int AS ativos,
         count(DISTINCT v.company_id)::int  AS visitados,
         count(DISTINCT c.company_id)::int  AS com_pedido
  FROM users u
  LEFT JOIN ativos    at ON at.owner_user_id = u.id
  LEFT JOIN visitados v  ON v.owner_user_id = u.id
  LEFT JOIN compraram c  ON c.owner_user_id = u.id
  WHERE u.org_id = $1 [AND u.id = $4]
  GROUP BY u.id, u.nome ORDER BY u.nome
  ```
  Checar como `users` liga a org (pode ser `user_orgs` ou coluna `org_id`; seguir o que
  `dashboard.ts` item 6 "Ranking" já faz).
- Devolver `rows` com `cobertura_pct = visitados/ativos` e `positivacao_pct =
  com_pedido/ativos` (0 quando `ativos = 0`), e `leitura` por linha:
  - cobertura ≥ 60 e positivação < 30: "visita e não vende: revisar mix ou tabela"
  - positivação ≥ 50 e cobertura < 40: "vende para os mesmos: não abre cliente novo"
  - ambos baixos: "carteira parada"
  - ambos altos: "em dia"
  Limiares como constantes no topo do arquivo, com comentário. Não configurável por
  enquanto.

### 4b. Frontend

`client/src/pages/Reports.tsx`: nova aba "Cobertura e positivação" seguindo o padrão das
abas existentes (`ownerQs`, filtro de período). Tabela: vendedor, ativos, visitados,
cobertura %, com pedido, positivação %, leitura. Sem gráfico.

### 4c. Testes

`server/test/routes-reports.test.ts`: dois vendedores; um com 4 clientes, 3 visitados, 1
com pedido; outro com 2 clientes, 0 visitados, 2 com pedido. Conferir percentuais e
`leitura`.

### 4d. Aceite

Admin do escritório abre a aba e lê, por vendedor, quem roda e não vende e quem vende e não
roda, no período escolhido.

---

## 5. Retorno pendente no WhatsApp (M)

**Dor.** Mandou a tabela, cliente não respondeu, esqueceu. É o item mais forte do Qontrol
("follow-up com escalada"), aqui sem robô escrevendo.

**Dados.** `whatsapp_messages (chat_id, from_me, momento, internal)`, índice
`(chat_id, momento, id)` já existe. `whatsapp_chats.company_id / relationship_id`.
`whatsapp_schedules (chat_id, serie_id, status, agendado_para, created_at)`.

### 5a. Alerta "sem resposta"

`server/src/routes/notifications.ts`, novo SELECT em `computeAlerts`:

```sql
SELECT ch.id AS chat_id, ch.company_id, co.razao_social,
       (current_date - lm.momento::date)::int AS dias
FROM whatsapp_chats ch
JOIN company_relationships r ON r.id = ch.relationship_id AND r.owner_user_id = $2
JOIN companies co ON co.id = ch.company_id
JOIN LATERAL (
  SELECT m.from_me, m.momento FROM whatsapp_messages m
  WHERE m.chat_id = ch.id AND NOT m.internal
  ORDER BY m.momento DESC, m.id DESC LIMIT 1
) lm ON true
WHERE ch.org_id = $1 AND lm.from_me
  AND lm.momento < now() - make_interval(days => $3)
  AND NOT EXISTS (SELECT 1 FROM whatsapp_schedules s
                  WHERE s.chat_id = ch.id AND s.status = 'pendente')
ORDER BY dias DESC LIMIT 20
```

- `$3` = dias sem resposta. Nova coluna `organizations.sem_resposta_dias int NOT NULL
  DEFAULT 5` (migração `088_org_sem_resposta_dias.sql`). Expor em Configurações ao lado de
  `inatividade_dias` (`server/src/routes/account.ts` `ORG_COLS` + schema do PATCH, e
  `client/src/pages/Settings.tsx`).
- `tipo: 'sem_resposta'`, `chave: 'sem_resposta:${chat_id}:${lm.momento::date}'` (a chave
  muda só se a última mensagem mudar, então o aviso não se repete por dia), título
  `Sem resposta há ${dias} dias: ${razao_social}`, payload `{ chat_id, company_id, dias }`.
- Conferir se `whatsapp_messages.internal` é o nome da coluna de nota interna (está no
  SELECT de `GET /api/whatsapp/chats/:id/messages`). Se não existir, ajustar.

`client/src/App.tsx`: `tipo === 'sem_resposta'` abre `/whatsapp?chat=<chat_id>` (ver como a
página hoje abre um chat por URL; se não abre, aceitar `?chat=` no `WhatsApp.tsx`). Ação
secundária na notificação: "Agendar retorno" leva ao mesmo chat com o modal de agendar
aberto (query `&agendar=1`).

### 5b. Série que para sozinha

`server/src/whatsappScheduler.ts`, dentro do loop por agendamento, antes de enviar:

- Se `s.chat_id` existe e há mensagem recebida (`from_me = false AND NOT internal`) nesse
  chat com `momento > s.created_at`, **não enviar**: marcar `status = 'cancelado'` com
  `erro = 'cliente respondeu em <data>'` (ou criar valor novo no enum
  `wa_schedule_status`, se `cancelado` não existir; checar `050_whatsapp_schedules.sql`).
  Cancelar também as demais linhas pendentes do mesmo `serie_id`.
- Emitir `broadcast(orgId, 'schedule-cancelled', { chat_id, serie_id })` para o front
  recarregar o contador `agendamentos_pendentes`.
- Só vale para série com `serie_id` ou mensagem agendada vinculada a chat; agendamento
  sem chat segue como está.
- Isso tem que ser opcional por agendamento, porque "lembrete de coleção toda segunda" não
  deve parar porque o cliente respondeu "ok". Nova coluna
  `whatsapp_schedules.parar_se_responder boolean NOT NULL DEFAULT false` (mesma migração
  088). Checkbox no modal de agendar (`WhatsApp.tsx`, rota `POST /api/whatsapp/schedule`
  e a variante por número, `whatsapp.ts` ~768 e ~815), default **ligado** na UI quando a
  recorrência é nula ou a quantidade > 1 e o texto é um retorno. Simplificar: default
  ligado sempre na UI, o usuário desliga.

### 5c. Testes

`server/test/routes-whatsapp-actions.test.ts`: chat vinculado, última mensagem `from_me`
há 6 dias → notificação `sem_resposta`; inserir mensagem recebida → some. Scheduler: série
de 3 com `parar_se_responder`, mensagem recebida após criação → as 3 viram canceladas e
nada é enviado (há teste de scheduler em `routes-whatsapp-demo.test.ts` ou similar para
copiar o setup de org demo).

### 5d. Aceite

Mandei tabela terça, cliente não respondeu, sexta chega notificação com botão para agendar
retorno. Agendei retorno em série; cliente respondeu antes; a série some e eu sou avisado.

---

## 6. Importar carteira por planilha (M)

**Dor.** "Não tenho tempo de cadastrar" mata adoção. A cola de CNPJ já preenche a empresa
pela base da Receita, mas contato, telefone, representada e último pedido ficam de fora.

### 6a. Backend

`server/src/routes/relationships.ts`, `POST /api/relationships/import`:

- Além de `cnpjs: string[]`, aceitar `linhas: Array<{ cnpj, contato?, telefone?,
  representada?, ultimo_pedido? }>` (um dos dois é obrigatório, `maxItems 2000`).
- Para cada linha válida e encontrada na base:
  - cria/mantém o relationship `status = 'cliente'` como hoje;
  - `representada`: casa por nome (`lower(trim)`) em `represented_companies` da org; se
    não achar, deixa nulo e lista em `representada_nao_encontrada`;
  - `contato` + `telefone`: insere em `contacts (org_id, nome, telefone, company_id)` se não
    existir contato com mesmo nome na empresa, e liga em `relationship_contacts`;
    normalizar telefone com o mesmo helper usado em `whatsapp.ts` (`normalizeNumero`);
  - `ultimo_pedido` (data `dd/mm/aaaa` ou `aaaa-mm-dd`): grava em `data_contato` quando
    ela está nula. **Não** cria pedido fantasma. Quem tem o histórico real usa o PDF
    (`orders.ts` importação por PDF).
- Resumo devolvido: hoje `{ created, alreadyExists, notFound, invalid }`; acrescentar
  `contatos_criados`, `representada_nao_encontrada: string[]`.
- Tudo numa transação por lote, como o endpoint já faz (ver código atual antes).

### 6b. Frontend

`client/src/pages/Clientes.tsx`, no fluxo de importação existente (linha ~90):

- Aceitar `.csv` por `<input type="file">` além do textarea. Parse no client com
  `split('\n')` e separador detectado entre `;` e `,`; cabeçalho obrigatório com as colunas
  `cnpj; contato; telefone; representada; ultimo_pedido` (qualquer ordem, nomes exatos sem
  acento). Sem biblioteca.
- Mostrar o resumo novo. Oferecer download de um modelo CSV com o cabeçalho (gerar um
  `Blob` no client).

### 6c. Testes

`server/test/routes-funil.test.ts` (onde o import atual é testado): linha com contato e
representada existente cria contato e preenche `represented_id`; representada inexistente
volta na lista.

### 6d. Aceite

Representante manda CSV com 150 linhas. Em um minuto a carteira está em Clientes com
contato, telefone, representada e cor do item 1. Linhas fora da base aparecem listadas.

---

## 7. Última nota interna fixa no topo do chat (P) e resumo com IA (M, fase 2)

**Dor.** 200 chats, retoma conversa de 3 meses atrás e não lembra o combinado.

### 7a. Agora (P)

`server/src/routes/whatsapp.ts`, `GET /api/whatsapp/chats/:id/messages`: devolver também
`ultima_nota: { corpo, momento, autor } | null` (última mensagem com `internal = true`).

`client/src/pages/WhatsApp.tsx`: faixa discreta abaixo do cabeçalho do chat com a última
nota interna, ícone de pin, botão "editar" que abre o fluxo de nota interna já existente.
Esconder quando nulo.

### 7b. Depois (M, só se o Lucas aprovar)

Botão "Resumir" que chama um LLM com as últimas 50 mensagens e grava o resultado como nota
interna. Hoje não há nenhum cliente de LLM no servidor. Exige: variável de ambiente com a
chave, custo por chamada, limite por org, e aviso de que dado de cliente vai para fora.
Não implementar sem decisão explícita.

---

## Não implementar (decidido em 2026-10-17)

- IA que atende sozinha / qualifica lead. Dono de confecção não compra de robô.
- Disparo em massa. Evolution API é não oficial; banimento do número é risco real.
- Score caixa preta. A recomendação explicável (CNAE, porte, distância, motivo) é o
  diferencial; o semáforo por regra do item 1 cobre o que falta.
- Site gerado por IA, Google Meet, Instagram na caixa de entrada, API pública.

## Processo (custo zero, não é código)

Na demo: pedir a lista de CNPJ antes, importar, abrir a praça do cliente na recomendação com
o funil já populado. É o "implantação em 1 dia" do Qontrol, sem feature nova.

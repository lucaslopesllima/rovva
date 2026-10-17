---
name: implementar
description: Implementar uma feature ou melhoria no Rovva de ponta a ponta — análise, desenho técnico, decisões de produto em lote, esqueleto de contratos, código, testes, validação única e commit — com o orquestrador decidindo quantos subagentes usar (de nenhum a vários) conforme o desenho. Usar quando o usuário disser "implementar", "/implementar", "desenvolver", "nova funcionalidade", "feature" ou "melhoria" no Rovva.
argument-hint: "<descrição da funcionalidade ou evidência>"
---

# Implementar

Uma tarefa, 1 validação, 1 commit (ou poucos, coerentes) na `main`. A sessão principal é o orquestrador: analisa, desenha, fixa contratos e **decide sozinha quantos agentes abrir** — zero quando a tarefa cabe em sequência, N quando há fatias com contrato fechado e arquivos disjuntos. Mínimo de alteração, sem refatorar o que não foi pedido, preservar alterações existentes no working tree.

Stack: `server/` (Fastify 5 + TypeScript + PostgreSQL/PostGIS, rotas em `server/src/routes/`, migrações SQL numeradas em `server/migrations/NNN_*.sql`), `client/` (React 19 + Vite + Tailwind 4 + React Router 7, telas em `client/src/pages/`), dev via `docker compose`.

## Fase 0 — Ambiente

- `git status`: se houver alteração alheia, não tocar nela; trabalhar em volta.
- Stack dev de pé: `docker compose up -d db app web`. Não rodar a stack e2e (recria app/web com config e2e e quebra o login do dev).
- Node fica no container; nunca nvm/npm no host.

## Fase 1 — Análise e desenho (somente leitura)

1. Entender o pedido e **mapear o que já existe**: tabelas/migrações, rotas, telas, `server/src/permissions.ts` + `can()` no client, helpers (`client/src/lib/`, máscaras/validadores em `format.ts`), padrões do repositório e código reutilizável.
2. Escrever o **desenho técnico em uma página**: modelo de dados (migração nova `NNN+1`), endpoints (request/response), telas e estados, permissões (grupo/RBAC), escopo por org, pontos de reutilização.
3. Levantar **todas as decisões de produto** de uma vez (regra, permissão, texto, comportamento em borda, o que fica fora do escopo), cada uma com sugestão e risco. Texto voltado ao representante segue `marca/MARCA.md` (direto, prático, metáfora de território/rota).
4. Dividir em **fatias**: por camada e contrato (migração / server regra+rota+permissão / client lib+api / client tela / testes), ou por módulo quando a feature tocar módulos independentes.
5. Para cada fatia: arquivos, dependências de contrato, risco.

Entregar desenho, fatias e decisões em **uma mensagem**. Aguardar o usuário. Não editar código antes da aprovação.

## Fase 2 — Decisão de paralelismo (do orquestrador, não do usuário)

Abrir agentes só quando os três valerem:
- fatias com **contrato fechado** (tipo, rota, payload, nome de permissão, coluna) que não dependem do código uma da outra;
- **arquivos disjuntos** entre as fatias;
- cada fatia com trabalho acima de ~15 min.

Caso contrário, implementar em sequência direto no repositório. Com agentes, cada um roda com `isolation: "worktree"`. Nunca 2 agentes no mesmo arquivo. Registrar a divisão escolhida e o porquê.

## Fase 3 — Esqueleto (orquestrador)

Antes de qualquer agente, fixar os **pontos de contato**: migração, tipos compartilhados, assinatura das rotas (path + payload), constantes de permissão, funções da api do client. Esses arquivos ficam congelados durante a Fase 4; quem precisar mudar contrato para e reporta.

## Fase 4 — Código

Agentes (`general-purpose`), prompt autocontido com: desenho da fatia com contrato; arquivos que pode tocar e os que não pode; decisões já tomadas; padrões do repositório (seguir o estilo do arquivo vizinho, imports no topo, sem refatorar, comentários mínimos; dinheiro nunca `type=number`; id bigint do pg vem string → `Number()` nas comparações); testes vitest da fatia, rodados só nos arquivos tocados.

Proibido ao agente: navegador, stack e2e, `deploy.sh`, VPS, push, banco dev em escrita, mudar contrato, tocar arquivo de outra fatia. Dúvida de produto → parar e reportar; o orquestrador consolida e pergunta em lote.

Sem agentes: o orquestrador implementa fatia por fatia com os mesmos critérios.

## Fase 5 — Integração

1. Juntar o trabalho; conflito só pode existir fora do esqueleto e indica fatia mal cortada: resolver preservando os dois lados e registrar.
2. Migração: `docker compose exec app npm run migrate` (ou reiniciar `app` se ele migra no boot). Se o `node --watch` não recarregar, `docker compose restart app`.
3. Rodar testes uma vez por lado, em container limpo:
   - server: `docker compose -f docker-compose.yml run --rm --no-deps -T app sh -c "npx vitest run <arquivos>"` + `npx tsc --noEmit`
   - client: `docker compose -f docker-compose.yml run --rm --no-deps -T web sh -c "npx vitest run <arquivos>"`
   - Coverage tem threshold 100% (lines/functions/statements) nos dois lados: código novo precisa de teste.
4. `/code-review` sobre o diff inteiro, com foco em contrato cumprido, permissões/escopo por org, null, N+1, índice para predicado novo em query de busca e regra de negócio.

## Fase 6 — Validação única

Um único validador no app dev (`/run` ou navegador em aba própria). Percorrer **checklist de fluxo** derivado do desenho: caminho feliz, permissão negada (usuário de grupo sem a permissão), bordas decididas. Não apagar dados que não foram criados no cenário. Reprovação volta só para a fatia dona.

## Fase 7 — Commit

Só após a Fase 6 aprovada: commit na `main` com mensagem no padrão do repo (`<área>: <resumo>`, ex.: `pedidos: importação de histórico por PDF`). Nunca `git add -A` (o repo contém o AutoPost e outros diretórios alheios): adicionar só os arquivos da tarefa. Push e deploy em produção só com pedido explícito do usuário.

## Entrega

Desenho final, tabela `fatia | agente | arquivos | testes | validado`, commit, migrações a aplicar em produção, decisões registradas, o que ficou fora do escopo.

## Erros que esta skill existe para evitar

- Abrir agentes antes de contrato e esqueleto (cada um inventa nome e todos conflitam).
- Decidir produto no meio do código (retrabalho e complementos).
- Paralelizar tarefa pequena (cerimônia custa mais que o código).
- Validar e commitar por fatia.

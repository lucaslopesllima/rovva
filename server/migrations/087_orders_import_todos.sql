-- 087 Importação de pedidos (PDF de histórico e CSV de faturamento) liberada
-- para todos os usuários: entra em todo grupo não-admin existente (admin já
-- tem bypass). Orgs novas recebem pelo preset (src/permissions.ts). Fora do
-- admin, o CSV só fatura pedido do próprio vendedor.
UPDATE permission_groups
   SET permissions = array_append(permissions, 'orders.import')
 WHERE NOT is_admin AND NOT ('orders.import' = ANY (permissions));

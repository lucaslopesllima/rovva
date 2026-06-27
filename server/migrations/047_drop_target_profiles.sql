-- Remove o perfil-alvo: a configuração da recomendação (território, CNAEs-alvo,
-- raio e pesos) passou a viver no filtro da tela de busca (cliente), enviada ao
-- /api/recommend a cada busca. Não há mais estado de perfil no servidor.
DROP TABLE IF EXISTS target_profiles;

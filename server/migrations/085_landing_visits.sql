-- Contador diário de visitas da landing (rovva.tech).
CREATE TABLE IF NOT EXISTS landing_visits (
  dia     date PRIMARY KEY,
  visitas integer NOT NULL DEFAULT 0
);

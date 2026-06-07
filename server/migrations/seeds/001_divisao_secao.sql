-- Full CNAE divisao -> secao map (all 99 divisions). Static, derived from IBGE structure.
INSERT INTO cnae_divisao_secao (divisao, secao)
SELECT d, CASE
  WHEN d BETWEEN  1 AND  3 THEN 'A'
  WHEN d BETWEEN  5 AND  9 THEN 'B'
  WHEN d BETWEEN 10 AND 33 THEN 'C'
  WHEN d = 35              THEN 'D'
  WHEN d BETWEEN 36 AND 39 THEN 'E'
  WHEN d BETWEEN 41 AND 43 THEN 'F'
  WHEN d BETWEEN 45 AND 47 THEN 'G'
  WHEN d BETWEEN 49 AND 53 THEN 'H'
  WHEN d BETWEEN 55 AND 56 THEN 'I'
  WHEN d BETWEEN 58 AND 63 THEN 'J'
  WHEN d BETWEEN 64 AND 66 THEN 'K'
  WHEN d = 68              THEN 'L'
  WHEN d BETWEEN 69 AND 75 THEN 'M'
  WHEN d BETWEEN 77 AND 82 THEN 'N'
  WHEN d = 84              THEN 'O'
  WHEN d = 85              THEN 'P'
  WHEN d BETWEEN 86 AND 88 THEN 'Q'
  WHEN d BETWEEN 90 AND 93 THEN 'R'
  WHEN d BETWEEN 94 AND 96 THEN 'S'
  WHEN d = 97              THEN 'T'
  WHEN d = 99              THEN 'U'
  ELSE 'C'
END
FROM generate_series(1,99) AS d
ON CONFLICT (divisao) DO UPDATE SET secao = EXCLUDED.secao;

-- Sample CNAE reference (subclasse code as int, descricao, secao, divisao).
-- Full table loaded from the official CNAE subclasses CSV; this sample covers the demo paths.
INSERT INTO cnae_reference (codigo, descricao, secao, divisao) VALUES
  (1411801,'Confecção de roupas íntimas','C',14),
  (1412601,'Confecção de peças do vestuário, exceto roupas íntimas','C',14),
  (1413401,'Confecção de roupas profissionais','C',14),
  (1421500,'Fabricação de meias','C',14),
  (1510600,'Curtimento e outras preparações de couro','C',15),
  (1531901,'Fabricação de calçados de couro','C',15),
  (4781400,'Comércio varejista de artigos do vestuário e acessórios','G',47),
  (4782201,'Comércio varejista de calçados','G',47),
  (4642701,'Comércio atacadista de artigos do vestuário e acessórios','G',46),
  (4711301,'Comércio varejista de mercadorias em geral - hipermercados','G',47),
  (4721102,'Padaria e confeitaria com predominância de produção própria','G',47),
  (4723700,'Comércio varejista de bebidas','G',47),
  (5611201,'Restaurantes e similares','I',56),
  (5611203,'Lanchonetes, casas de chá, de sucos e similares','I',56),
  (4520001,'Serviços de manutenção e reparação mecânica de veículos','G',45),
  (1011201,'Frigorífico - abate de bovinos','C',10),
  (1091101,'Fabricação de produtos de panificação industrial','C',10),
  (6201501,'Desenvolvimento de programas de computador sob encomenda','J',62),
  (6920601,'Atividades de contabilidade','M',69),
  (8650001,'Atividades de psicologia e psicanálise','Q',86)
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao;

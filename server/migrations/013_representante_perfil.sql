-- 013 Dados do representante (perfil da conta) na organização.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cnpj        text,
  ADD COLUMN IF NOT EXISTS telefone    text,
  ADD COLUMN IF NOT EXISTS cep         text,
  ADD COLUMN IF NOT EXISTS logradouro  text,
  ADD COLUMN IF NOT EXISTS numero      text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro      text,
  ADD COLUMN IF NOT EXISTS cidade      text,
  ADD COLUMN IF NOT EXISTS uf          text;

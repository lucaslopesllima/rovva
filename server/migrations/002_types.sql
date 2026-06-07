-- 002 enum types (lean storage, stable ordering)
DO $$ BEGIN
  CREATE TYPE situacao_cad AS ENUM ('nula','ativa','suspensa','inapta','baixada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- RFB porte: 00 nao informado, 01 micro, 03 pequeno, 05 demais. MEI excluded at ETL.
  CREATE TYPE porte_emp AS ENUM ('nao_informado','micro','pequeno','demais');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE regiao_br AS ENUM ('N','NE','CO','SE','S');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE company_source AS ENUM ('rfb','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rel_status AS ENUM ('prospect','cliente','descartado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','rep');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE activity_status AS ENUM ('pendente','feito','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

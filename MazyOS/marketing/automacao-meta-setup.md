# Automação Meta (Instagram + Página Facebook) — Guia de setup

> Passo a passo pra ligar a publicação automática no Instagram e na Página
> do Facebook via Graph API. **Grupos do Facebook NÃO têm API** (Meta
> aposentou a Groups API em abr/2024) — grupo continua manual.

Tempo total: ~1h de configuração + **alguns dias** de espera do App Review
da Meta (revisão manual das permissões).

---

## Pré-requisitos (antes de começar)

1. **Conta Instagram Business ou Creator** (não pode ser pessoal)
   - No app do Instagram: Configurações → Conta → Mudar para conta profissional
2. **Página no Facebook** (não perfil pessoal)
3. **Instagram conectado à Página**
   - Na Página FB: Configurações → Contas vinculadas → Instagram → conectar
4. **Hospedagem de imagem pública** — a Meta busca a foto por URL pública,
   não aceita upload de arquivo local. Use o site do negócio, Cloudinary,
   S3 ou GitHub Pages.

---

## Passo 1 — Criar conta de desenvolvedor Meta

1. Acessar https://developers.facebook.com
2. Login com a conta pessoal do Facebook (a que administra a Página)
3. Canto superior direito → **Começar** / **Get Started**
4. Confirmar e-mail, aceitar termos, selecionar papel "Desenvolvedor"

---

## Passo 2 — Criar o App

1. https://developers.facebook.com/apps → **Criar aplicativo**
2. Tipo de app: escolher **Empresa** / **Business**
3. Nome do app: ex. `Rovva Publicador` (nome interno, não aparece pro público)
4. E-mail de contato + (se pedir) conta do Business Manager
5. Criar. Anota o **App ID** e o **App Secret** (Configurações → Básico)

---

## Passo 3 — Adicionar produtos ao App

No painel do App, adicionar:

1. **Instagram Graph API** (ou "Instagram" → Instagram API with Instagram Login /
   Instagram API with Facebook Login — escolher a de **Facebook Login**, que
   é a usada pra Business)
2. **Facebook Login for Business**

---

## Passo 4 — Descobrir os IDs (Página e Instagram)

Usar o **Graph API Explorer**: https://developers.facebook.com/tools/explorer

1. Selecionar o App no dropdown
2. Gerar um **User Access Token** com estas permissões (botão "Add Permissions"):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
3. Rodar a query pra achar o **ID da Página**:
   ```
   GET /me/accounts
   ```
   → copiar o `id` da Página desejada = **META_PAGE_ID**
4. Rodar pra achar o **ID da conta Instagram** ligada:
   ```
   GET /{META_PAGE_ID}?fields=instagram_business_account
   ```
   → o `instagram_business_account.id` = **META_IG_USER_ID**

---

## Passo 5 — Gerar token de Página de longa duração

O token do Explorer expira em ~1h. Precisa de um de **60 dias** (renovável),
e o token da **Página** (não o de usuário) é o que não expira enquanto o de
usuário-longo estiver válido.

### 5a. Trocar token curto por token de usuário longo (60 dias)

```bash
curl -s "https://graph.facebook.com/v21.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id=SEU_APP_ID&\
client_secret=SEU_APP_SECRET&\
fb_exchange_token=TOKEN_CURTO_DO_EXPLORER"
```

Retorna `access_token` = token de usuário longo.

### 5b. Pegar o token da Página (esse é o que os scripts usam)

```bash
curl -s "https://graph.facebook.com/v21.0/me/accounts?\
access_token=TOKEN_USUARIO_LONGO"
```

No JSON, achar a Página certa → o campo `access_token` dela é o
**META_PAGE_ACCESS_TOKEN**. Enquanto o app estiver ativo e o usuário-longo
válido, esse token de Página **não expira**.

> Renovação: repetir 5a/5b a cada ~50 dias, ou automatizar via cron.

---

## Passo 6 — App Review (liberar publicação real)

**Modo Desenvolvimento** (padrão do app novo): só publica em contas de teste
/ admins do app. Pra publicar na conta real de produção, precisa de App Review.

1. No painel do App → **Revisão do aplicativo** / **App Review** → Permissões
2. Solicitar (Request Advanced Access) para:
   - `instagram_content_publish`
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
3. Cada permissão pede: descrição de uso + **vídeo screencast** mostrando o
   fluxo (como o app usa a permissão), e o app precisa estar com Política de
   Privacidade publicada (URL) e ícone.
4. Enviar. Meta revisa manual (**dias a ~2 semanas**).

> Atalho enquanto espera: se você é **admin da Página e do App**, muitas
> chamadas já funcionam em modo dev pra sua própria conta. Dá pra testar a
> automação toda antes do Review aprovar.

---

## Passo 7 — Configurar o `.env` do MazyOS

Criar `.env` na raiz do MazyOS (esse arquivo **não** vai pro git):

```
META_PAGE_ACCESS_TOKEN=EAAG...      # token de Página do passo 5b
META_PAGE_ID=1234567890             # passo 4
META_IG_USER_ID=1789...            # passo 4
SITE_URL=https://seusite.com.br     # onde as imagens ficam públicas
```

Conferir que `.env` está no `.gitignore`.

---

## Passo 8 — Como uma publicação funciona (fluxo da API)

### Instagram (2 chamadas)
1. **Criar container** — aponta pra URL pública da imagem + legenda:
   ```
   POST /{IG_USER_ID}/media
     image_url=https://seusite.com.br/img/post/slide-01.png
     caption=Texto da legenda...
   ```
   Carrossel: criar 1 container por imagem com `is_carousel_item=true`,
   depois um container-pai `media_type=CAROUSEL` com os `children`.
2. **Publicar o container**:
   ```
   POST /{IG_USER_ID}/media_publish
     creation_id=ID_DO_CONTAINER
   ```

### Página Facebook
- Post com foto:
  ```
  POST /{PAGE_ID}/photos
    url=https://seusite.com.br/img/post/slide-01.png
    message=Texto...
  ```
- Post só texto/link:
  ```
  POST /{PAGE_ID}/feed
    message=Texto...
  ```

Ambos usam `access_token=META_PAGE_ACCESS_TOKEN`.

---

## Limites e regras

- Instagram: **~25 posts/dia** por conta via API
- Imagem precisa estar **acessível publicamente** no momento da chamada
  (Meta baixa por URL). Se der 403/404, a API falha.
- Formatos IG: JPEG. Carrossel 2–10 imagens.
- Token de Página some se: senha do FB mudar, app entrar em modo dev de novo,
  ou usuário-longo expirar (~60d).

---

## O que fica de fora

- **Grupos do Facebook** — sem API. Postar manual, ou aceitar risco de ban
  com ferramenta de navegador (não recomendado).
- **LinkedIn** — API de empresa exige aprovação demorada. Manual por enquanto.

---

## Próximo passo no MazyOS

Com `.env` pronto, faltam os 2 scripts que a skill `/aprovar-post` chama:
- `scripts/postar-instagram.js`
- `scripts/postar-facebook.js`

Peça: *"escreve os scripts de postar no Instagram e Facebook"* — eu gero
os dois seguindo o fluxo do Passo 8.

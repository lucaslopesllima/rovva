# Reels Rovva — guia mestre para geração em IA de vídeo

Documento base para gerar os 16 reels desta pasta em qualquer IA de vídeo com
personagem falante (Veo 3, Kling 2.x, Runway Gen-4, Sora, Hailuo, HeyGen/Synthesia
para avatar). Cada reel tem seu próprio arquivo `NN-slug.md` com roteiro, planos,
prompts prontos e legenda. Este guia define o que é comum a todos e **não se repete**
nos arquivos individuais: leia os dois antes de gerar.

---

## 1. Entrega

| Item | Valor |
|---|---|
| Formato | 9:16 vertical, 1080×1920, 24 ou 30 fps |
| Duração | 20 a 45 s (cada reel diz a sua) |
| Áudio | voz do personagem + ambiente leve; **sem trilha de hype**, sem beat |
| Legenda | queimada no vídeo, Inter 800, branca com contorno/caixa Ink `#0D1220` 70 %, caixa alta só na primeira palavra, centralizada no terço inferior |
| Texto de tela [TELA] | Inter 800, até 8 palavras, fundo branco `#FFFFFF` ou Blue 50 `#ECF0FD`, texto Ink `#0D1220`, destaque numérico em Rovva Blue `#3E66EA` |
| Logo | só nos 2 últimos segundos: `marca/rovva-logo-dark.svg` sobre fundo Ink ou `marca/logo.svg` sobre branco, canto inferior direito, 120 px de largura mínima, margem = metade da altura do símbolo |
| Capa | frame do gancho com o texto de tela por cima |
| Idioma | português do Brasil, sotaque catarinense leve |

Cada reel deve ser gerado em **clipes de 5 a 8 s** (limite típico dos modelos) e
montado depois. Os arquivos já dividem o roteiro em planos com essa duração.
Montagem: `ffmpeg` concat + legenda via `montar.mjs` desta pasta, ou CapCut.

---

## 2. Personagem fixo: Darci Hoffmann

Mesmo personagem em todos os reels. Para manter consistência entre clipes, use a
mesma imagem de referência (gerar uma vez, guardar em `ia-video/ref/darci-*.png`)
e repita a descrição literal abaixo em todo prompt.

**Descrição física (copiar no prompt, em inglês):**

> Brazilian man, 57 years old, light skin tanned from driving, short gray hair
> combed back, well-trimmed gray mustache, reading glasses pushed up on his
> forehead, medium build, slight belly, strong forearms. Wears a plain navy
> polo shirt with no logo, dark jeans, worn leather belt, steel wristwatch on
> the left wrist. Small pen in the chest pocket. Looks like a seasoned
> traveling salesman from southern Brazil, not an influencer.

**Comportamento (como ele se porta):**

- Fala olhando **direto na lente**, como quem fala com um colega no balcão.
- Não sorri de propaganda. Sorriso curto, de canto, quando faz a conta fechar.
- Gesticula pouco e com as mãos abertas; quando dá número, mostra nos dedos.
- Usa o bloquinho de espiral e caneta Bic azul como objeto principal: escreve,
  vira o bloquinho pra câmera, circula, risca.
- Pausa de meio segundo antes da frase que importa. Não corre.
- Nunca aponta o dedo pra câmera. Nunca cruza os braços.
- Quando está no carro, está **parado**, mão no volante ou no bloquinho sobre o
  volante. Nunca dirigindo e falando.

**Variação de roupa permitida (uma por reel, anotada no arquivo):** polo navy,
polo cinza-chumbo, camisa social azul-clara com manga dobrada duas vezes. Nunca
camiseta com estampa, nunca terno, nunca boné.

---

## 3. Voz

**Descrição para TTS / voz do modelo (copiar no prompt):**

> Male voice, late fifties, Brazilian Portuguese with a light Santa Catarina
> (southern Brazil) accent, medium-low pitch, slightly hoarse, unhurried,
> conversational. Sounds like someone explaining a calculation to a friend
> over coffee, not narrating an ad. No vocal fry, no radio-announcer energy.

- Ritmo: 130 a 145 palavras por minuto. Frases curtas, uma ideia por frase.
- Entonação: afirma, não pergunta com voz subindo. Perguntas do roteiro são
  feitas com tom descendente, "de quem já sabe a resposta".
- Pronúncia de **Rovva**: "RÔ-va", o acento na primeira sílaba, "v" normal.
  Se a voz da IA soar "roubo", escreva `Rôva` no texto de fala.
- Números falados por extenso no texto da fala (`cento e vinte`, `noventa dias`)
  para o TTS não engolir.
- Sem risada gravada, sem "ééé", sem muleta.

Se gerar a voz separada (ElevenLabs, Piper, etc.) e sincronizar depois: gerar a
fala primeiro, medir a duração de cada bloco, depois gerar o vídeo com a mesma
duração por plano. O `narracao.py` desta pasta já faz isso com a voz Piper
"cadu"; use-a como fallback.

---

## 4. Locações (todas no Vale do Itajaí, SC)

Cada reel usa **uma** locação principal, às vezes um insert. Descrições prontas
para prompt, em inglês, com a luz e as sombras já definidas.

### L1 — Escritório de representante

> Small home office in southern Brazil. White wall, one window on the left
> with daylight coming in, thin white curtain half open. Wooden desk with a
> spiral notebook, a Bic pen, a cell phone face down, a mug, a stack of
> fabric swatch cards (small rectangular textile samples on a ring). A
> cork board behind with a paper road map of Santa Catarina pinned on it.
> Soft side light from the window, gentle shadow falling to the right of
> the face, no harsh contrast, no studio look.

Hora: manhã (luz branca-fria) ou fim de tarde (luz âmbar). Anotada no reel.

### L2 — Dentro do carro, parado

> Interior of a mid-size sedan parked on the shoulder of a two-lane road in
> rural Santa Catarina, Brazil. Camera mounted on the dashboard looking at
> the driver. Through the windshield: green hills, a textile factory shed
> with a corrugated roof in the distance, a few trucks passing. Overcast
> daylight, soft and even, light reflections on the dashboard, seat belt
> unbuckled, engine off. A spiral notebook rests on the steering wheel.

Sombra: difusa, nenhuma dura. Se for sol, sol vem pela janela do motorista
(esquerda) e deixa metade do rosto um pouco mais clara.

### L3 — Calçada de rua industrial

> Sidewalk on a street of small textile factories in Brusque, Santa Catarina,
> Brazil. Low industrial buildings with painted facades, metal gates half
> open, a sign that reads "Malharia" in the background, a parked white van,
> a pallet of cardboard boxes. Late morning sun, warm, with defined but not
> harsh shadows cast toward the left. Man stands on the sidewalk, factory
> gate behind him.

### L4 — Balcão / mesa de confecção (insert, sem fala)

> Interior of a small garment workshop in southern Brazil. Rows of
> industrial sewing machines, rolls of knit fabric stacked on metal shelves,
> fluorescent light mixed with daylight from high windows, a cutting table
> with a bolt of fabric half unrolled. No people in focus.

### L5 — Pavilhão de feira (insert, sem fala)

> Trade fair hall interior, textile machinery and fabric booths, high
> ceiling with truss lighting, crowd blurred in the background, a table with
> a pile of business cards and a lanyard badge in the foreground. Cool even
> exhibition lighting, no strong shadows.

### L6 — Mapa na mesa (insert)

> Top-down shot of a printed road map of Santa Catarina on a wooden desk.
> A hand with a Bic pen circles towns and draws a route between them. Warm
> desk lamp light from the upper left, soft shadow of the hand on the paper.

**Regra:** nada de placa com marca real, nada de rosto de terceiros nítido,
nada de prédio reconhecível. Interiores e fachadas genéricos.

---

## 5. Câmera

Vocabulário usado nos arquivos, com o prompt em inglês equivalente:

| Código | Enquadramento | Prompt |
|---|---|---|
| PM | plano médio, cintura pra cima | `medium shot, waist up, eye level, 35mm lens look` |
| PMC | plano médio curto, peito pra cima | `medium close-up, chest up, eye level, 50mm lens look` |
| PP | primeiro plano, rosto | `close-up on face, eye level, 85mm lens look, shallow depth of field` |
| INS | insert de objeto (bloquinho, mapa, celular) | `insert shot, top-down or over-the-shoulder, macro, shallow depth of field` |
| OMB | sobre o ombro, mostra bloquinho | `over-the-shoulder shot looking down at a spiral notebook` |

Movimentos permitidos: **câmera fixa** (padrão), *push-in* lento de 5 % em 5 s
no fim de um bloco importante, *tilt down* curto da cara pro bloquinho. Nada de
handheld tremido, nada de zoom rápido, nada de orbit, nada de drone.

Corte: corte seco entre planos. Sem transição, sem zoom de CapCut, sem efeito.

Profundidade: fundo levemente fora de foco (f/2.8 equivalente) em PMC e PP; em
PM o fundo fica legível.

---

## 6. Prompt padrão (montagem)

Cada plano nos arquivos traz um bloco `PROMPT` já montado assim:

```
[Personagem §2] + [Locação §4 com luz e sombra] + [Câmera §5] +
[Ação: o que ele faz com as mãos e o rosto] +
Dialogue (Brazilian Portuguese): "fala exata" +
[Voz §3] + "No background music. Ambient sound: <som>."
```

**Negative prompt padrão** (acrescentar sempre):

```
no subtitles, no on-screen text, no logo, no background music, no smiling at
camera constantly, no pointing at camera, no hand waving, no studio lighting,
no ring light reflection in eyes, no beard, no cap, no suit, no fast camera
movement, no lens flare, no extra people in focus, no text on clothing,
no English speech.
```

Texto de tela e legenda **nunca** vão no prompt do vídeo: entram na montagem,
pra não sair com erro de ortografia.

---

## 7. Regras de conteúdo (as de sempre)

- Só entra recurso do Rovva confirmado no código. Nos 16 reels aparecem apenas:
  motivo por empresa na recomendação, mapa de pinos, "sem contato há X dias",
  rota com km e custo. Nada de billing, NF-e, "esqueci a senha".
- Nenhum case, depoimento, nome de cliente ou número de resultado inventado.
  Dados de mercado só com fonte na legenda.
- Metáfora: território, praça, rota, porta. Nunca funil, máquina, escala.
- CTA padrão: comentário com uma palavra ou "manda sua cidade e segmento no
  direct". Atendimento manual; não prometer resposta automática.
- Tom: direto, de estrada. Sem frase de efeito, sem emoji na fala.

---

## 8. Índice dos reels

| # | Arquivo | Gancho | Locação | Dur. |
|---|---|---|---|---|
| 01 | 01-carteira-120.md | 80 clientes parados não é carteira. É endereço. | L1 | 44 s |
| 02 | 02-custo-da-visita.md | Quanto custa a visita que volta sem pedido? | L2 | 35 s |
| 03 | 03-dois-jeitos-de-morrer.md | Dois jeitos de morrer de carteira | L1 | 35 s |
| 04 | 04-cinco-maiores.md | Seus 5 maiores clientes são quanto do faturamento? | L1 | 30 s |
| 05 | 05-onde-acha-cliente.md | Google Maps, indicação ou lista comprada | L1 + L6 | 40 s |
| 06 | 06-cliente-sumido.md | Cliente sumido não avisa que sumiu | L2 | 30 s |
| 07 | 07-tres-coisas-antes-da-porta.md | Antes de bater na porta: três coisas | L3 | 30 s |
| 08 | 08-quarenta-cartoes.md | Voltou da feira com 40 cartões | L1 + L5 | 30 s |
| 09 | 09-abrir-cidade-de-monza.md | Como eu abria cidade em 1998, de Monza | L2 + L6 | 45 s |
| 10 | 10-mercado-apertado.md | Mercado apertado tira quem roda no escuro | L1 | 35 s |
| 11 | 11-trezentos-km.md | 300 km, um pedido de 800 reais. Compensou? | L2 | 25 s |
| 12 | 12-dono-nao-estava.md | Chegou e o dono não estava. De novo. | L3 | 28 s |
| 13 | 13-cliente-novo-onde.md | A representada cobra cliente novo. Novo onde? | L1 | 30 s |
| 14 | 14-segunda-de-manha.md | Segunda de manhã é pra vender, não pra planejar | L1 | 30 s |
| 15 | 15-dez-na-mesma-rua.md | Visitou três e tinha dez na mesma rua | L3 + L6 | 30 s |
| 16 | 16-era-faccao.md | Bateu na porta e era facção. Não compra tecido. | L3 + L4 | 30 s |

Ordem de produção sugerida: 01, 02, 03 (conta), 06, 07 (rotina), 10, 11, 16,
depois o resto. 08 cai melhor na semana de feira.

# 08 — Quarenta cartões

> Gancho: **Voltou da feira com 40 cartões**
> Locação: L1 (escritório) + insert L5 (pavilhão de feira) · Roupa: camisa social azul-clara, manga dobrada duas vezes · Hora: manhã, luz branca-fria · Duração: 30 s · Planos: 5

## Objetivo
Ataca o cartão de feira que vira pilha na mesa e nunca vira visita. A pessoa manda pro colega que foi na feira junto, porque a regra é simples de cumprir no próprio pavilhão: separar por cidade, marcar o dia seguinte, agrupar por região. Cai melhor na semana da Febratex.

## Roteiro corrido (fala completa)
Voltou da feira com quarenta cartões.
Em trinta dias, quantos você visitou?
Quase sempre a resposta é cinco.
Antes de sair do pavilhão, separa os cartões por cidade.
Marca a visita pro dia seguinte.
Agrupa por região.
Duas visitas num dia só, na mesma rua se der.
Cartão esfria em quinze dias.
Visita na primeira semana é o cliente mais fácil do ano.

(62 palavras em 28 s de fala, ~133 ppm. Os últimos 2 s são logo.)

## Planos

### Plano 1 — 0:00–0:06 · PMC · L1
- **Ação:** Darci sentado à mesa, janela à esquerda. Na mesa, na frente dele, uma pilha de uns quarenta cartões de visita (brancos, sem marca legível), amarrada com elástico. Ele tira o elástico com a mão direita e solta a pilha na mesa com um tapinha, olhando pra câmera. Pausa de meio segundo. Fala a primeira frase; a segunda com tom descendente, de quem sabe a resposta.
- **Fala:** "Voltou da feira com quarenta cartões. Em trinta dias, quantos você visitou?"
- **[TELA]:** `40 cartões. Quantas visitas?` (o "40" em Rovva Blue)
- **Luz e sombra:** luz branca-fria da janela à esquerda, cortina meio aberta; sombra suave caindo pra direita do rosto e da pilha de cartões sobre a mesa; cortiça com mapa de SC ao fundo, fora de foco.
- **Câmera:** fixa.
- **Som:** sala quieta, ruído leve de rua pela janela, o tapa da pilha na mesa.
- **PROMPT:**
  ```
  Brazilian man, 57 years old, light skin tanned from driving, short gray hair combed back, well-trimmed gray mustache, reading glasses pushed up on his forehead, medium build, slight belly, strong forearms. Wears a plain light blue dress shirt with no logo, sleeves rolled up twice to the forearm, dark jeans, worn leather belt, steel wristwatch on the left wrist. Small pen in the chest pocket. Looks like a seasoned traveling salesman from southern Brazil, not an influencer.

  Location: Small home office in southern Brazil. White wall, one window on the left with daylight coming in, thin white curtain half open. Wooden desk with a spiral notebook, a Bic pen, a cell phone face down, a mug, a stack of fabric swatch cards (small rectangular textile samples on a ring). A cork board behind with a paper road map of Santa Catarina pinned on it. Soft side light from the window, gentle shadow falling to the right of the face, no harsh contrast, no studio look. Cool white morning light. On the desk in front of him, a thick stack of about forty plain white business cards held by a rubber band, no readable text on them.

  Camera: medium close-up, chest up, eye level, 50mm lens look, static camera, background slightly out of focus (f/2.8 equivalent). Vertical 9:16.

  Action: He is seated at the desk. With his right hand he pulls the rubber band off the stack of business cards and drops the stack on the desk with a small slap, then looks straight into the lens. Half-second pause. He says the first sentence flat, the second with a falling tone, like someone who already knows the answer. No smile, hands resting on the desk after the gesture.

  Dialogue (Brazilian Portuguese): "Voltou da feira com quarenta cartões. Em trinta dias, quantos você visitou?"

  Voice: Male voice, late fifties, Brazilian Portuguese with a light Santa Catarina (southern Brazil) accent, medium-low pitch, slightly hoarse, unhurried, conversational. Sounds like someone explaining a calculation to a friend over coffee, not narrating an ad. No vocal fry, no radio-announcer energy.

  No background music. Ambient sound: quiet room, faint street noise through the window, the slap of the card stack on the wooden desk.

  Negative prompt: no subtitles, no on-screen text, no logo, no background music, no smiling at camera constantly, no pointing at camera, no hand waving, no studio lighting, no ring light reflection in eyes, no beard, no cap, no suit, no fast camera movement, no lens flare, no extra people in focus, no text on clothing, no English speech.
  ```
- **Observações:** os cartões têm que ser brancos e sem texto legível (a IA inventa nome e logo; se inventar, regerar). Este é o frame de referência de roupa e luz dos planos 3, 4 e 5. Plano B: se o elástico sair errado, gerar a pilha já solta, com ele só batendo a mão em cima.

### Plano 2 — 0:06–0:11 · INS · L5 (insert, sem fala na IA)
- **Ação:** mesa de estande de feira vista de cima e de leve lado: pilha de cartões espalhada, crachá com cordão, um café de copinho. Uma mão (sem rosto) coloca mais um cartão na pilha. Fundo: pavilhão desfocado com gente passando. Em montagem, voz em off de Darci: "Quase sempre a resposta é cinco."
- **Fala (off, na montagem):** "Quase sempre a resposta é cinco."
- **[TELA]:** `Quase sempre: 5` (o "5" em Rovva Blue)
- **Luz e sombra:** luz fria e uniforme de exposição, sem sombra marcada; leve brilho de treliça no alto.
- **Câmera:** fixa, insert de cima e de lado.
- **Som:** burburinho de pavilhão, eco de alto-falante indistinto.
- **PROMPT:**
  ```
  Location: Trade fair hall interior, textile machinery and fabric booths, high ceiling with truss lighting, crowd blurred in the background, a table with a pile of business cards and a lanyard badge in the foreground. Cool even exhibition lighting, no strong shadows.

  Camera: insert shot, high angle looking down at the booth table, macro, shallow depth of field, static camera. Vertical 9:16.

  Action: On the table, a loose pile of plain white business cards with no readable text, a lanyard badge, a small paper coffee cup. A man's hand enters from the right and places one more white card on the pile, then leaves frame. Crowd moves out of focus in the background. No faces in focus. No dialogue.

  No background music. Ambient sound: trade fair crowd murmur, indistinct PA announcement echoing in a large hall.

  Negative prompt: no subtitles, no on-screen text, no logo, no background music, no readable brand names, no readable text on cards or badge, no faces in focus, no studio lighting, no fast camera movement, no lens flare, no English speech.
  ```
- **Observações:** a voz em off vem do TTS (`narracao.py`), não da IA de vídeo. Cartões e crachá sem texto legível; se sair palavra, regerar ou desfocar na montagem. Plano B: pular o insert e usar o P1 estendido pra 8 s com a mesma fala.

### Plano 3 — 0:11–0:17 · PM · L1
- **Ação:** mãos na mesa separando os cartões em três montinhos, da esquerda pra direita, um cartão por vez, sem pressa. Olha pros cartões nas primeiras palavras, levanta o olhar pra lente em "por cidade". Em "marca a visita pro dia seguinte" pega a caneta Bic do bolso e bate a ponta no bloquinho, uma vez.
- **Fala:** "Antes de sair do pavilhão, separa os cartões por cidade. Marca a visita pro dia seguinte."
- **[TELA]:** `Separa por cidade. Marca pro dia seguinte.`
- **Luz e sombra:** janela à esquerda; a mão esquerda projeta sombra suave sobre os cartões pra direita; mesa de madeira com brilho fosco.
- **Câmera:** fixa.
- **Som:** sala quieta, cartão batendo em cartão, caneta na espiral do bloquinho.
- **PROMPT:**
  ```
  Brazilian man, 57 years old, light skin tanned from driving, short gray hair combed back, well-trimmed gray mustache, reading glasses pushed up on his forehead, medium build, slight belly, strong forearms. Wears a plain light blue dress shirt with no logo, sleeves rolled up twice to the forearm, dark jeans, worn leather belt, steel wristwatch on the left wrist. Small pen in the chest pocket. Looks like a seasoned traveling salesman from southern Brazil, not an influencer.

  Location: Small home office in southern Brazil. White wall, one window on the left with daylight coming in, thin white curtain half open. Wooden desk with a spiral notebook, a Bic pen, a cell phone face down, a mug, a stack of fabric swatch cards (small rectangular textile samples on a ring). A cork board behind with a paper road map of Santa Catarina pinned on it. Soft side light from the window, gentle shadow falling to the right of the face, no harsh contrast, no studio look. Cool white morning light. A loose stack of plain white business cards on the desk in front of him.

  Camera: medium shot, waist up, eye level, 35mm lens look, static camera, background readable. Vertical 9:16.

  Action: Seated at the desk, he sorts the white business cards into three small piles from left to right, one card at a time, unhurried, both hands on the desk. He looks down at the cards for the first words, then raises his eyes to the lens. On the second sentence he takes the Bic pen from his chest pocket and taps its tip once on the spiral notebook. Calm face, no smile. His left hand casts a soft shadow over the cards toward the right.

  Dialogue (Brazilian Portuguese): "Antes de sair do pavilhão, separa os cartões por cidade. Marca a visita pro dia seguinte."

  Voice: Male voice, late fifties, Brazilian Portuguese with a light Santa Catarina (southern Brazil) accent, medium-low pitch, slightly hoarse, unhurried, conversational. Sounds like someone explaining a calculation to a friend over coffee, not narrating an ad. No vocal fry, no radio-announcer energy.

  No background music. Ambient sound: quiet room, cards tapping on wood, a pen tapping a spiral notebook once.

  Negative prompt: no subtitles, no on-screen text, no logo, no background music, no smiling at camera constantly, no pointing at camera, no hand waving, no studio lighting, no ring light reflection in eyes, no beard, no cap, no suit, no fast camera movement, no lens flare, no extra people in focus, no text on clothing, no English speech.
  ```
- **Observações:** continuidade: no fim deste plano há três montinhos na mesa; o P4 começa com eles já montados. Mãos manipulando cartão é onde a IA mais gera dedo errado: gerar 2 ou 3 vezes e usar o trecho limpo. Plano B: PMC com as mãos fora de quadro e o som de cartão em cima.

### Plano 4 — 0:17–0:23 · OMB · L1
- **Ação:** por cima do ombro direito dele, olhando o bloquinho. Na página, três nomes de cidade escritos à mão um embaixo do outro (ilegíveis o bastante pra não virar erro de ortografia). A mão direita com a Bic circula dois deles juntos, depois desenha um traço ligando os dois. Fala enquanto circula. Em "mesma rua se der" bate a caneta na página.
- **Fala:** "Agrupa por região. Duas visitas num dia só, na mesma rua se der."
- **[TELA]:** `2 visitas num dia só` (o "2" em Rovva Blue)
- **Luz e sombra:** luz da janela entra pela esquerda do quadro e ilumina a página; a cabeça e o ombro dele fazem sombra suave na borda direita do bloquinho.
- **Câmera:** fixa, leve tilt down de 2 ° no início se o modelo permitir; senão fixa.
- **Som:** caneta riscando papel, sala quieta.
- **PROMPT:**
  ```
  Brazilian man, 57 years old, light skin tanned from driving, short gray hair combed back, well-trimmed gray mustache, reading glasses pushed up on his forehead, medium build, slight belly, strong forearms. Wears a plain light blue dress shirt with no logo, sleeves rolled up twice to the forearm, dark jeans, worn leather belt, steel wristwatch on the left wrist. Small pen in the chest pocket. Looks like a seasoned traveling salesman from southern Brazil, not an influencer.

  Location: Small home office in southern Brazil. White wall, one window on the left with daylight coming in, thin white curtain half open. Wooden desk with a spiral notebook, a Bic pen, a cell phone face down, a mug, a stack of fabric swatch cards (small rectangular textile samples on a ring). A cork board behind with a paper road map of Santa Catarina pinned on it. Soft side light from the window, gentle shadow falling to the right of the face, no harsh contrast, no studio look. Cool white morning light. Three small piles of plain white business cards on the desk.

  Camera: over-the-shoulder shot looking down at a spiral notebook, from behind his right shoulder, shallow depth of field, static camera. Vertical 9:16.

  Action: The open spiral notebook shows three short handwritten words stacked in a column, written in blue ballpoint, slightly out of focus so they are not readable. His right hand holding a blue Bic pen draws one circle around the first two words together, then a short line connecting them. He speaks while drawing. On the last words he taps the pen on the page once. His head and shoulder cast a soft shadow on the right edge of the notebook; window light comes from the left of frame.

  Dialogue (Brazilian Portuguese): "Agrupa por região. Duas visitas num dia só, na mesma rua se der."

  Voice: Male voice, late fifties, Brazilian Portuguese with a light Santa Catarina (southern Brazil) accent, medium-low pitch, slightly hoarse, unhurried, conversational. Sounds like someone explaining a calculation to a friend over coffee, not narrating an ad. No vocal fry, no radio-announcer energy.

  No background music. Ambient sound: ballpoint pen scratching on paper, quiet room.

  Negative prompt: no subtitles, no on-screen text, no readable handwriting, no logo, no background music, no smiling at camera constantly, no pointing at camera, no hand waving, no studio lighting, no beard, no cap, no suit, no fast camera movement, no lens flare, no extra people in focus, no text on clothing, no English speech.
  ```
- **Observações:** a escrita na página tem que ficar ilegível de propósito (desfoque ou letra pequena): texto gerado por IA sai errado. Se o modelo escrever palavra legível, desfocar a página na montagem. Plano B: insert L6 (mapa de SC) com a mão circulando duas cidades vizinhas e a fala em off.

### Plano 5 — 0:23–0:30 · PP · L1
- **Ação:** rosto, de frente. Pausa de meio segundo. "Cartão esfria em quinze dias" seco. Nova pausa curta. A segunda frase mais baixa, de confidência. Sorriso curto de canto em "mais fácil do ano". Fica calado olhando a lente nos 2 últimos segundos.
- **Fala:** "Cartão esfria em quinze dias. Visita na primeira semana é o cliente mais fácil do ano."
- **[TELA]:** `Manda pra quem foi na feira contigo` (entra em 0:28, com o logo)
- **Luz e sombra:** janela à esquerda; lado direito do rosto meio tom mais escuro; nada de reflexo de anel nos olhos.
- **Câmera:** push-in lento de 5 % ao longo do plano.
- **Som:** sala quieta, rua baixinho; silêncio nos 2 últimos segundos.
- **PROMPT:**
  ```
  Brazilian man, 57 years old, light skin tanned from driving, short gray hair combed back, well-trimmed gray mustache, reading glasses pushed up on his forehead, medium build, slight belly, strong forearms. Wears a plain light blue dress shirt with no logo, sleeves rolled up twice to the forearm, dark jeans, worn leather belt, steel wristwatch on the left wrist. Small pen in the chest pocket. Looks like a seasoned traveling salesman from southern Brazil, not an influencer.

  Location: Small home office in southern Brazil. White wall, one window on the left with daylight coming in, thin white curtain half open. Wooden desk with a spiral notebook, a Bic pen, a cell phone face down, a mug, a stack of fabric swatch cards (small rectangular textile samples on a ring). A cork board behind with a paper road map of Santa Catarina pinned on it. Soft side light from the window, gentle shadow falling to the right of the face, no harsh contrast, no studio look. Cool white morning light.

  Camera: close-up on face, eye level, 85mm lens look, shallow depth of field, very slow push-in of about 5% over the clip. Vertical 9:16.

  Action: He looks straight into the lens, pauses half a second, says the first sentence dry and flat. Short pause. The second sentence quieter, like a confidence between colleagues. A brief side smile on the last words, then he stays silent, eyes on the lens, for the last two seconds. Window light from the left, right side of the face half a stop darker.

  Dialogue (Brazilian Portuguese): "Cartão esfria em quinze dias. Visita na primeira semana é o cliente mais fácil do ano."

  Voice: Male voice, late fifties, Brazilian Portuguese with a light Santa Catarina (southern Brazil) accent, medium-low pitch, slightly hoarse, unhurried, conversational. Sounds like someone explaining a calculation to a friend over coffee, not narrating an ad. No vocal fry, no radio-announcer energy.

  No background music. Ambient sound: quiet room, faint street noise through the window, going almost silent at the end.

  Negative prompt: no subtitles, no on-screen text, no logo, no background music, no smiling at camera constantly, no pointing at camera, no hand waving, no studio lighting, no ring light reflection in eyes, no beard, no cap, no suit, no fast camera movement, no lens flare, no extra people in focus, no text on clothing, no English speech.
  ```
- **Observações:** "quinze dias" é regra de bolso dele, não estatística; não virar número com fonte na legenda. Se o push-in sair brusco, gerar fixo e fazer no ffmpeg. Plano B: PMC do P1 reaproveitado com a fala nova.

## Encerramento (últimos 2 s)
0:28–0:30 sobre o P5: logo `marca/rovva-logo-dark.svg` em caixa Ink `#0D1220` 70 % no canto inferior direito, 120 px de largura. Texto de tela `Manda pra quem foi na feira contigo` no terço inferior. Darci calado.

## Legenda do post
Voltou da feira com quarenta cartões. Em trinta dias, quantos você visitou? Quase sempre são cinco. A regra que eu usei por vinte e sete anos: antes de sair do pavilhão, separa os cartões por cidade, marca a visita pro dia seguinte e agrupa por região pra fazer duas num dia só. Cartão esfria em quinze dias. Contato de feira que vira visita na primeira semana é o cliente mais fácil do ano.

Manda pra quem foi na feira contigo.

#febratex #representantecomercial #textil #feira #rovva

## Capa
Frame do P1 em 0:02, pilha de cartões soltando na mesa, com o texto `40 cartões. Quantas visitas?` por cima.

## Checklist antes de publicar
- [ ] Nenhum recurso fora do código citado (fala não cita Rovva)
- [ ] Nenhum número sem fonte ("40", "5" e "15 dias" são conta de bolso do Darci, apresentados como tal; nenhum dado de mercado)
- [ ] Rovva pronunciado "RÔ-va" (não aparece na fala)
- [ ] Texto de tela sem erro (foi na montagem, não na IA)
- [ ] Logo só nos 2 últimos segundos
- [ ] Cartões, crachá e bloquinho sem texto legível

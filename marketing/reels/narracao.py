# Narração do reel com Piper (voz pt_BR-cadu, dataset CC0), offline.
# Cadu foi a mais inteligível no teste com Whisper (faber engole "tr": trajeto, estrada).
#   python3 marketing/reels/narracao.py <pasta-do-reel>
# Lê "fala" de cada cena (e "card_fala") do legendas.json; grava tmp/fala_<marca>.wav
# e tmp/falas.json {marca: segundos}. Rodar ANTES do gravar.mjs: a gravação segura
# cada cena até a fala dela terminar.
import json, os, subprocess, sys, wave

AQUI = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
VOZ = os.environ.get('VOZ', 'cadu')
VELOCIDADE = os.environ.get('VELOCIDADE', '0.85')  # length-scale do Piper: <1 = mais rápido
# ruído baixo = pronúncia estável entre execuções (o padrão do Piper varia a cada geração)
RUIDO = ['--noise-scale', '0.3', '--noise-w-scale', '0.4']
leg = json.load(open(f'{DIR}/legendas.json'))
falas = {c['de']: c['fala'] for c in leg['cenas'] if c.get('fala')}
if leg.get('card_fala'): falas['fim'] = leg['card_fala']

os.makedirs(f'{DIR}/tmp', exist_ok=True)
# reaproveita clipe cujo texto/voz não mudou (tomada aprovada não é regerada)
feitos = json.load(open(f'{DIR}/tmp/falas_textos.json')) if os.path.exists(f'{DIR}/tmp/falas_textos.json') else {}
duracoes, textos = {}, {}
for marca, texto in falas.items():
    out = f'{DIR}/tmp/fala_{marca}.wav'
    chave = f'{VOZ}|{VELOCIDADE}|{texto}'
    textos[marca] = chave
    if feitos.get(marca) != chave or not os.path.exists(out):
        subprocess.run([f'{AQUI}/.venv/bin/piper', '-m', f'{AQUI}/.vozes/pt_BR-{VOZ}-medium.onnx',
                        '--length-scale', VELOCIDADE, *RUIDO, '-f', out],
                       input=texto.encode(), check=True, capture_output=True)
    with wave.open(out) as w: duracoes[marca] = round(w.getnframes() / w.getframerate(), 2)
    print(f'{duracoes[marca]:5.2f}s  {marca}: {texto}')
json.dump(duracoes, open(f'{DIR}/tmp/falas.json', 'w'), indent=2)
json.dump(textos, open(f'{DIR}/tmp/falas_textos.json', 'w'), indent=2, ensure_ascii=False)

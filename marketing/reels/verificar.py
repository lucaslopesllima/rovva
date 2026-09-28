# Confere a narração ouvindo com Whisper (não dá pra ouvir daqui):
#   .venv/bin/python verificar.py <pasta>          -> cada fala isolada vs texto
#   .venv/bin/python verificar.py <pasta> --reel   -> reel.mp4 final, com música
import json, sys
from faster_whisper import WhisperModel

d = sys.argv[1]
m = WhisperModel('small', device='cpu', compute_type='int8')
if '--reel' in sys.argv:
    segs, _ = m.transcribe(f'{d}/reel.mp4', language='pt', condition_on_previous_text=False)
    for s in segs: print(f'{s.start:5.1f}-{s.end:5.1f}  {s.text.strip()}')
else:
    textos = json.load(open(f'{d}/tmp/falas_textos.json'))
    for k, chave in textos.items():
        segs, _ = m.transcribe(f'{d}/tmp/fala_{k}.wav', language='pt')
        print(f'{k:11}| escrito: {chave.split("|", 2)[2]}\n{"":11}| ouvido:  {" ".join(s.text.strip() for s in segs)}')

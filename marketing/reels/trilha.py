# Trilha original do reel, sintetizada aqui (sem licença de terceiros).
#   python3 marketing/reels/trilha.py <pasta-do-reel>  ->  <pasta>/tmp/trilha.wav
# Pop corporativo 112 BPM, I–V–vi–IV em Dó; bateria completa entra na marca
# "drop" do legendas.json. Duração = marca "fim" + card final.
import json, math, random, sys, wave, array, os

DIR = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
m = json.load(open(f'{DIR}/marcas.json'))
drop_em = m[json.load(open(f'{DIR}/legendas.json'))['drop']]
SR, BPM = 44100, 112
falas = json.load(open(f'{DIR}/tmp/falas.json')) if os.path.exists(f'{DIR}/tmp/falas.json') else {}
DUR = m['fim'] + max(3, falas.get('fim', 0) + 0.9)  # mesmo cálculo do montar.mjs
BEAT = 60 / BPM
DROP = round(drop_em / (4 * BEAT)) * 4 * BEAT  # alinhado ao compasso
N = int(DUR * SR)
mix = array.array('f', bytes(4 * N))
random.seed(7)

def put(t, samples, vol):
    i0 = int(t * SR)
    for k, s in enumerate(samples):
        if i0 + k >= N: break
        mix[i0 + k] += s * vol

def hz(midi): return 440 * 2 ** ((midi - 69) / 12)

def tom(f, dur, ataque=0.005, queda=4.0, harm=(1, .5, .25)):
    n = int(dur * SR)
    return [sum(a * math.sin(2 * math.pi * f * (h + 1) * k / SR) for h, a in enumerate(harm))
            * min(1, k / (ataque * SR)) * math.exp(-queda * k / SR) for k in range(n)]

def pad(fs, dur):
    n = int(dur * SR)
    out = [0.0] * n
    for f in fs:
        for d in (0.997, 1.003):  # leve desafinação = coro
            w = 2 * math.pi * f * d / SR
            for k in range(n):
                out[k] += math.sin(w * k) + 0.3 * math.sin(2 * w * k)
    env = lambda k: min(1, k / (0.3 * SR)) * min(1, (n - k) / (0.3 * SR))
    return [s * env(k) / (len(fs) * 2) for k, s in enumerate(out)]

def kick():
    n = int(0.35 * SR); fase = 0.0; out = []
    for k in range(n):
        fase += 2 * math.pi * (45 + 110 * math.exp(-k / (0.03 * SR))) / SR
        out.append(math.sin(fase) * math.exp(-k / (0.09 * SR)))
    return out

def ruido(dur, queda):
    return [(random.random() * 2 - 1) * math.exp(-k / (queda * SR)) for k in range(int(dur * SR))]

# I–V–vi–IV: C G Am F (tríades + baixo)
acordes = [([60, 64, 67], 36), ([59, 62, 67], 43), ([60, 64, 69], 45), ([60, 65, 69], 41)]
KICK, HAT, CLAP = kick(), ruido(0.05, 0.012), ruido(0.18, 0.05)
cache = {}
def nota(midi, dur, **kw):
    key = (midi, dur, tuple(kw.items()))
    if key not in cache: cache[key] = tom(hz(midi), dur, **kw)
    return cache[key]

compasso, t = 0, 0.0
while t < DUR:
    tri, baixo = acordes[compasso % 4]
    put(t, pad([hz(x) for x in tri], 4 * BEAT), 0.16)
    arp = tri + [tri[0] + 12]
    for i in range(8):  # arpejo em colcheias
        put(t + i * BEAT / 2, nota(arp[i % 4] + 12, 0.4, queda=7), 0.10)
    cheio = t >= DROP - 1e-6
    for b in range(4):
        tb = t + b * BEAT
        put(tb, nota(baixo, BEAT * 0.9, queda=3, harm=(1, .6, .3)), 0.30 if cheio else 0.18)
        if cheio:
            put(tb, KICK, 0.55)
            if b in (1, 3): put(tb, CLAP, 0.14)
        for h in (0, 0.5):
            put(tb + h * BEAT, HAT, 0.05 if cheio else 0.025)
    compasso += 1; t += 4 * BEAT

pico = max(abs(s) for s in mix) or 1
os.makedirs(f'{DIR}/tmp', exist_ok=True)
with wave.open(f'{DIR}/tmp/trilha.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(array.array('h', (int(s / pico * 0.9 * 32767) for s in mix)).tobytes())
print(f'{DIR}/tmp/trilha.wav', f'{DUR:.1f}s drop={DROP:.1f}s')

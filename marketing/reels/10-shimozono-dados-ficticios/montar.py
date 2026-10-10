"""Monta a captura demonstrativa do Chrome em vídeo vertical com trilha original."""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
TMP = ROOT / 'tmp'
SCENES = json.loads((TMP / 'scenes.json').read_text())
FONT = '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'
BOLD = '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'
SPECS = [
    (2.6, (245, 75, 900, 760), 'Dados do seu lead.', 'Do funil à investigação.', '01  /  ENCONTRE'),
    (2.0, (245, 85, 1050, 760), 'Encontre a empresa.', 'Filtre em segundos.', '01  /  ENCONTRE'),
    (3.0, (250, 140, 660, 700), 'Encontre a empresa.', 'Filtre em segundos.', '01  /  ENCONTRE'),
    (2.4, (250, 180, 620, 650), 'Abra os detalhes.', 'Tudo no mesmo lugar.', '02  /  INVESTIGUE'),
    (2.8, (650, 42, 600, 810), 'Abra os detalhes.', 'Tudo no mesmo lugar.', '02  /  INVESTIGUE'),
    (2.0, (650, 42, 600, 810), 'Investigue a empresa.', 'Amplie seu contexto.', '02  /  INVESTIGUE'),
    (4.5, (650, 42, 600, 810), 'Investigue a empresa.', 'Amplie seu contexto.', '02  /  INVESTIGUE'),
    (4.0, (650, 42, 600, 810), 'Contatos e fontes.', 'Mais contexto para vender.', '03  /  CONSULTE'),
    (4.0, (650, 42, 600, 810), 'Contatos e fontes.', 'Mais contexto para vender.', '03  /  CONSULTE'),
]

def run(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)

def text_filter(text, y, size=48, color='white', bold=False, x='70'):
    path = TMP / f'text-{len(list(TMP.glob("text-*.txt"))):03}.txt'
    path.write_text(text)
    return f"drawtext=fontfile={BOLD if bold else FONT}:textfile={path}:fontcolor={color}:fontsize={size}:x={x}:y={y}"

assert len(SCENES) == len(SPECS)
segments = []
elapsed = 0
for index, (scene, spec) in enumerate(zip(SCENES, SPECS)):
    duration, crop, headline, sub, stage = spec
    frames = sorted(scene['frames'], key=lambda frame: frame['ts'])
    assert frames and all(pathlib.Path(f['file']).is_file() for f in frames)
    assert all(b['ts'] >= a['ts'] for a, b in zip(frames, frames[1:]))
    raw_duration = scene['end'] - frames[0]['ts']
    assert 0 < raw_duration < 60
    listing = ['ffconcat version 1.0']
    for n, frame in enumerate(frames):
        end = frames[n+1]['ts'] if n+1 < len(frames) else scene['end']
        listing += [f"file '{frame['file']}'", f"duration {max(.001, end-frame['ts']):.6f}"]
    listing += [f"file '{frames[-1]['file']}'"]
    concat = TMP / f'{index:02}-frames.txt'
    concat.write_text('\n'.join(listing))
    x, y, w, h = crop
    # Mantém o painel original; o recorte amplia somente a área útil.
    zoom = f'crop={w}:{h}:{x}:{y},scale=960:-2:flags=lanczos'
    titles = ','.join([
        text_filter(stage, 188, 23, '0x8BA3FF', bold=True),
        text_filter(headline, 238, 53, bold=True),
        text_filter(sub, 315, 39, '0xBCC6DD'),
        text_filter('Demonstração • dados fictícios', 1755, 27, '0x98A4BD', x='(w-tw)/2'),
        text_filter('rovva.tech', 1810, 30, 'white', bold=True, x='(w-tw)/2'),
    ])
    progress = f"drawbox=x=60:y=1874:w={960*(index+1)/len(SCENES):.1f}:h=4:color=0x3E66EA:t=fill"
    graph = f"[0:v]setpts=(PTS-STARTPTS)*{duration/raw_duration},fps=30,{zoom},setsar=1[v];color=c=0x0D1220:s=1080x1920:r=30:d={duration}[bg];[bg][v]overlay=60:440+(1280-overlay_h)/2:shortest=1[b];[b][1:v]overlay=70:90,{titles},{progress},format=yuv420p[out]"
    if index == 6:
        graph = graph.replace(',format=yuv420p[out]', ',' + text_filter('Tempo de espera reduzido', 1695, 24, '0x98A4BD', x='(w-tw)/2') + ',format=yuv420p[out]')
    output = TMP / f'{index:02}-vertical.mp4'
    run(['-f','concat','-safe','0','-i',str(concat),'-loop','1','-i',str(TMP/'logo.png'),'-filter_complex',graph,'-map','[out]','-t',str(duration),'-an','-c:v','libx264','-preset','fast','-crf','17','-threads','4',str(output)])
    segments.append(output)
    elapsed += duration
    print(f'{scene["label"]}: concluída', flush=True)

final_duration = 3.7
final_filter = ','.join([
    text_filter('Menos pesquisa.', 710, 76, bold=True, x='(w-tw)/2'),
    text_filter('Mais conversa.', 815, 76, '0x6F8EFF', bold=True, x='(w-tw)/2'),
    text_filter('Conheça a Rovva', 1100, 48, bold=True, x='(w-tw)/2'),
    text_filter('rovva.tech', 1190, 38, '0xBCC6DD', x='(w-tw)/2'),
])
final = TMP / '10-final.mp4'
run(['-f','lavfi','-i',f'color=c=0x0D1220:s=1080x1920:r=30:d={final_duration}','-loop','1','-i',str(TMP/'logo.png'),'-filter_complex',f'[0:v][1:v]overlay=(W-w)/2:470,{final_filter},fade=out:st=3.3:d=0.4,format=yuv420p[out]','-map','[out]','-t',str(final_duration),'-an','-c:v','libx264','-preset','fast','-crf','17','-threads','4',str(final)])
segments.append(final)
total = elapsed + final_duration
(ROOT/'marcas.json').write_text(json.dumps({'inicio':0,'drop':4.6,'fim':total-3}))
(ROOT/'legendas.json').write_text(json.dumps({'drop':'drop'}))
subprocess.run(['python3',str(ROOT.parent/'trilha.py'),str(ROOT)],check=True)
joined=TMP/'join.txt'
joined.write_text('\n'.join(f"file '{p}'" for p in segments))
run(['-f','concat','-safe','0','-i',str(joined),'-i',str(TMP/'trilha.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',f'aecho=0.8:0.5:60|120:0.18|0.09,pan=stereo|c0=c0|c1=c0,afade=t=in:d=0.6,afade=t=out:st={total-2}:d=2,loudnorm=I=-16:TP=-1.5:LRA=9','-c:a','aac','-b:a','192k','-ar','48000','-t',str(total),'-movflags','+faststart',str(ROOT/'rovva-dados-ficticios.mp4')])
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(ROOT/'rovva-dados-ficticios.mp4')]))
video=next(s for s in probe['streams'] if s['codec_type']=='video')
audio=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (video['width'],video['height'],video['avg_frame_rate'])==(1080,1920,'30/1')
assert audio['channels']==2 and audio['sample_rate']=='48000'
assert abs(float(probe['format']['duration'])-total)<.2
(ROOT/'verificacao.json').write_text(json.dumps({'width':1080,'height':1920,'fps':30,'duration':total,'audio':'stereo 48000 Hz','privacy':'contatos, endereço, documentos e valores substituídos visualmente por dados fictícios antes da captura','example':'Supermercado Shimozono','sources':'interface real, consulta executada; tempo de espera reduzido'},ensure_ascii=False,indent=2))
print(f'Vídeo pronto: {total:.1f}s',flush=True)

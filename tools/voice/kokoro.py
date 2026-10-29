#!/usr/bin/env python3
"""Speaks lines of text with Kokoro-82M (through kokoro-onnx), one WAV file per line, for tools/voice/narrate.mjs.

Each line is cached as <cache>/<hash>.wav, the hash taken from the text (as given, already normalised for speech), the
voice, the speed and the language, so a second run only renders the lines that changed. The model files stay outside
the repository (see README.md).

  kokoro.py render  [--cache DIR] [--voice af_heart] [--speed 1] [--lang en-us] < lines.json
      lines.json: a JSON list of strings. Prints a JSON list of { text, file, dur, cached } (dur in seconds).
  kokoro.py phonemes [--lang en-us] < lines.json
      Prints the phonemes espeak-ng gives Kokoro for each line (a JSON list of strings), to check pronunciations.
  kokoro.py mix --out FILE.wav --length SECONDS < layout.json
      layout.json: a JSON list of { file, at } (at in seconds). Writes one mono WAV with each file placed at its time.

The model: --model and --voices, or KOKORO_MODEL and KOKORO_VOICES, or KOKORO_DIR holding kokoro-v1.0.onnx and
voices-v1.0.bin. The cache: --cache, or VOICE_CACHE, or <KOKORO_DIR>/cache.
"""
import argparse
import hashlib
import json
import os
import sys
import time


def paths(a):
    d = os.environ.get('KOKORO_DIR', '')
    model = a.model or os.environ.get('KOKORO_MODEL') or (d and os.path.join(d, 'kokoro-v1.0.onnx'))
    voices = a.voices or os.environ.get('KOKORO_VOICES') or (d and os.path.join(d, 'voices-v1.0.bin'))
    if not model or not voices or not os.path.exists(model) or not os.path.exists(voices):
        sys.exit('kokoro.py: model files not found: set KOKORO_DIR (or KOKORO_MODEL and KOKORO_VOICES), see README.md')
    return model, voices


def cache_dir(a):
    c = a.cache or os.environ.get('VOICE_CACHE') or (os.environ.get('KOKORO_DIR') and os.path.join(os.environ['KOKORO_DIR'], 'cache'))
    if not c:
        sys.exit('kokoro.py: no cache folder: give --cache or VOICE_CACHE (outside the repository)')
    os.makedirs(c, exist_ok=True)
    return c


def line_hash(text, voice, speed, lang):
    return hashlib.sha1(f'{voice}\n{float(speed):g}\n{lang}\n{text}'.encode('utf-8')).hexdigest()[:20]


def render(a):
    import soundfile as sf
    lines = json.load(sys.stdin)
    cache, out, k = cache_dir(a), [], None
    for i, text in enumerate(lines):
        f = os.path.join(cache, line_hash(text, a.voice, a.speed, a.lang) + '.wav')
        cached = os.path.exists(f)
        if not cached:
            if k is None:
                from kokoro_onnx import Kokoro
                k = Kokoro(*paths(a))
            w = time.time()
            samples, sr = k.create(text, voice=a.voice, speed=a.speed, lang=a.lang)
            sf.write(f + '.tmp.wav', samples, sr, subtype='FLOAT')
            os.replace(f + '.tmp.wav', f)
            print(f'  [{i + 1}/{len(lines)}] {len(samples) / sr:5.1f} s in {time.time() - w:4.1f} s: {text[:70]}', file=sys.stderr)
        info = sf.info(f)
        out.append({'text': text, 'file': f, 'dur': info.frames / info.samplerate, 'cached': cached})
    json.dump(out, sys.stdout)


def phonemes(a):
    from kokoro_onnx.tokenizer import Tokenizer
    t = Tokenizer()
    json.dump([t.phonemize(s, a.lang) for s in json.load(sys.stdin)], sys.stdout, ensure_ascii=False)


def mix(a):
    import numpy as np
    import soundfile as sf
    layout = json.load(sys.stdin)
    sr = sf.info(layout[0]['file']).samplerate if layout else 24000
    buf = np.zeros(int(round(a.length * sr)) + 1, dtype=np.float32)
    for c in layout:
        s, r = sf.read(c['file'], dtype='float32')
        if r != sr:
            sys.exit(f'kokoro.py mix: {c["file"]} is at {r} Hz, not {sr}')
        i = int(round(c['at'] * sr))
        n = max(0, min(len(s), len(buf) - i))
        buf[i:i + n] += s[:n]
    sf.write(a.out, buf, sr, subtype='FLOAT')
    print(json.dumps({'file': a.out, 'dur': len(buf) / sr, 'rate': sr}))


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument('cmd', choices=['render', 'phonemes', 'mix'])
p.add_argument('--voice', default='af_heart')
p.add_argument('--speed', type=float, default=1.0)
p.add_argument('--lang', default='en-us')
p.add_argument('--cache')
p.add_argument('--model')
p.add_argument('--voices')
p.add_argument('--out')
p.add_argument('--length', type=float, default=0)
args = p.parse_args()
{'render': render, 'phonemes': phonemes, 'mix': mix}[args.cmd](args)

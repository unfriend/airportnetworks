#!/usr/bin/env python3
"""Speaks lines of text with Piper (piper-tts), one WAV file per line, for tools/voice/narrate.mjs: the German voice
of a story in two languages (Kokoro has no German). The counterpart of kokoro.py, with the same interface.

Piper speaks a line sentence by sentence; the sentences are joined with a short pause (--pause, seconds), and the quiet
Piper leaves before a line is trimmed, as Kokoro's lines start. A line may give Piper phonemes of its own in [[...]]
(say.json's German entries; espeak-ng's IPA). Each line is cached as <cache>/<hash>.wav, the hash taken from the engine
('piper'), the voice (the model's name), the speed, the language (the model's espeak-ng voice), the pause and the text
(as given, already made ready for speech), so a second run only renders the lines that changed. Piper's lines are
22.05 kHz (the model's own rate); narrate.mjs makes the recording 44.1 kHz. The model files stay outside the
repository (see README.md).

  piper.py render  [--cache DIR] [--voice de_DE-thorsten-high] [--speed 1] [--pause 0.25] < lines.json
      lines.json: a JSON list of strings. Prints a JSON list of { text, file, dur, cached } (dur in seconds).
  piper.py phonemes [--voice de_DE-thorsten-high] < lines.json
      Prints the phonemes espeak-ng gives Piper for each line (a JSON list of strings), to check pronunciations. A word
      espeak-ng takes for another language shows its switch, as (en)...(de): Piper says it with those phonemes. A
      phoneme the voice does not know is marked with a ? after it (Piper leaves it out).
(kokoro.py mix places these lines as it places Kokoro's.)

The model: --model (a path to the .onnx, its .onnx.json beside it), or --voice as a path, or for the default voice
PIPER_MODEL, or the voice's name looked up as <name>.onnx in PIPER_DIR, then in KOKORO_DIR. The cache: --cache, or
VOICE_CACHE, or <PIPER_DIR>/cache. piper-tts is GPL-3.0-or-later: it only runs here, offline, as espeak-ng does;
nothing of it goes into the app.
"""
import argparse
import hashlib
import json
import os
import sys
import time

# this file is called piper.py too: take its folder off the path, so `import piper` finds piper-tts, not this file
sys.path = [p for p in sys.path if os.path.abspath(p or '.') != os.path.dirname(os.path.abspath(__file__))]


DEFAULT = 'de_DE-thorsten-high'


def model_path(a):
    v = a.voice
    if a.model:
        m = a.model
    elif v.endswith('.onnx') or os.sep in v:
        m = v
    elif v == DEFAULT and os.environ.get('PIPER_MODEL'):
        m = os.environ['PIPER_MODEL']
    else:
        m = next((os.path.join(d, v + '.onnx') for d in (os.environ.get('PIPER_DIR'), os.environ.get('KOKORO_DIR'))
                  if d and os.path.exists(os.path.join(d, v + '.onnx'))), '')
    if not m or not os.path.exists(m) or not os.path.exists(m + '.json'):
        sys.exit(f'piper.py: model not found for {v!r}: give --model, or set PIPER_MODEL, or PIPER_DIR holding '
                 f'{v}.onnx and {v}.onnx.json (see README.md)')
    return m


def cache_dir(a):
    d = os.environ.get('PIPER_DIR') or os.environ.get('KOKORO_DIR')
    c = a.cache or os.environ.get('VOICE_CACHE') or (d and os.path.join(d, 'cache'))
    if not c:
        sys.exit('piper.py: no cache folder: give --cache or VOICE_CACHE (outside the repository)')
    os.makedirs(c, exist_ok=True)
    return c


def line_hash(text, voice, speed, lang, pause):
    return hashlib.sha1(f'piper\n{voice}\n{float(speed):g}\n{lang}\n{float(pause):g}\n{text}'.encode('utf-8')).hexdigest()[:20]


# phonemes given as [[...]] (say.json) take the punctuation right after them in with them: espeak-ng gives a lone comma
# no phonemes, so the pause would be lost
def prep(text):
    import re
    return re.sub(r'\]\]([,.;:!?]+)', r'\1]]', text)


def config(m):
    with open(m + '.json', encoding='utf-8') as f:
        c = json.load(f)
    return os.path.basename(m)[:-len('.onnx')] if m.endswith('.onnx') else os.path.basename(m), c['espeak']['voice']


def render(a):
    import numpy as np
    import soundfile as sf
    m = model_path(a)
    name, lang = config(m)
    lines = json.load(sys.stdin)
    cache, out, v = cache_dir(a), [], None
    for i, text in enumerate(lines):
        f = os.path.join(cache, line_hash(text, name, a.speed, lang, a.pause) + '.wav')
        cached = os.path.exists(f)
        if not cached:
            if v is None:
                from piper import PiperVoice, SynthesisConfig
                v = PiperVoice.load(m)
                syn = SynthesisConfig(length_scale=1 / a.speed)
            w = time.time()
            parts, sr = [], v.config.sample_rate
            for c in v.synthesize(prep(text), syn_config=syn):
                if parts:
                    parts.append(np.zeros(int(round(a.pause * sr)), dtype=np.float32))
                parts.append(c.audio_float_array)
            samples = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
            # Piper leaves up to a quarter of a second of quiet before a line: trimmed to 20 ms (and the end to 80 ms),
            # as Kokoro's lines start, so the words start where narrate.mjs puts them (0.3 s after their cue)
            loud = np.flatnonzero(np.abs(samples) > 0.01)
            if len(loud):
                samples = samples[max(0, loud[0] - int(0.02 * sr)):loud[-1] + int(0.08 * sr)]
            sf.write(f + '.tmp.wav', samples, sr, subtype='FLOAT')
            os.replace(f + '.tmp.wav', f)
            print(f'  [{i + 1}/{len(lines)}] {len(samples) / sr:5.1f} s in {time.time() - w:4.1f} s: {text[:70]}', file=sys.stderr)
        info = sf.info(f)
        out.append({'text': text, 'file': f, 'dur': info.frames / info.samplerate, 'cached': cached})
    json.dump(out, sys.stdout)


def phonemes(a):
    # espeak-ng as Piper calls it (its own copy and data), with the language switches left in; phonemes given in the
    # text as [[...]] (say.json) go to Piper as they are, shown so; a phoneme the voice does not know (Piper leaves it
    # out) is marked with a ? after it
    import re
    import unicodedata
    from piper import espeakbridge
    from piper.phonemize_espeak import ESPEAK_DATA_DIR
    m = model_path(a)
    _, lang = config(m)
    with open(m + '.json', encoding='utf-8') as f:
        known = set(json.load(f)['phoneme_id_map'])
    espeakbridge.initialize(str(ESPEAK_DATA_DIR))
    espeakbridge.set_voice(lang)
    mark = lambda s: ''.join(c + ('?' if c not in known and c not in ' ()' else '') for c in s)
    out = []
    for s in json.load(sys.stdin):
        parts = []
        for part in re.split(r'(\[\[.*?\]\])', prep(s)):
            if part.startswith('[['):
                parts.append('[[' + mark(part[2:-2].strip()) + ']]')
            elif part.strip():
                ph = ''.join(p + t + ' ' for p, t, _ in espeakbridge.get_phonemes(part)).strip()
                # (the language switches, such as (en), are not phonemes: Piper takes them out)
                parts.append(''.join(x if x.startswith('(') else mark(unicodedata.normalize('NFD', x)) for x in re.split(r'(\([^)]*\))', ph)))
        out.append(' '.join(parts))
    json.dump(out, sys.stdout, ensure_ascii=False)


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument('cmd', choices=['render', 'phonemes'])
p.add_argument('--voice', default=DEFAULT)
p.add_argument('--speed', type=float, default=1.0)
p.add_argument('--pause', type=float, default=0.25)
p.add_argument('--cache')
p.add_argument('--model')
args = p.parse_args()
{'render': render, 'phonemes': phonemes}[args.cmd](args)

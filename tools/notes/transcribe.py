#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = ["faster-whisper"]
# ///
"""Transcribe one audio file with faster-whisper (CPU, int8). Prints only JSON on stdout:
{ text, lang, segments: [{ start, end, text }] }. Logs go to stderr. The language is found by itself."""
import argparse, json, subprocess, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('--model', default='small')
    a = ap.parse_args()
    import numpy as np
    from faster_whisper import WhisperModel
    # ffmpeg decodes webm, ogg, m4a (not PyAV: its newest versions do not fit faster-whisper)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], capture_output=True)
    if raw.returncode != 0:
        print(raw.stderr.decode(errors='replace'), file=sys.stderr); sys.exit(2)
    pcm = np.frombuffer(raw.stdout, dtype=np.float32)
    print('loading model ' + a.model, file=sys.stderr)
    m = WhisperModel(a.model, device='cpu', compute_type='int8')
    segs, info = m.transcribe(pcm, vad_filter=True)
    out = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segs]
    print(json.dumps({'text': ' '.join(s['text'] for s in out).strip(), 'lang': info.language, 'segments': out}, ensure_ascii=False))

if __name__ == '__main__':
    main()

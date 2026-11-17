#!/usr/bin/env node
// Writes dub-techno.vcv, a Cardinal patch that plays a mellow dub techno groove at 120 bpm and takes the room's MIDI
// from the output page (the shared MIDI map in README.md). Deterministic: the same file every run.
//
//   node tools/output/cardinal/make.mjs                 write the patch
//   node tools/output/cardinal/make.mjs --check         exit 1 when the file is not what this script writes
//   node tools/output/cardinal/make.mjs --check --src <Cardinal source>   (or CARDINAL_SRC=...) also check every
//        plugin, model, version, param, input and output id against Cardinal's own sources (its plugins' plugin.json,
//        plugins/plugins.cpp, and each module's enums), each param value against its configParam range, that no
//        input has two cables and that no two modules overlap. The sources are not in this repository: a clone of
//        github.com/DISTRHO/Cardinal with the submodules used here (Fundamental, Befaco, ValleyAudio).
//
// A .vcv is Rack 2's patch JSON: modules { id, plugin, model, version, params [{ id, value }], data, pos [hp, row] }
// and cables { id, outputModuleId, outputId, inputModuleId, inputId, color }. Rack's ids are the indices of each
// module's enums (removed entries still count), so the tables below copy those enums in their order, and the check
// compares them with the source.
//
// Why it is built the way it is (more in README.md):
// - Cardinal's Host MIDI module gives no clock pulses from incoming MIDI clock (its docs: "Clock pulses are not
//   available on this module in Cardinal"; Rack's Core MIDI modules are replaced by Cardinal's Host ones). It does give
//   Start and Stop triggers from MIDI Start (0xFA) and Stop (0xFC). So the patch keeps its own 120 bpm clock (an LFO's
//   square at 8 Hz, sixteenths) and the output page's Start resets that clock's phase, the sequencer and the wobble LFO
//   on the same sample: the bar starts where the room's downbeat is. Stop stops new notes (tails ring out); Start plays
//   again. With no MIDI at all it just plays.
// - Only Fundamental (VCV), Befaco (Kickall, Dual Atenuverter), Valley (Plateau) and Cardinal's own Host modules: all
//   bundled in every Cardinal build.
// - Every controller at 0 (nobody has moved anything yet) is a pleasant setting: the filter low, the echo short, the
//   reverb modest, the stab short, the hats at a third, the throw at a quarter, no wobble.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const DIR = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'dub-techno.vcv');

// ---------- the modules used, their enums as in Cardinal's sources (order matters) ----------
// A list entry is a name, or [name, count] for Rack's ENUMS(name, count). hp: panel width in HP (15 px).
const MODELS = {
  HostMIDI: { plugin: 'Cardinal', version: '2.0.0', file: 'Cardinal/src/HostMIDI.cpp', hp: 9,
    params: [],
    inputs: ['PITCH_INPUT', 'GATE_INPUT', 'VELOCITY_INPUT', 'AFTERTOUCH_INPUT', 'PITCHBEND_INPUT', 'MODWHEEL_INPUT',
      'CLK_INPUT', 'VOL_INPUT', 'PAN_INPUT', 'START_INPUT', 'STOP_INPUT', 'CONTINUE_INPUT'],
    outputs: ['PITCH_OUTPUT', 'GATE_OUTPUT', 'VELOCITY_OUTPUT', 'AFTERTOUCH_OUTPUT', 'PITCHBEND_OUTPUT', 'MODWHEEL_OUTPUT',
      'RETRIGGER_OUTPUT', 'CLOCK_OUTPUT', 'CLOCK_DIV_OUTPUT', 'START_OUTPUT', 'STOP_OUTPUT', 'CONTINUE_OUTPUT'] },
  HostMIDICC: { plugin: 'Cardinal', version: '2.0.0', file: 'Cardinal/src/HostMIDI-CC.cpp', hp: 14,
    params: [], inputs: [['CC_INPUTS', 16], 'CC_INPUT_CH_PRESSURE', 'CC_INPUT_PITCHBEND'],
    outputs: [['CC_OUTPUT', 16], 'CC_OUTPUT_CH_PRESSURE', 'CC_OUTPUT_PITCHBEND'] },
  HostMIDIGate: { plugin: 'Cardinal', version: '2.0.0', file: 'Cardinal/src/HostMIDI-Gate.cpp', hp: 14,
    params: [], inputs: [['GATE_INPUTS', 18]], outputs: [['GATE_OUTPUTS', 18]] },
  // HostAudio2 has no enums: config(numParams, numIO, numIO) with configParam(0, 0, 2, 1, "Level"); inputs 0 and 1
  // go to the host's left and right outputs. The check looks for that configParam line instead.
  HostAudio2: { plugin: 'Cardinal', version: '2.0.0', file: 'Cardinal/src/HostAudio.cpp', hp: 8, noEnum: true,
    params: ['LEVEL'], inputs: ['LEFT', 'RIGHT'], outputs: ['LEFT', 'RIGHT'], ranges: { LEVEL: [0, 2] } },
  TextEditor: { plugin: 'Cardinal', version: '2.0.0', file: 'Cardinal/src/TextEditor.cpp', hp: 24, noEnum: true,
    params: [], inputs: [], outputs: [] },
  LFO: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/LFO.cpp', hp: 9,
    params: ['OFFSET_PARAM', 'INVERT_PARAM', 'FREQ_PARAM', 'FM_PARAM', 'FM2_PARAM', 'PW_PARAM', 'PWM_PARAM'],
    inputs: ['FM_INPUT', 'FM2_INPUT', 'RESET_INPUT', 'PW_INPUT', 'CLOCK_INPUT'],
    outputs: ['SIN_OUTPUT', 'TRI_OUTPUT', 'SAW_OUTPUT', 'SQR_OUTPUT'] },
  'VCA-1': { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/VCA-1.cpp', hp: 3,
    params: ['LEVEL_PARAM', 'EXP_PARAM'], inputs: ['CV_INPUT', 'IN_INPUT'], outputs: ['OUT_OUTPUT'] },
  SEQ3: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/SEQ3.cpp', hp: 22,
    params: ['TEMPO_PARAM', 'RUN_PARAM', 'RESET_PARAM', 'TRIG_PARAM', ['CV_PARAMS', 24], ['GATE_PARAMS', 8],
      'TEMPO_CV_PARAM', 'STEPS_CV_PARAM'],
    inputs: ['TEMPO_INPUT', 'CLOCK_INPUT', 'RESET_INPUT', 'STEPS_INPUT', 'RUN_INPUT'],
    outputs: ['TRIG_OUTPUT', ['CV_OUTPUTS', 3], ['STEP_OUTPUTS', 8], 'STEPS_OUTPUT', 'CLOCK_OUTPUT', 'RUN_OUTPUT',
      'RESET_OUTPUT'] },
  Mixer: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/Mixer.cpp', hp: 3,
    params: ['LEVEL_PARAM'], inputs: [['IN_INPUTS', 6]], outputs: ['OUT_OUTPUT'] },
  Noise: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/Noise.cpp', hp: 3,
    params: [], inputs: [],
    outputs: ['WHITE_OUTPUT', 'PINK_OUTPUT', 'RED_OUTPUT', 'VIOLET_OUTPUT', 'BLUE_OUTPUT', 'GRAY_OUTPUT', 'BLACK_OUTPUT'] },
  VCF: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/VCF.cpp', hp: 7,
    params: ['FREQ_PARAM', 'FINE_PARAM', 'RES_PARAM', 'FREQ_CV_PARAM', 'DRIVE_PARAM', 'RES_CV_PARAM', 'DRIVE_CV_PARAM'],
    inputs: ['FREQ_INPUT', 'RES_INPUT', 'DRIVE_INPUT', 'IN_INPUT'], outputs: ['LPF_OUTPUT', 'HPF_OUTPUT'] },
  ADSR: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/ADSR.cpp', hp: 9,
    params: ['ATTACK_PARAM', 'DECAY_PARAM', 'SUSTAIN_PARAM', 'RELEASE_PARAM', 'ATTACK_CV_PARAM', 'DECAY_CV_PARAM',
      'SUSTAIN_CV_PARAM', 'RELEASE_CV_PARAM', 'PUSH_PARAM'],
    inputs: ['ATTACK_INPUT', 'DECAY_INPUT', 'SUSTAIN_INPUT', 'RELEASE_INPUT', 'GATE_INPUT', 'RETRIG_INPUT'],
    outputs: ['ENVELOPE_OUTPUT'] },
  VCMixer: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/VCMixer.cpp', hp: 9,
    params: ['MIX_LVL_PARAM', ['LVL_PARAMS', 4], 'CV_MIX_LVL_PARAM', ['CV_LVL_PARAMS', 4]],
    inputs: ['MIX_CV_INPUT', ['CH_INPUTS', 4], ['CV_INPUTS', 4]], outputs: ['MIX_OUTPUT', ['CH_OUTPUTS', 4]] },
  VCO: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/VCO.cpp', hp: 9,
    params: ['MODE_PARAM', 'SYNC_PARAM', 'FREQ_PARAM', 'FINE_PARAM', 'FM_PARAM', 'PW_PARAM', 'PW_CV_PARAM', 'LINEAR_PARAM'],
    inputs: ['PITCH_INPUT', 'FM_INPUT', 'SYNC_INPUT', 'PW_INPUT'],
    outputs: ['SIN_OUTPUT', 'TRI_OUTPUT', 'SAW_OUTPUT', 'SQR_OUTPUT'] },
  Delay: { plugin: 'Fundamental', version: '2.1.0', file: 'Fundamental/src/Delay.cpp', hp: 9,
    params: ['TIME_PARAM', 'FEEDBACK_PARAM', 'TONE_PARAM', 'MIX_PARAM', 'TIME_CV_PARAM', 'FEEDBACK_CV_PARAM',
      'TONE_CV_PARAM', 'MIX_CV_PARAM'],
    inputs: ['TIME_INPUT', 'FEEDBACK_INPUT', 'TONE_INPUT', 'MIX_INPUT', 'IN_INPUT', 'CLOCK_INPUT'],
    outputs: ['MIX_OUTPUT', 'WET_OUTPUT'] },
  Kickall: { plugin: 'Befaco', version: '2.9.0', file: 'Befaco/src/Kickall.cpp', hp: 6,
    params: ['TUNE_PARAM', 'TRIGG_BUTTON_PARAM', 'SHAPE_PARAM', 'DECAY_PARAM', 'TIME_PARAM', 'BEND_PARAM'],
    inputs: ['TRIGG_INPUT', 'VOLUME_INPUT', 'TUNE_INPUT', 'SHAPE_INPUT', 'DECAY_INPUT'], outputs: ['OUT_OUTPUT'] },
  DualAtenuverter: { plugin: 'Befaco', version: '2.9.0', file: 'Befaco/src/DualAtenuverter.cpp', hp: 5,
    params: ['ATEN1_PARAM', 'OFFSET1_PARAM', 'ATEN2_PARAM', 'OFFSET2_PARAM'],
    inputs: ['IN1_INPUT', 'IN2_INPUT'], outputs: ['OUT1_OUTPUT', 'OUT2_OUTPUT'] },
  Plateau: { plugin: 'Valley', version: '2.4.5', file: 'ValleyAudio/src/Plateau/Plateau.hpp',
    model: 'ValleyAudio/src/Plateau/Plateau.cpp', hp: 12,
    params: ['DRY_PARAM', 'WET_PARAM', 'PRE_DELAY_PARAM', 'INPUT_LOW_DAMP_PARAM', 'INPUT_HIGH_DAMP_PARAM', 'SIZE_PARAM',
      'DIFFUSION_PARAM', 'DECAY_PARAM', 'REVERB_HIGH_DAMP_PARAM', 'REVERB_LOW_DAMP_PARAM', 'MOD_SPEED_PARAM',
      'MOD_SHAPE_PARAM', 'MOD_DEPTH_PARAM', 'FREEZE_PARAM', 'CLEAR_PARAM', 'FREEZE_TOGGLE_PARAM', 'CLEAR_TOGGLE_PARAM',
      'DRY_CV_PARAM', 'WET_CV_PARAM', 'INPUT_LOW_DAMP_CV_PARAM', 'INPUT_HIGH_DAMP_CV_PARAM', 'SIZE_CV_PARAM',
      'DIFFUSION_CV_PARAM', 'DECAY_CV_PARAM', 'REVERB_HIGH_DAMP_CV_PARAM', 'REVERB_LOW_DAMP_CV_PARAM',
      'MOD_SPEED_CV_PARAM', 'MOD_SHAPE_CV_PARAM', 'MOD_DEPTH_CV_PARAM', 'TUNED_MODE_PARAM', 'DIFFUSE_INPUT_PARAM'],
    inputs: ['LEFT_INPUT', 'RIGHT_INPUT', 'DRY_CV_INPUT', 'WET_CV_INPUT', 'PRE_DELAY_CV_INPUT', 'INPUT_LOW_DAMP_CV_INPUT',
      'INPUT_HIGH_DAMP_CV_INPUT', 'SIZE_CV_INPUT', 'DIFFUSION_CV_INPUT', 'DECAY_CV_INPUT', 'REVERB_HIGH_DAMP_CV_INPUT',
      'REVERB_LOW_DAMP_CV_INPUT', 'MOD_SPEED_CV_INPUT', 'MOD_SHAPE_CV_INPUT', 'MOD_DEPTH_CV_INPUT', 'FREEZE_CV_INPUT',
      'CLEAR_CV_INPUT'],
    outputs: ['LEFT_OUTPUT', 'RIGHT_OUTPUT'] },
};

const expand = list => list.flatMap(e => Array.isArray(e) ? Array.from({ length: e[1] }, (_, k) => `${e[0]}+${k}`) : [e]);
const indexOf = (model, kind, name) => {
  const all = expand(MODELS[model][kind]);
  const n = name.includes('+') ? name : (all.includes(name) ? name : name + '+0');
  const i = all.indexOf(n);
  if (i < 0) throw new Error(`${model} has no ${kind} ${name}`);
  return i;
};

// ---------- the patch ----------
const modules = [], cables = [], byKey = {};
let nextId = 1001;
const mod = (key, model, row, x, params = {}, data) => {
  const id = nextId++;
  const m = { id, plugin: MODELS[model].plugin, model, version: MODELS[model].version,
    params: Object.entries(params).map(([n, v]) => ({ value: v, id: indexOf(model, 'params', n) }))
      .sort((a, b) => a.id - b.id) };
  if (data) m.data = data;
  m.pos = [x, row];
  modules.push(m); byKey[key] = { m, model };
  return x + MODELS[model].hp;
};
const COL = { clock: '#ffb437', audio: '#00b56e', cv: '#f44336', gate: '#c91847', midi: '#0986ad', fx: '#9c27b0' };
let cableId = 5001;
const wire = (from, out, to, inp, color) => {
  const a = byKey[from], b = byKey[to];
  cables.push({ id: cableId++, outputModuleId: a.m.id, outputId: indexOf(a.model, 'outputs', out),
    inputModuleId: b.m.id, inputId: indexOf(b.model, 'inputs', inp), color: COL[color] });
};

// The map (README.md): CC cells and gate cells of Host MIDI CC and Host MIDI Gate, MIDI channel 1.
const CC = { filter: 20, echo: 21, space: 22, decay: 23, hats: 24, thro: 25, wobble: 26 };
const CC_CELLS = [CC.filter, CC.echo, CC.space, CC.decay, CC.hats, CC.thro, CC.wobble];
const cell = cc => `CC_OUTPUT+${CC_CELLS.indexOf(cc)}`;
const NOTES = [48, 38, 51, 36]; // Stab, Rim, Siren, Kick on/off (held)
const gate = n => `GATE_OUTPUTS+${NOTES.indexOf(n)}`;
const pad = (list, n, fill) => list.concat(Array(n - list.length).fill(fill));
const r4 = v => Math.round(v * 1e4) / 1e4;

const NOTE_TEXT = [
  'DUB TECHNO FOR THE ROOM (generated by tools/output/cardinal/make.mjs: edit there, not here)',
  '',
  'Plays by itself at 120 bpm. The output page drives it on MIDI channel 1:',
  'Start (MIDI clock out on, Tempo 120, Start) puts bar 1 on the room\'s downbeat; Stop stops new notes.',
  'Cardinal does not follow MIDI clock ticks: the tempo here is its own 120 bpm.',
  '',
  'CC 20 Filter     CC 21 Echo feedback   CC 22 Space (reverb)',
  'CC 23 Stab decay CC 24 Hats            CC 25 Throw (echo send)',
  'CC 26 Wobble (filter LFO, 2 bars)',
  'Note 48 Stab   Note 38 Rim   Note 51 Siren',
  'Note 36 held: kick off (breakdown) while someone stands in the drop zone',
  '',
  'Pick the MIDI input in Cardinal\'s settings (loopMIDI, IAC Driver, ALSA virmidi).',
  'All controllers at 0 sound fine: they only add.',
].join('\n');

// Row 0: MIDI in, the note, audio out.
let x = 0;
x = mod('note', 'TextEditor', 0, x, {}, { filepath: '', lang: 'None', etext: NOTE_TEXT, width: 24 });
x = mod('midi', 'HostMIDI', 0, x, {}, { pwRange: 0, smooth: false, channels: 1, polyMode: 0, lastPitch: 8192,
  lastMod: 0, inputChannel: 1, outputChannel: 0 });
// Every CC starts at 0 (the "values" a saved patch keeps) and is smoothed, so a fader's steps do not zip.
x = mod('cc', 'HostMIDICC', 0, x, {}, { ccs: pad(CC_CELLS, 16, -1), values: Array(128).fill(0), smooth: true,
  mpeMode: false, lsbMode: false, inputChannel: 1, outputChannel: 0 });
x = mod('gates', 'HostMIDIGate', 0, x, {}, { notes: pad(NOTES, 18, -1), velocity: false, mpeMode: false,
  inputChannel: 1, outputChannel: 0 });
// Ch 1: 10 V - the note 36 gate (kick volume: off while held). Ch 2: the siren's envelope / 10 (+1 octave rise).
x = mod('atten', 'DualAtenuverter', 0, x, { ATEN1_PARAM: -1, OFFSET1_PARAM: 10, ATEN2_PARAM: 0.1, OFFSET2_PARAM: 0 });
x = mod('out', 'HostAudio2', 0, x, { LEVEL: 1 }, { dcFilter: true });

// Row 1: the clock, the transport, the sequencer, kick and hats.
x = 0;
// 8 Hz square = sixteenths at 120 bpm (LFO: freq = 2^FREQ Hz with no clock patched). Reset by MIDI Start.
x = mod('clock', 'LFO', 1, x, { OFFSET_PARAM: 1, INVERT_PARAM: 0, FREQ_PARAM: 3, PW_PARAM: 0.5 });
// Lets the clock through while the transport says "playing".
x = mod('clockGate', 'VCA-1', 1, x, { LEVEL_PARAM: 1, EXP_PARAM: 1 });
// The transport: Start resets it to step 1 (= playing), each Stop moves it on (step 1 off = stopped). It starts on step
// 1, so the patch plays with no MIDI at all.
x = mod('transport', 'SEQ3', 1, x, { TEMPO_PARAM: 1, TRIG_PARAM: 8 },
  { running: true, gates: Array(8).fill(1), clockPassthrough: false });
// The groove, 8 sixteenths (two beats): kick on steps 1 and 5, hats on the off-beats (steps 3 and 7, CV row 1), the
// chord stab on step 7 (the "and" of beats 2 and 4).
const seqParams = { TEMPO_PARAM: 3, TRIG_PARAM: 8 };
seqParams['CV_PARAMS+2'] = 10; seqParams['CV_PARAMS+6'] = 10;
x = mod('seq', 'SEQ3', 1, x, seqParams, { running: true, gates: Array(8).fill(1), clockPassthrough: false });
x = mod('kickOr', 'Mixer', 1, x, { LEVEL_PARAM: 1 }, { average: false, invert: false });
// About 49 Hz, short pitch drop, 0.3 s body: a soft four to the floor.
x = mod('kick', 'Kickall', 1, x, { TUNE_PARAM: 49, SHAPE_PARAM: 0.15, DECAY_PARAM: 0.35, TIME_PARAM: 0.12, BEND_PARAM: 0.3 });
x = mod('noise', 'Noise', 1, x);
// Hats: white noise high-passed at about 7 kHz, 20 ms.
x = mod('hatVcf', 'VCF', 1, x, { FREQ_PARAM: 0.97, RES_PARAM: 0.1, FREQ_CV_PARAM: 0, DRIVE_PARAM: 0 });
x = mod('hatEnv', 'ADSR', 1, x, { ATTACK_PARAM: 0, DECAY_PARAM: 0.32, SUSTAIN_PARAM: 0, RELEASE_PARAM: 0.3 });
x = mod('hatVca', 'VCA-1', 1, x, { LEVEL_PARAM: 0.35, EXP_PARAM: 1 });
// CC 24: a third of the hats at 0, all of them at 127 (VCMixer: level x (1 - k + k x CV/10), k = 0.7).
x = mod('hatMix', 'VCMixer', 1, x, { MIX_LVL_PARAM: 1, 'LVL_PARAMS+0': 1, 'CV_LVL_PARAMS+0': 0.7 });

// Row 2: the chord stab.
x = 0;
// C minor 9 without the fifth (C3 Eb3 Bb3 D4), the classic dub chord; a few cents apart for width.
// VCO FREQ_PARAM is semitones from C4.
x = mod('v1', 'VCO', 2, x, { FREQ_PARAM: -12, SYNC_PARAM: 1 });
x = mod('v2', 'VCO', 2, x, { FREQ_PARAM: r4(-9 + 0.06), SYNC_PARAM: 1 });
x = mod('v3', 'VCO', 2, x, { FREQ_PARAM: r4(-2 - 0.07), SYNC_PARAM: 1 });
x = mod('v4', 'VCO', 2, x, { FREQ_PARAM: r4(2 + 0.05), SYNC_PARAM: 1 });
x = mod('chordMix', 'VCMixer', 2, x, { MIX_LVL_PARAM: 1, 'LVL_PARAMS+0': 0.7, 'LVL_PARAMS+1': 0.7, 'LVL_PARAMS+2': 0.7,
  'LVL_PARAMS+3': 0.7 });
// The wobble: a 2-bar sine (0.25 Hz), reset at Start so it is in phase with the bar.
x = mod('wobble', 'LFO', 2, x, { OFFSET_PARAM: 0, INVERT_PARAM: 0, FREQ_PARAM: -2, PW_PARAM: 0.5 });
// The cutoff's CV: CC 20 + the wobble times CC 26 + the stab's own envelope (a little).
x = mod('cutMix', 'VCMixer', 2, x, { MIX_LVL_PARAM: 1, 'LVL_PARAMS+0': 1, 'LVL_PARAMS+1': 0.8, 'CV_LVL_PARAMS+1': 1,
  'LVL_PARAMS+2': 0.6 });
// Low-pass at about 350 Hz with CC 20 at 0 (VCF: C4 x 2^(10 p - 5)); CC 20 at 127 opens it 3.5 octaves (about 4 kHz).
const vcfParam = hz => r4((Math.log2(hz / 261.6256) + 5) / 10);
x = mod('chordVcf', 'VCF', 2, x, { FREQ_PARAM: vcfParam(350), RES_PARAM: 0.3, FREQ_CV_PARAM: 0.35, DRIVE_PARAM: 0 });
x = mod('stabOr', 'Mixer', 2, x, { LEVEL_PARAM: 1 }, { average: false, invert: false });
// ADSR time = 1 ms x 10000^p. A short stab (decay 63 ms, release 100 ms); CC 23 adds up to 0.25 to both (0.6 s, 1 s).
x = mod('stabEnv', 'ADSR', 2, x, { ATTACK_PARAM: 0.2, DECAY_PARAM: 0.45, SUSTAIN_PARAM: 0, RELEASE_PARAM: 0.5,
  DECAY_CV_PARAM: 0.25, RELEASE_CV_PARAM: 0.25 });
x = mod('stabVca', 'VCA-1', 2, x, { LEVEL_PARAM: 0.55, EXP_PARAM: 1 });

// Row 3: rim, siren, the dub delay, the mix and the reverb.
x = 0;
x = mod('rimVcf', 'VCF', 3, x, { FREQ_PARAM: vcfParam(1600), RES_PARAM: 0.7, FREQ_CV_PARAM: 0, DRIVE_PARAM: 0 });
x = mod('rimEnv', 'ADSR', 3, x, { ATTACK_PARAM: 0, DECAY_PARAM: 0.3, SUSTAIN_PARAM: 0, RELEASE_PARAM: 0.28 });
x = mod('rimVca', 'VCA-1', 3, x, { LEVEL_PARAM: 0.5, EXP_PARAM: 1 });
// The siren: a triangle at C5 swept +-0.75 octave by a 2.8 Hz triangle, rising an octave with its envelope.
x = mod('sirenLfo', 'LFO', 3, x, { OFFSET_PARAM: 0, INVERT_PARAM: 0, FREQ_PARAM: 1.5, PW_PARAM: 0.5 });
x = mod('siren', 'VCO', 3, x, { FREQ_PARAM: 12, FM_PARAM: 0.15, LINEAR_PARAM: 0, SYNC_PARAM: 1 });
x = mod('sirenEnv', 'ADSR', 3, x, { ATTACK_PARAM: 0.35, DECAY_PARAM: 0.7, SUSTAIN_PARAM: 0.5, RELEASE_PARAM: 0.75 });
x = mod('sirenVca', 'VCA-1', 3, x, { LEVEL_PARAM: 0.4, EXP_PARAM: 1 });
// The echo send: a quarter of the stab at CC 25 = 0, all of it at 127; the siren loud into it; a little rim.
x = mod('send', 'VCMixer', 3, x, { MIX_LVL_PARAM: 1, 'LVL_PARAMS+0': 1, 'CV_LVL_PARAMS+0': 0.75, 'LVL_PARAMS+1': 1.2,
  'LVL_PARAMS+2': 0.7 });
// The dub delay: dotted eighth at 120 bpm (0.375 s; time = 1 ms x 10000^p), its tone (a low-pass and high-pass in the
// feedback path) dark, feedback 0.42 rising to 0.84 with CC 21 (never runaway). The wet output only.
x = mod('delay', 'Delay', 3, x, { TIME_PARAM: r4(Math.log10(375) / 4), FEEDBACK_PARAM: 0.42, TONE_PARAM: 0.3,
  MIX_PARAM: 1, TIME_CV_PARAM: 0, FEEDBACK_CV_PARAM: 0.42, TONE_CV_PARAM: 0, MIX_CV_PARAM: 0 });
x = mod('mix', 'Mixer', 3, x, { LEVEL_PARAM: 0.6 }, { average: false, invert: false });
// Plateau: the dry kept, a modest long wet (its input low cut ~250 Hz keeps the kick out of the tail); CC 22 adds
// wet (+0.25) and size (+0.3).
x = mod('verb', 'Plateau', 3, x, { DRY_PARAM: 1, WET_PARAM: 0.18, PRE_DELAY_PARAM: 0.02, INPUT_LOW_DAMP_PARAM: 0.8,
  INPUT_HIGH_DAMP_PARAM: 3.6, SIZE_PARAM: 0.55, DIFFUSION_PARAM: 10, DECAY_PARAM: 0.72, REVERB_HIGH_DAMP_PARAM: 3.2,
  REVERB_LOW_DAMP_PARAM: 1.5, MOD_SPEED_PARAM: 0.15, MOD_SHAPE_PARAM: 0.5, MOD_DEPTH_PARAM: 1, FREEZE_PARAM: 0,
  CLEAR_PARAM: 0, FREEZE_TOGGLE_PARAM: 0, DRY_CV_PARAM: 0, WET_CV_PARAM: 0.025, SIZE_CV_PARAM: 0.3, TUNED_MODE_PARAM: 0,
  DIFFUSE_INPUT_PARAM: 1 }, { frozen: false, freezeToggle: false, panelStyle: 0, tuned: 0, diffuseInput: 1,
  preDelayCVSens: 0, inputSensitivity: 0, outputSaturation: 0 });

// ---------- cables ----------
// Start: the clock's phase, the transport, the sequencer and the wobble, all on the same sample.
for (const [to, inp] of [['clock', 'RESET_INPUT'], ['transport', 'RESET_INPUT'], ['seq', 'RESET_INPUT'],
  ['wobble', 'RESET_INPUT']]) wire('midi', 'START_OUTPUT', to, inp, 'midi');
wire('midi', 'STOP_OUTPUT', 'transport', 'CLOCK_INPUT', 'midi');
wire('clock', 'SQR_OUTPUT', 'clockGate', 'IN_INPUT', 'clock');
wire('transport', 'STEP_OUTPUTS+0', 'clockGate', 'CV_INPUT', 'clock');
wire('clockGate', 'OUT_OUTPUT', 'seq', 'CLOCK_INPUT', 'clock');
// Kick: steps 1 and 5, its volume from note 36.
wire('seq', 'STEP_OUTPUTS+0', 'kickOr', 'IN_INPUTS+0', 'gate');
wire('seq', 'STEP_OUTPUTS+4', 'kickOr', 'IN_INPUTS+1', 'gate');
wire('kickOr', 'OUT_OUTPUT', 'kick', 'TRIGG_INPUT', 'gate');
wire('gates', gate(36), 'atten', 'IN1_INPUT', 'midi');
wire('atten', 'OUT1_OUTPUT', 'kick', 'VOLUME_INPUT', 'cv');
// Hats.
wire('noise', 'WHITE_OUTPUT', 'hatVcf', 'IN_INPUT', 'audio');
wire('seq', 'CV_OUTPUTS+0', 'hatEnv', 'GATE_INPUT', 'gate');
wire('hatVcf', 'HPF_OUTPUT', 'hatVca', 'IN_INPUT', 'audio');
wire('hatEnv', 'ENVELOPE_OUTPUT', 'hatVca', 'CV_INPUT', 'cv');
wire('hatVca', 'OUT_OUTPUT', 'hatMix', 'CH_INPUTS+0', 'audio');
wire('cc', cell(CC.hats), 'hatMix', 'CV_INPUTS+0', 'midi');
// Chord.
['v1', 'v2', 'v3', 'v4'].forEach((v, k) => wire(v, 'SAW_OUTPUT', 'chordMix', `CH_INPUTS+${k}`, 'audio'));
wire('chordMix', 'MIX_OUTPUT', 'chordVcf', 'IN_INPUT', 'audio');
wire('cc', cell(CC.filter), 'cutMix', 'CH_INPUTS+0', 'midi');
wire('wobble', 'SIN_OUTPUT', 'cutMix', 'CH_INPUTS+1', 'cv');
wire('cc', cell(CC.wobble), 'cutMix', 'CV_INPUTS+1', 'midi');
wire('stabEnv', 'ENVELOPE_OUTPUT', 'cutMix', 'CH_INPUTS+2', 'cv');
wire('cutMix', 'MIX_OUTPUT', 'chordVcf', 'FREQ_INPUT', 'cv');
wire('seq', 'STEP_OUTPUTS+6', 'stabOr', 'IN_INPUTS+0', 'gate');
wire('gates', gate(48), 'stabOr', 'IN_INPUTS+1', 'midi');
wire('stabOr', 'OUT_OUTPUT', 'stabEnv', 'GATE_INPUT', 'gate');
wire('cc', cell(CC.decay), 'stabEnv', 'DECAY_INPUT', 'midi');
wire('cc', cell(CC.decay), 'stabEnv', 'RELEASE_INPUT', 'midi');
wire('chordVcf', 'LPF_OUTPUT', 'stabVca', 'IN_INPUT', 'audio');
wire('stabEnv', 'ENVELOPE_OUTPUT', 'stabVca', 'CV_INPUT', 'cv');
// Rim.
wire('noise', 'WHITE_OUTPUT', 'rimVcf', 'IN_INPUT', 'audio');
wire('gates', gate(38), 'rimEnv', 'GATE_INPUT', 'midi');
wire('rimVcf', 'LPF_OUTPUT', 'rimVca', 'IN_INPUT', 'audio');
wire('rimEnv', 'ENVELOPE_OUTPUT', 'rimVca', 'CV_INPUT', 'cv');
// Siren.
wire('gates', gate(51), 'sirenEnv', 'GATE_INPUT', 'midi');
wire('sirenLfo', 'TRI_OUTPUT', 'siren', 'FM_INPUT', 'cv');
wire('sirenEnv', 'ENVELOPE_OUTPUT', 'atten', 'IN2_INPUT', 'cv');
wire('atten', 'OUT2_OUTPUT', 'siren', 'PITCH_INPUT', 'cv');
wire('siren', 'TRI_OUTPUT', 'sirenVca', 'IN_INPUT', 'audio');
wire('sirenEnv', 'ENVELOPE_OUTPUT', 'sirenVca', 'CV_INPUT', 'cv');
// The echo send and the delay.
wire('stabVca', 'OUT_OUTPUT', 'send', 'CH_INPUTS+0', 'fx');
wire('cc', cell(CC.thro), 'send', 'CV_INPUTS+0', 'midi');
wire('sirenVca', 'OUT_OUTPUT', 'send', 'CH_INPUTS+1', 'fx');
wire('rimVca', 'OUT_OUTPUT', 'send', 'CH_INPUTS+2', 'fx');
wire('send', 'MIX_OUTPUT', 'delay', 'IN_INPUT', 'fx');
wire('cc', cell(CC.echo), 'delay', 'FEEDBACK_INPUT', 'midi');
// The mix, the reverb, the host's outputs.
[['kick', 'OUT_OUTPUT'], ['hatMix', 'MIX_OUTPUT'], ['stabVca', 'OUT_OUTPUT'], ['rimVca', 'OUT_OUTPUT'],
  ['sirenVca', 'OUT_OUTPUT'], ['delay', 'WET_OUTPUT']].forEach(([m, o], k) => wire(m, o, 'mix', `IN_INPUTS+${k}`, 'audio'));
wire('mix', 'OUT_OUTPUT', 'verb', 'LEFT_INPUT', 'audio');
wire('cc', cell(CC.space), 'verb', 'WET_CV_INPUT', 'midi');
wire('cc', cell(CC.space), 'verb', 'SIZE_CV_INPUT', 'midi');
wire('verb', 'LEFT_OUTPUT', 'out', 'LEFT', 'audio');
wire('verb', 'RIGHT_OUTPUT', 'out', 'RIGHT', 'audio');

const patch = { version: '2.4.1', zoom: 1.0, modules, cables };
const text = JSON.stringify(patch, null, 2) + '\n';

// ---------- checks ----------
const fail = [];
const say = s => console.log(s);

function structural() {
  const ids = new Set(modules.map(m => m.id));
  const seen = new Set();
  for (const c of cables) {
    if (!ids.has(c.outputModuleId) || !ids.has(c.inputModuleId)) fail.push(`cable ${c.id} names a missing module`);
    const k = c.inputModuleId + ':' + c.inputId;
    if (seen.has(k)) fail.push(`two cables into one input (${k})`);
    seen.add(k);
  }
  for (const row of [0, 1, 2, 3]) {
    const r = modules.filter(m => m.pos[1] === row).sort((a, b) => a.pos[0] - b.pos[0]);
    for (let i = 1; i < r.length; i++) {
      const prev = r[i - 1], hp = MODELS[prev.model].hp;
      if (prev.pos[0] + hp > r[i].pos[0]) fail.push(`row ${row}: ${prev.model} overlaps ${r[i].model}`);
    }
  }
  say(`structure: ${modules.length} modules, ${cables.length} cables, no input with two cables, no overlaps` +
    (fail.length ? ' (FAILED)' : ''));
}

const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
function parseEnums(src) {
  const out = {};
  const re = /enum\s+(ParamIds?|InputIds?|OutputIds?)\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(stripComments(src)))) {
    const kind = m[1].startsWith('Param') ? 'params' : m[1].startsWith('Input') ? 'inputs' : 'outputs';
    const list = [];
    const body = m[2].replace(/ENUMS\(\s*(\w+)\s*,\s*([\d\s*+]+)\)/g,
      (_, n, k) => `${n}*${k.split('+').reduce((a, t) => a + t.split('*').reduce((b, f) => b * +f, 1), 0)}`);
    for (let e of body.split(',')) {
      e = e.trim();
      if (!e || /^NUM_|_LEN$/.test(e)) continue;
      const star = e.match(/^(\w+)\*(\d+)$/);
      if (star) list.push([star[1], +star[2]]); else list.push(e.split('=')[0].trim());
    }
    out[kind] = list;
  }
  return out;
}
const CONST = { M_SQRT2: Math.SQRT2, FREQ_A0: 27.5, FREQ_B2: 123.471 }; // Kickall's own two, as in its source
const num = s => {
  const t = s.trim().replace(/^(\w+::)/, '').replace(/f$/, '');
  if (t in CONST) return CONST[t];
  return /^-?\d+\.?\d*(e-?\d+)?$/.test(t) ? +t : null;
};

function againstSource(root) {
  const P = path.join(root, 'plugins');
  const pluginsCpp = fs.readFileSync(path.join(P, 'plugins.cpp'), 'utf8');
  const jsonOf = {};
  let nParams = 0, nPorts = 0, nRanges = 0, nNoRange = 0;
  const unread = new Set();
  for (const [model, d] of Object.entries(MODELS)) {
    const dir = d.file.split('/')[0];
    const pj = jsonOf[dir] ||= JSON.parse(fs.readFileSync(path.join(P, dir, 'plugin.json'), 'utf8'));
    if (pj.slug !== d.plugin) fail.push(`${model}: plugin slug ${pj.slug}, table says ${d.plugin}`);
    if (pj.version !== d.version) fail.push(`${model}: plugin version ${pj.version}, table says ${d.version}`);
    if (!pj.modules.some(x => x.slug === model)) fail.push(`${model}: not in ${dir}/plugin.json`);
    const src = fs.readFileSync(path.join(P, d.file), 'utf8');
    const modelSrc = d.model ? fs.readFileSync(path.join(P, d.model), 'utf8') : src;
    if (!new RegExp(`createModel<[^>]*>\\(\\s*"${model}"\\s*\\)`).test(modelSrc)) fail.push(`${model}: no createModel("${model}")`);
    const used = modules.filter(m => m.model === model);
    const modelVar = (modelSrc.match(new RegExp(`Model\\s*\\*\\s*(\\w+)\\s*=\\s*createModel<[^>]*>\\(\\s*"${model}"`)) || [])[1];
    if (!modelVar || !new RegExp(`addModel\\(${modelVar}\\)`).test(pluginsCpp)) fail.push(`${model}: ${modelVar} not added in plugins.cpp`);
    if (d.noEnum) {
      if (model === 'HostAudio2' && !/configParam\(0, 0\.f, 2\.f, 1\.f, "Level"/.test(src)) fail.push('HostAudio2: its Level param changed');
      if (model === 'HostAudio2' && !/config\(numParams, numIO, numIO, 0\)/.test(src)) fail.push('HostAudio2: its ports changed');
      nParams += used.reduce((a, m) => a + m.params.length, 0);
      continue;
    }
    const en = parseEnums(src);
    for (const kind of ['params', 'inputs', 'outputs']) {
      const a = JSON.stringify(expand(d[kind])), b = JSON.stringify(expand(en[kind] || []));
      if (a !== b) fail.push(`${model} ${kind}: table ${a} but source ${b}`);
    }
    // Ranges from configParam(NAME, min, max, ...) where both are plain numbers.
    const ranges = {};
    const cre = /config(?:Param|Switch)(?:<\w+>)?\(\s*(\w+(?:::\w+)?)(?:\s*\+\s*(\d+))?\s*,\s*([^,]+),\s*([^,]+),/g;
    let c;
    const all = stripComments(src + (d.model ? modelSrc : ''));
    while ((c = cre.exec(all))) {
      const name = c[1].split('::').pop() + (c[2] ? '+' + c[2] : '');
      const lo = num(c[3]), hi = num(c[4]);
      if (lo !== null && hi !== null) ranges[name] = [lo, hi];
    }
    const names = expand(d.params);
    for (const m of used) {
      for (const p of m.params) {
        nParams++;
        const n = names[p.id], base = n.replace(/\+\d+$/, '');
        const rg = ranges[n] || ranges[base] || (/\+0$/.test(n) ? ranges[base + '+0'] : null);
        if (!rg) { nNoRange++; unread.add(`${model} ${n}`); continue; }
        nRanges++;
        if (p.value < Math.min(...rg) || p.value > Math.max(...rg)) fail.push(`${model} ${n} = ${p.value} outside ${rg}`);
      }
    }
  }
  for (const c of cables) {
    const a = modules.find(m => m.id === c.outputModuleId), b = modules.find(m => m.id === c.inputModuleId);
    if (c.outputId >= expand(MODELS[a.model].outputs).length) fail.push(`cable ${c.id}: ${a.model} output ${c.outputId}`);
    if (c.inputId >= expand(MODELS[b.model].inputs).length) fail.push(`cable ${c.id}: ${b.model} input ${c.inputId}`);
    nPorts += 2;
  }
  say(`source: ${Object.keys(MODELS).length} models (slug, version, createModel, addModel, enums) in ${root}`);
  say(`source: ${nParams} param values (${nRanges} within their configParam range; ${nNoRange} whose range is a named ` +
    `constant, checked by hand: ${[...unread].join(', ')}), ${nPorts} cable ends`);
}

const args = process.argv.slice(2);
const src = (args.includes('--src') ? args[args.indexOf('--src') + 1] : null) || process.env.CARDINAL_SRC;
structural();
if (args.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== text) fail.push(`${path.relative(process.cwd(), OUT)} is not current: run node tools/output/cardinal/make.mjs`);
  else say('dub-techno.vcv is current');
  if (src) againstSource(src); else say('source: not checked (give --src <Cardinal clone> or CARDINAL_SRC)');
} else {
  if (src) againstSource(src);
  if (!fail.length) { fs.writeFileSync(OUT, text); say(`wrote ${path.relative(process.cwd(), OUT)}`); }
}
if (fail.length) { for (const f of fail) console.error('FAIL ' + f); process.exit(1); }

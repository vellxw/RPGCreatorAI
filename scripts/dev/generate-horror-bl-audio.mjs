#!/usr/bin/env node
/**
 * Deterministic, dependency-free procedural audio source for the Horror BL
 * template. The source is intentionally small and self-contained: Node's
 * standard library is the only runtime requirement and every output is a
 * PCM16 mono WAV that can be regenerated offline.
 *
 * Usage:
 *   node scripts/dev/generate-horror-bl-audio.mjs
 *   node scripts/dev/generate-horror-bl-audio.mjs --verify
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const SAMPLE_RATE = 22050;
const ROOT = resolve(import.meta.dirname, '../..');
const OUTPUT_ROOT = 'templates/horror-bl/assets/audio/horror-bl';

/**
 * A seed is part of an asset's source provenance. Do not change it in place:
 * changing a recipe intentionally creates new bytes and therefore new hashes.
 */
const CUES = [
  { id: 'audio.ambience.facility-lobby', file: 'ambience-facility-lobby.wav', durationMs: 12000, seed: 0x15a04d11, sha256: '9e523150c7915b15255dc9ffaa8de9823d697e4f37b8c4bc1c39f4476b2407b2', byteSize: 529244, recipe: 'Low ventilation drone, distant fluorescent pulse, and sparse glass resonance.' },
  { id: 'audio.ambience.archive-sublevel', file: 'ambience-archive-sublevel.wav', durationMs: 12000, seed: 0x2c6f53a7, sha256: 'a4409ec0b7a3043e8c587b95310f5ef1a83300cb356d8b73961a3ad8bf9590ff', byteSize: 529244, recipe: 'Paper-like filtered noise, archive HVAC drone, and slow unstable harmonics.' },
  { id: 'audio.ambience.service-corridor', file: 'ambience-service-corridor.wav', durationMs: 12000, seed: 0x39b21c4e, sha256: 'a838d85ee789e9b3eaae9f1d93274fc7b93b5c5bdaeeab5c080e1a32821857e3', byteSize: 529244, recipe: 'Narrow metallic corridor hum with periodic alarm-adjacent resonances.' },
  { id: 'audio.stinger.ninth-witness', file: 'ninth-witness-stinger.wav', durationMs: 1800, seed: 0x4f77de92, sha256: '98b615ae2e41f82f66b6629db2bfc612991da7b90c9170085b5e4e7042347ac6', byteSize: 79424, recipe: 'Rising clustered tone, granular breath, and abrupt memory-shear hit.' },
  { id: 'audio.ui.confirm', file: 'ui-confirm.wav', durationMs: 180, seed: 0x51a9cc37, sha256: '4b397c7011b04a76b88f3c82fb584f8726d343170e3069ea86bf18c8f78c0ef8', byteSize: 7982, recipe: 'Short ascending two-tone interface confirmation.' },
  { id: 'audio.ui.cancel', file: 'ui-cancel.wav', durationMs: 210, seed: 0x68e342a5, sha256: 'e6349368de9d985deb30bfe2c0b8002aff269ce785b47dcd410036c32ca24863', byteSize: 9306, recipe: 'Short descending muted interface cancellation.' },
  { id: 'audio.footstep.concrete', file: 'footstep-concrete.wav', durationMs: 240, seed: 0x7b0d91f4, sha256: '2d8100369c8e779d94dca4ac3e74d952cba4ff771a201b766603c00091028c31', byteSize: 10628, recipe: 'Dry concrete heel-toe impact with a restrained room reflection.' },
  { id: 'audio.ending.memory-release', file: 'ending-memory-release.wav', durationMs: 4200, seed: 0x8ea25bb9, sha256: '380d3b735a573c5554ee60d8939ea09e45c4e2bc7d874c49a65b1a4a493df69a', byteSize: 185264, recipe: 'Quiet resolving chord and fading ventilation noise for a chapter ending.' },
];

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0x1_0000_0000) * 2 - 1;
  };
}

function envelope(time, attack, release, duration) {
  const inGain = Math.min(1, time / attack);
  const outGain = Math.min(1, Math.max(0, duration - time) / release);
  return Math.min(inGain, outGain);
}

function ambience(style, duration, random) {
  const count = Math.round(duration * SAMPLE_RATE);
  const out = new Float64Array(count);
  const presets = {
    lobby: { root: 43.65, bright: 879.2, flutter: 0.37, noise: 0.032 },
    archive: { root: 36.71, bright: 622.25, flutter: 0.21, noise: 0.052 },
    corridor: { root: 49.0, bright: 739.99, flutter: 0.63, noise: 0.042 },
  };
  const p = presets[style];
  let filteredNoise = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    filteredNoise = filteredNoise * 0.992 + random() * 0.008;
    const bed = Math.sin(Math.PI * 2 * p.root * t) * 0.105
      + Math.sin(Math.PI * 2 * p.root * 1.503 * t + 0.7) * 0.037
      + Math.sin(Math.PI * 2 * (p.root * 0.499 + Math.sin(t * 0.13) * 0.16) * t) * 0.042;
    const fluorescent = Math.max(0, Math.sin(Math.PI * 2 * p.flutter * t)) ** 11
      * Math.sin(Math.PI * 2 * p.bright * t) * 0.006;
    const movingAir = Math.sin(Math.PI * 2 * 0.071 * t + 1.2) * 0.012 + filteredNoise * p.noise;
    const fade = envelope(t, 0.9, 1.25, duration);
    out[i] = (bed + fluorescent + movingAir) * fade;
  }
  return out;
}

function ninthWitness(duration, random) {
  const count = Math.round(duration * SAMPLE_RATE);
  const out = new Float64Array(count);
  let grit = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    const sweep = 112 + 920 * Math.min(1, t / 1.28) ** 2;
    grit = grit * 0.91 + random() * 0.09;
    const cluster = Math.sin(Math.PI * 2 * sweep * t)
      + Math.sin(Math.PI * 2 * sweep * 1.019 * t + 0.9)
      + Math.sin(Math.PI * 2 * sweep * 0.496 * t + 2.1);
    const impact = t > 1.28 ? Math.sin(Math.PI * 2 * 63 * (t - 1.28)) * Math.exp(-(t - 1.28) * 7) * 1.3 : 0;
    const gain = envelope(t, 0.025, 0.42, duration) * (0.035 + 0.105 * Math.min(1, t / 0.8));
    out[i] = (cluster * gain + grit * 0.038 + impact) * (t < 1.55 ? 1 : Math.exp(-(t - 1.55) * 2.1));
  }
  return out;
}

function uiConfirm(duration) {
  const count = Math.round(duration * SAMPLE_RATE);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    const note = t < 0.075 ? 587.33 : 880;
    out[i] = (Math.sin(Math.PI * 2 * note * t) * 0.14
      + Math.sin(Math.PI * 2 * note * 2 * t) * 0.025) * envelope(t, 0.004, 0.075, duration);
  }
  return out;
}

function uiCancel(duration) {
  const count = Math.round(duration * SAMPLE_RATE);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    const note = t < 0.08 ? 440 : 293.66;
    out[i] = (Math.sin(Math.PI * 2 * note * t) * 0.105
      + Math.sin(Math.PI * 2 * note * 0.5 * t) * 0.028) * envelope(t, 0.004, 0.095, duration);
  }
  return out;
}

function footstep(duration, random) {
  const count = Math.round(duration * SAMPLE_RATE);
  const out = new Float64Array(count);
  let dust = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    dust = dust * 0.73 + random() * 0.27;
    const heel = Math.sin(Math.PI * 2 * 83 * t) * Math.exp(-t * 31) * 0.34;
    const toeTime = Math.max(0, t - 0.075);
    const toe = Math.sin(Math.PI * 2 * 128 * toeTime) * Math.exp(-toeTime * 42) * 0.15;
    out[i] = (dust * Math.exp(-t * 22) * 0.18 + heel + toe) * envelope(t, 0.002, 0.08, duration);
  }
  return out;
}

function ending(duration, random) {
  const count = Math.round(duration * SAMPLE_RATE);
  const out = new Float64Array(count);
  let air = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    air = air * 0.993 + random() * 0.007;
    const chord = Math.sin(Math.PI * 2 * 220 * t) * 0.075
      + Math.sin(Math.PI * 2 * 277.18 * t + 0.45) * 0.062
      + Math.sin(Math.PI * 2 * 329.63 * t + 1.05) * 0.052
      + Math.sin(Math.PI * 2 * 440 * t + 1.7) * 0.025;
    out[i] = (chord + air * 0.028) * envelope(t, 0.65, 1.5, duration) * Math.exp(-t * 0.18);
  }
  return out;
}

function samplesFor(cue) {
  const duration = cue.durationMs / 1000;
  const random = makeRandom(cue.seed);
  if (cue.id.includes('facility-lobby')) return ambience('lobby', duration, random);
  if (cue.id.includes('archive-sublevel')) return ambience('archive', duration, random);
  if (cue.id.includes('service-corridor')) return ambience('corridor', duration, random);
  if (cue.id.includes('ninth-witness')) return ninthWitness(duration, random);
  if (cue.id.includes('ui.confirm')) return uiConfirm(duration);
  if (cue.id.includes('ui.cancel')) return uiCancel(duration);
  if (cue.id.includes('footstep')) return footstep(duration, random);
  return ending(duration, random);
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return wav;
}

const verifyOnly = process.argv.includes('--verify');
let failures = 0;
for (const cue of CUES) {
  const relativePath = `${OUTPUT_ROOT}/${cue.file}`;
  const targetPath = resolve(ROOT, relativePath);
  const output = wavBuffer(samplesFor(cue));
  if (verifyOnly) {
    const actual = existsSync(targetPath) ? readFileSync(targetPath) : null;
    const sha256 = createHash('sha256').update(output).digest('hex');
    const matches = (actual?.equals(output) ?? false) && sha256 === cue.sha256 && output.length === cue.byteSize;
    console.log(`${matches ? 'OK' : 'MISMATCH'} ${relativePath} ${sha256} ${output.length}`);
    if (!matches) failures += 1;
  } else {
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, output);
    console.log(`WROTE ${relativePath} ${createHash('sha256').update(output).digest('hex')} ${output.length}`);
  }
}
if (failures > 0) process.exitCode = 1;

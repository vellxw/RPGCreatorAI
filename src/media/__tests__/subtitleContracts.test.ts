import { describe, expect, it } from 'vitest';
import { isSubtitleTrackV1, validateSubtitleTrack, type SubtitleTrackV1 } from '../subtitleContracts';

describe('subtitle contracts', () => {
  const track: SubtitleTrackV1 = {
    schemaVersion: 1,
    language: 'es-AR',
    cues: [
      { id: 'line.1', startMs: 0, endMs: 1_500, text: 'No mires atrás.', speaker: 'Damián' },
      { id: 'sound.1', startMs: 2_000, endMs: 3_000, text: '[metal crujiendo]', kind: 'sound', forced: true },
    ],
  };

  it('accepts sorted speech and non-speech cues', () => {
    expect(validateSubtitleTrack(track)).toMatchObject({
      valid: true,
      summary: { cues: 2, errors: 0, warnings: 0, durationMs: 3_000 },
    });
    expect(isSubtitleTrackV1(track)).toBe(true);
  });

  it('rejects duplicate ids, invalid timing, and unsorted cues', () => {
    const report = validateSubtitleTrack({
      ...track,
      cues: [
        track.cues[1],
        { ...track.cues[0], id: 'sound.1', startMs: 1_000, endMs: 500 },
      ],
    });
    expect(report.valid).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'duplicate-id',
      'invalid-timing',
    ]));
  });

  it('warns when cues overlap or cannot be comfortably read', () => {
    const report = validateSubtitleTrack({
      ...track,
      cues: [
        track.cues[0],
        { id: 'line.2', startMs: 1_000, endMs: 1_200, text: 'Corré.' },
      ],
    });
    expect(report.valid).toBe(true);
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'overlapping-cues',
      'unreadable-duration',
    ]));
  });

  it('rejects untrusted non-object input', () => {
    expect(validateSubtitleTrack(null)).toMatchObject({ valid: false, summary: { cues: 0 } });
  });
});

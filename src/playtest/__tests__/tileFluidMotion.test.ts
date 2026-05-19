import { describe, expect, it } from 'vitest';
import {
  advanceTileFluidMotion,
  beginTileFluidStep,
  createTileFluidMotion,
  directionFromKey,
} from '../tileFluidMotion';

describe('tileFluidMotion', () => {
  it('maps WASD and arrow keys to movement directions', () => {
    expect(directionFromKey('ArrowUp')).toBe('up');
    expect(directionFromKey('w')).toBe('up');
    expect(directionFromKey('W')).toBe('up');
    expect(directionFromKey('ArrowLeft')).toBe('left');
    expect(directionFromKey('a')).toBe('left');
    expect(directionFromKey('s')).toBe('down');
    expect(directionFromKey('d')).toBe('right');
    expect(directionFromKey('Escape')).toBeNull();
  });

  it('interpolates a held tile step without changing logical tile until completion', () => {
    const motion = createTileFluidMotion({ tileX: 2, tileY: 3, direction: 'down', tileSize: 32 });
    const started = beginTileFluidStep(motion, 'right', {
      width: 5,
      height: 5,
      isBlocked: () => false,
    });

    expect(started).toBe(true);
    expect(motion.tileX).toBe(2);
    expect(motion.visualX).toBe(64);
    expect(motion.targetTileX).toBe(3);

    advanceTileFluidMotion(motion, 0.125, 4);
    expect(motion.tileX).toBe(2);
    expect(motion.visualX).toBe(80);
    expect(motion.moving).toBe(true);

    const completed = advanceTileFluidMotion(motion, 0.125, 4);
    expect(completed).toEqual({ tileX: 3, tileY: 3, direction: 'right' });
    expect(motion.tileX).toBe(3);
    expect(motion.visualX).toBe(96);
    expect(motion.moving).toBe(false);
  });

  it('turns toward blocked movement but does not start interpolation', () => {
    const motion = createTileFluidMotion({ tileX: 2, tileY: 3, direction: 'down', tileSize: 32 });
    const started = beginTileFluidStep(motion, 'up', {
      width: 5,
      height: 5,
      isBlocked: () => true,
    });

    expect(started).toBe(false);
    expect(motion.direction).toBe('up');
    expect(motion.tileY).toBe(3);
    expect(motion.visualY).toBe(96);
    expect(motion.moving).toBe(false);
  });
});

import type { Direction } from '../types/project';

export interface TileFluidMotion {
  tileX: number;
  tileY: number;
  direction: Direction;
  tileSize: number;
  visualX: number;
  visualY: number;
  startX: number;
  startY: number;
  targetTileX: number;
  targetTileY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  duration: number;
  moving: boolean;
}

export interface TileFluidSeed {
  tileX: number;
  tileY: number;
  direction: Direction;
  tileSize: number;
}

export interface TileFluidBounds {
  width: number;
  height: number;
  isBlocked(x: number, y: number): boolean;
}

export interface CompletedTileStep {
  tileX: number;
  tileY: number;
  direction: Direction;
}

const DELTAS: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function directionFromKey(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

export function createTileFluidMotion(seed: TileFluidSeed): TileFluidMotion {
  const visualX = seed.tileX * seed.tileSize;
  const visualY = seed.tileY * seed.tileSize;
  return {
    tileX: seed.tileX,
    tileY: seed.tileY,
    direction: seed.direction,
    tileSize: seed.tileSize,
    visualX,
    visualY,
    startX: visualX,
    startY: visualY,
    targetTileX: seed.tileX,
    targetTileY: seed.tileY,
    targetX: visualX,
    targetY: visualY,
    elapsed: 0,
    duration: 0,
    moving: false,
  };
}

export function beginTileFluidStep(
  motion: TileFluidMotion,
  direction: Direction,
  bounds: TileFluidBounds,
  tilesPerSecond = 4,
): boolean {
  if (motion.moving) return false;
  motion.direction = direction;

  const delta = DELTAS[direction];
  const targetTileX = motion.tileX + delta.dx;
  const targetTileY = motion.tileY + delta.dy;
  if (
    targetTileX < 0 ||
    targetTileY < 0 ||
    targetTileX >= bounds.width ||
    targetTileY >= bounds.height ||
    bounds.isBlocked(targetTileX, targetTileY)
  ) {
    return false;
  }

  motion.startX = motion.visualX;
  motion.startY = motion.visualY;
  motion.targetTileX = targetTileX;
  motion.targetTileY = targetTileY;
  motion.targetX = targetTileX * motion.tileSize;
  motion.targetY = targetTileY * motion.tileSize;
  motion.elapsed = 0;
  motion.duration = tilesPerSecond > 0 ? 1 / tilesPerSecond : 0;
  motion.moving = motion.duration > 0;
  if (!motion.moving) {
    motion.tileX = targetTileX;
    motion.tileY = targetTileY;
    motion.visualX = motion.targetX;
    motion.visualY = motion.targetY;
  }
  return true;
}

export function advanceTileFluidMotion(
  motion: TileFluidMotion,
  dt: number,
  tilesPerSecond = 4,
): CompletedTileStep | null {
  if (!motion.moving) return null;
  const duration = motion.duration > 0 ? motion.duration : 1 / tilesPerSecond;
  motion.elapsed += Math.max(0, dt);
  const t = Math.min(1, motion.elapsed / duration);
  motion.visualX = motion.startX + (motion.targetX - motion.startX) * t;
  motion.visualY = motion.startY + (motion.targetY - motion.startY) * t;

  if (t < 1) return null;
  motion.tileX = motion.targetTileX;
  motion.tileY = motion.targetTileY;
  motion.visualX = motion.targetX;
  motion.visualY = motion.targetY;
  motion.moving = false;
  return { tileX: motion.tileX, tileY: motion.tileY, direction: motion.direction };
}

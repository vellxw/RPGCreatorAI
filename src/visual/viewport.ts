export interface PixelSize {
  width: number;
  height: number;
}

export interface VisibleTileSpan {
  columns: number;
  rows: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, PixelSize {}

export function getVisibleTileSpan(viewport: PixelSize, tileSize: number): VisibleTileSpan {
  const safeTileSize = tileSize > 0 ? tileSize : 1;
  return {
    columns: Math.ceil(viewport.width / safeTileSize),
    rows: Math.ceil(viewport.height / safeTileSize),
  };
}

export function computeFitScale(content: PixelSize, available: PixelSize): number {
  if (
    content.width <= 0 ||
    content.height <= 0 ||
    available.width <= 0 ||
    available.height <= 0
  ) {
    return 1;
  }

  return Math.min(available.width / content.width, available.height / content.height);
}

export function computeCameraFrame({
  viewport,
  map,
  focus,
  cameraMode,
}: {
  viewport: PixelSize;
  map: PixelSize;
  focus: Point;
  cameraMode: 'follow-player' | 'fixed-room';
}): Rect {
  if (cameraMode === 'fixed-room') {
    return {
      x: Math.floor((map.width - viewport.width) / 2),
      y: Math.floor((map.height - viewport.height) / 2),
      width: viewport.width,
      height: viewport.height,
    };
  }

  const clampAxis = (desired: number, world: number, visible: number) => {
    if (world <= visible) return Math.floor((world - visible) / 2);
    return Math.max(0, Math.min(desired, world - visible));
  };

  return {
    x: clampAxis(Math.floor(focus.x - viewport.width / 2), map.width, viewport.width),
    y: clampAxis(Math.floor(focus.y - viewport.height / 2), map.height, viewport.height),
    width: viewport.width,
    height: viewport.height,
  };
}

export function computePreviewSceneBounds({
  map,
  frame,
}: {
  map: PixelSize;
  frame: Rect;
}): Rect {
  const minX = Math.min(0, frame.x);
  const minY = Math.min(0, frame.y);
  const maxX = Math.max(map.width, frame.x + frame.width);
  const maxY = Math.max(map.height, frame.y + frame.height);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

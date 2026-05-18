export interface PixelSize {
  width: number;
  height: number;
}

export interface VisibleTileSpan {
  columns: number;
  rows: number;
}

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

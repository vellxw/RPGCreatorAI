import { useEffect, useState } from 'react';
import { animationSheetAssets } from '../../assets/generated/assetCatalog';
import type { AnimationClipData, AnimationSetDisplayData } from '../../types/project';

interface AnimationPreviewProps {
  clip: AnimationClipData | null;
  display?: AnimationSetDisplayData;
  assetPreviewUrls?: Record<string, string>;
}

export function AnimationPreview({ clip, display, assetPreviewUrls = {} }: AnimationPreviewProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!clip || clip.frameCount <= 1 || clip.fps <= 0) {
      setFrame(0);
      return;
    }
    const interval = window.setInterval(() => {
      setFrame(current => (current + 1) % Math.max(1, clip.frameCount));
    }, 1000 / clip.fps);
    return () => window.clearInterval(interval);
  }, [clip?.asset, clip?.fps, clip?.frameCount]);

  if (!clip) {
    return (
      <div className="flex h-40 items-center justify-center border border-dashed border-gray-200 bg-white text-[12px] text-gray-400">
        Select a clip to preview.
      </div>
    );
  }

  const href = animationSheetAssets[clip.asset as keyof typeof animationSheetAssets] ?? assetPreviewUrls[clip.asset];
  const frameWidth = Math.max(1, clip.frameSize.width);
  const frameHeight = Math.max(1, clip.frameSize.height);
  const frameCount = Math.max(1, clip.frameCount);
  const clampedFrame = Math.min(frame, frameCount - 1);
  const displayHeight = Math.max(96, Math.round((display?.heightTiles ?? 1.5) * 64));
  const displayWidth = Math.max(96, Math.round((display?.widthTiles ?? 1) * 64));

  return (
    <div className="space-y-2">
      <div className="inline-flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3">
        {href ? (
          <svg
            aria-label="Animation preview"
            viewBox={`0 0 ${frameWidth} ${frameHeight}`}
            width={displayWidth}
            height={displayHeight}
            data-frame={clampedFrame}
            className="bg-gray-100"
            style={{ imageRendering: 'pixelated' }}
          >
            <image
              href={href}
              x={-clampedFrame * frameWidth}
              y="0"
              width={frameWidth * frameCount}
              height={frameHeight}
              preserveAspectRatio="xMinYMin meet"
            />
            <line
              x1={clip.anchor.x}
              y1="0"
              x2={clip.anchor.x}
              y2={frameHeight}
              stroke="rgba(79, 70, 229, 0.65)"
              strokeWidth="1"
            />
            <line
              x1="0"
              y1={clip.anchor.y + (display?.yOffsetPx ?? 0)}
              x2={frameWidth}
              y2={clip.anchor.y + (display?.yOffsetPx ?? 0)}
              stroke="rgba(79, 70, 229, 0.65)"
              strokeWidth="1"
            />
          </svg>
        ) : (
          <div className="flex h-32 w-48 items-center justify-center bg-gray-100 text-[12px] text-red-500">
            Missing asset
          </div>
        )}
        <p className="text-[11px] text-gray-500">
          {clip.action}/{clip.direction} · {frameWidth}x{frameHeight} · {frameCount} frames @ {clip.fps} fps
        </p>
      </div>
    </div>
  );
}

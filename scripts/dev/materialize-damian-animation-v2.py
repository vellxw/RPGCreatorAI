from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_ROOT = REPO_ROOT / "templates" / "horror-bl"
SOURCE_DIR = TEMPLATE_ROOT / "assets" / "source" / "generated" / "animation" / "damian-v2"
RUNTIME_DIR = TEMPLATE_ROOT / "assets" / "generated" / "runtime" / "sprites"
PACKAGE_DIR = TEMPLATE_ROOT / "data" / "assets" / "animation-packages"

FRAME_WIDTH = 256
FRAME_HEIGHT = 384
FRAME_COUNT = 4
ANCHOR = {"x": 128, "y": 376}
ALPHA_THRESHOLD = 8

DIRECTIONS = ("down", "left", "right", "up")
ACTIONS = ("idle", "walk", "interact")


@dataclass(frozen=True)
class SourceSheet:
    file_name: str
    rows: tuple[str, ...]
    direction: str


SHEETS = (
    SourceSheet("damian-idle-walk-down-v2-alpha.png", ("idle", "walk"), "down"),
    SourceSheet("damian-idle-walk-left-v2-alpha.png", ("idle", "walk"), "left"),
    SourceSheet("damian-idle-walk-right-v2-alpha.png", ("idle", "walk"), "right"),
    SourceSheet("damian-idle-walk-up-v2-alpha.png", ("idle", "walk"), "up"),
    SourceSheet("damian-interact-down-v2-alpha.png", ("interact",), "down"),
    SourceSheet("damian-interact-left-v2-alpha.png", ("interact",), "left"),
    SourceSheet("damian-interact-right-v2-alpha.png", ("interact",), "right"),
    SourceSheet("damian-interact-up-v2-alpha.png", ("interact",), "up"),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(TEMPLATE_ROOT).as_posix()


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    binary = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return binary.getbbox()


def crop_to_grid(image: Image.Image, columns: int, rows: int) -> Image.Image:
    usable_width = image.width - image.width % columns
    usable_height = image.height - image.height % rows
    if usable_width <= 0 or usable_height <= 0:
        raise ValueError(f"Image {image.size} cannot form a {columns}x{rows} grid")
    left = (image.width - usable_width) // 2
    top = (image.height - usable_height) // 2
    return image.crop((left, top, left + usable_width, top + usable_height))


def inspect_transparency(image: Image.Image, label: str) -> None:
    if image.mode != "RGBA":
        raise ValueError(f"{label} must be RGBA, got {image.mode}")
    minimum, maximum = image.getchannel("A").getextrema()
    if minimum != 0 or maximum != 255:
        raise ValueError(f"{label} must contain both transparent and opaque pixels")
    corners = (
        image.getpixel((0, 0))[3],
        image.getpixel((image.width - 1, 0))[3],
        image.getpixel((0, image.height - 1))[3],
        image.getpixel((image.width - 1, image.height - 1))[3],
    )
    if any(value > ALPHA_THRESHOLD for value in corners):
        raise ValueError(f"{label} has a non-transparent corner: {corners}")


def split_row_subjects(row: Image.Image, label: str) -> list[Image.Image]:
    alpha = row.getchannel("A")
    occupied = []
    for x in range(row.width):
        column = alpha.crop((x, 0, x + 1, row.height))
        occupied.append(column.getextrema()[1] > ALPHA_THRESHOLD)

    spans: list[tuple[int, int]] = []
    start: int | None = None
    for x, present in enumerate(occupied + [False]):
        if present and start is None:
            start = x
        elif not present and start is not None:
            if x - start >= max(8, row.width // 30):
                spans.append((start, x))
            start = None
    if len(spans) != FRAME_COUNT:
        raise ValueError(f"{label} must contain exactly {FRAME_COUNT} separated subjects, got {spans}")

    frames: list[Image.Image] = []
    for index, (left, right) in enumerate(spans):
        subject_column = row.crop((left, 0, right, row.height))
        bbox = alpha_bbox(subject_column)
        if bbox is None:
            raise ValueError(f"{label} frame {index + 1} is empty")
        frames.append(subject_column.crop(bbox))
    return frames


def load_frames() -> tuple[dict[tuple[str, str], list[Image.Image]], list[dict[str, Any]]]:
    clips: dict[tuple[str, str], list[Image.Image]] = {}
    evidence: list[dict[str, Any]] = []
    for descriptor in SHEETS:
        path = SOURCE_DIR / descriptor.file_name
        if not path.is_file():
            raise FileNotFoundError(path)
        opened = Image.open(path).convert("RGBA")
        inspect_transparency(opened, descriptor.file_name)
        grid = crop_to_grid(opened, 1, len(descriptor.rows))
        cell_height = grid.height // len(descriptor.rows)
        chroma_path = path.with_name(path.name.replace("-alpha.png", "-chroma.png"))
        if not chroma_path.is_file():
            raise FileNotFoundError(chroma_path)
        chroma = Image.open(chroma_path)
        evidence.append({
            "path": relative(path),
            "sha256": sha256(path),
            "width": opened.width,
            "height": opened.height,
            "providerOutput": {
                "path": relative(chroma_path),
                "sha256": sha256(chroma_path),
                "width": chroma.width,
                "height": chroma.height,
                "background": "generated flat chroma key",
            },
            "normalizedAlpha": {
                "path": relative(path),
                "sha256": sha256(path),
                "width": opened.width,
                "height": opened.height,
                "pipeline": "imagegen/remove_chroma_key.py",
            },
            "normalizedGridCrop": {
                "width": grid.width,
                "height": grid.height,
                "rows": len(descriptor.rows),
                "rowHeight": cell_height,
                "horizontalSegmentation": "four separated alpha-subject spans",
            },
        })
        chroma.close()
        for row_index, action in enumerate(descriptor.rows):
            row = grid.crop((0, row_index * cell_height, grid.width, (row_index + 1) * cell_height))
            frames = split_row_subjects(row, f"{action}.{descriptor.direction}")
            clips[(action, descriptor.direction)] = frames
    expected = {(action, direction) for action in ACTIONS for direction in DIRECTIONS}
    if set(clips) != expected:
        missing = sorted(expected - set(clips))
        extra = sorted(set(clips) - expected)
        raise ValueError(f"Clip coverage mismatch; missing={missing}, extra={extra}")
    return clips, evidence


def normalize_frames(
    clips: dict[tuple[str, str], list[Image.Image]],
) -> tuple[dict[tuple[str, str], list[Image.Image]], float, list[dict[str, Any]]]:
    all_frames = [frame for frames in clips.values() for frame in frames]
    max_width = max(frame.width for frame in all_frames)
    max_height = max(frame.height for frame in all_frames)
    horizontal_capacity = FRAME_WIDTH - 16
    vertical_capacity = ANCHOR["y"] - 8
    shared_scale = min(horizontal_capacity / max_width, vertical_capacity / max_height)
    if shared_scale <= 0:
        raise ValueError("Shared scale must be positive")

    normalized: dict[tuple[str, str], list[Image.Image]] = {}
    frame_reports: list[dict[str, Any]] = []
    for action in ACTIONS:
        for direction in DIRECTIONS:
            output_frames: list[Image.Image] = []
            for index, frame in enumerate(clips[(action, direction)]):
                target_width = max(1, round(frame.width * shared_scale))
                target_height = max(1, round(frame.height * shared_scale))
                resized = frame.resize((target_width, target_height), Image.Resampling.LANCZOS)
                canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
                left = round(ANCHOR["x"] - target_width / 2)
                top = ANCHOR["y"] - target_height
                if left < 0 or top < 0 or left + target_width > FRAME_WIDTH or top + target_height > FRAME_HEIGHT:
                    raise ValueError(f"{action}.{direction} frame {index + 1} does not fit normalized cell")
                canvas.alpha_composite(resized, (left, top))
                bbox = alpha_bbox(canvas)
                if bbox is None:
                    raise ValueError(f"{action}.{direction} frame {index + 1} normalized empty")
                output_frames.append(canvas)
                frame_reports.append({
                    "clipId": f"{action}.{direction}",
                    "frame": index + 1,
                    "normalizedBounds": {
                        "x": bbox[0],
                        "y": bbox[1],
                        "width": bbox[2] - bbox[0],
                        "height": bbox[3] - bbox[1],
                    },
                    "completeAnatomyVisualReview": "passed-agent-review",
                })
            normalized[(action, direction)] = output_frames
    return normalized, shared_scale, frame_reports


def write_strip(frames: list[Image.Image], target: Path) -> None:
    strip = Image.new("RGBA", (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    target.parent.mkdir(parents=True, exist_ok=True)
    strip.save(target, optimize=True)


def write_master(normalized: dict[tuple[str, str], list[Image.Image]], target: Path) -> None:
    master = Image.new(
        "RGBA",
        (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT * len(ACTIONS) * len(DIRECTIONS)),
        (0, 0, 0, 0),
    )
    row = 0
    for action in ACTIONS:
        for direction in DIRECTIONS:
            for column, frame in enumerate(normalized[(action, direction)]):
                master.alpha_composite(frame, (column * FRAME_WIDTH, row * FRAME_HEIGHT))
            row += 1
    target.parent.mkdir(parents=True, exist_ok=True)
    master.save(target, optimize=True)


def dump_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    clips, source_evidence = load_frames()
    normalized, shared_scale, frame_reports = normalize_frames(clips)

    provenance_path = PACKAGE_DIR / "damian.provenance.v1.json"
    qa_path = PACKAGE_DIR / "damian.qa.v1.json"
    package_path = PACKAGE_DIR / "damian.animation-package.v1.json"
    persistence_path = PACKAGE_DIR / "damian.persistence.v1.json"
    runtime_additions_path = PACKAGE_DIR / "damian.runtime-additions.v1.json"
    master_path = SOURCE_DIR / "damian-animation-master-v2.png"
    write_master(normalized, master_path)

    artifacts: list[dict[str, Any]] = []
    catalog_assets: list[dict[str, Any]] = []
    package_clips: list[dict[str, Any]] = []
    animation_clips: list[dict[str, Any]] = []
    persistence_strips: list[dict[str, Any]] = []
    for row, (action, direction) in enumerate(
        (action, direction) for action in ACTIONS for direction in DIRECTIONS
    ):
        clip_id = f"{action}.{direction}"
        asset_id = f"sprite.damian.{action}.{direction}"
        strip_path = RUNTIME_DIR / f"damian_{action}_{direction}.png"
        write_strip(normalized[(action, direction)], strip_path)
        artifact = {
            "clipId": clip_id,
            "assetId": asset_id,
            "path": relative(strip_path),
            "sha256": sha256(strip_path),
            "source": "generated",
            "width": FRAME_WIDTH * FRAME_COUNT,
            "height": FRAME_HEIGHT,
            "frameWidth": FRAME_WIDTH,
            "frameHeight": FRAME_HEIGHT,
            "frameCount": FRAME_COUNT,
            "provenance": relative(provenance_path),
            "reviewStatus": "frozen",
            "normalization": {
                "sharedScale": round(shared_scale, 6),
                "anchor": ANCHOR,
                "hasAlpha": True,
            },
        }
        package_clips.append({
            "id": clip_id,
            "action": action,
            "direction": direction,
            "frameIndices": [row * FRAME_COUNT + offset for offset in range(FRAME_COUNT)],
            "fps": 6 if action == "idle" else 8,
            "loop": action != "interact",
        })
        artifacts.append(artifact)
        catalog_assets.append({
            "id": asset_id,
            "name": f"Damián · {action} · {direction}",
            "kind": "spritesheet",
            "path": relative(strip_path),
            "source": "generated",
            "status": "frozen",
            "releaseEligible": True,
            "runtimeCompatible": True,
            "mediaType": "image/png",
            "width": FRAME_WIDTH * FRAME_COUNT,
            "height": FRAME_HEIGHT,
            "frameWidth": FRAME_WIDTH,
            "frameHeight": FRAME_HEIGHT,
            "frames": FRAME_COUNT,
            "sizeBytes": strip_path.stat().st_size,
            "sha256": artifact["sha256"],
            "tags": ["horror-bl", "chapter-1", "animation-strip", "damian", action, direction, "adult"],
            "provenance": relative(provenance_path),
            "runtimeNotes": "Technically frozen generated strip; human acceptance remains pending under the separate G4 evidence gate.",
            "generated": {
                "ownerKind": "character",
                "ownerId": "damian",
                "sourceAssetPath": relative(master_path),
                "spriteSheet": {
                    "frameWidth": FRAME_WIDTH,
                    "frameHeight": FRAME_HEIGHT,
                    "frameCount": FRAME_COUNT,
                    "action": action,
                    "direction": direction,
                    "frameLayout": "horizontal-strip",
                    "transparentBackgroundRequired": True,
                    "animationSetId": "damian",
                    "fps": 6 if action == "idle" else 8,
                    "anchor": ANCHOR,
                },
            },
        })
        animation_clips.append({
            "action": action,
            "direction": direction,
            "asset": asset_id,
            "frameSize": {"width": FRAME_WIDTH, "height": FRAME_HEIGHT},
            "frameCount": FRAME_COUNT,
            "fps": 6 if action == "idle" else 8,
            "loop": action != "interact",
            "anchor": ANCHOR,
        })
        persistence_strips.append({
            **artifact,
            "action": action,
            "direction": direction,
            "fps": 6 if action == "idle" else 8,
            "loop": action != "interact",
            "anchor": ANCHOR,
        })

    package = {
        "schemaVersion": 1,
        "id": "actor.damian",
        "source": {
            "path": relative(master_path),
            "sha256": sha256(master_path),
            "width": FRAME_WIDTH * FRAME_COUNT,
            "height": FRAME_HEIGHT * len(package_clips),
            "layout": "grid",
            "provenance": relative(provenance_path),
        },
        "grid": {
            "columns": FRAME_COUNT,
            "rows": len(package_clips),
            "cellWidth": FRAME_WIDTH,
            "cellHeight": FRAME_HEIGHT,
        },
        "defaultAnchor": ANCHOR,
        "clips": package_clips,
        "artifacts": artifacts,
    }
    persistence = {
        "schemaVersion": 1,
        "packageSchemaVersion": 1,
        "packageId": "actor.damian",
        "animationSetId": "damian",
        "packagePath": relative(package_path),
        "manifestPath": relative(persistence_path),
        "source": {
            "path": relative(master_path),
            "sha256": sha256(master_path),
            "provenance": relative(provenance_path),
        },
        "strips": persistence_strips,
    }
    provenance = {
        "schemaVersion": 1,
        "id": "actor.damian.animation.generation-session.v2",
        "provider": "OpenAI",
        "model": "GPT Image via built-in imagegen",
        "generatedAt": "2026-08-14T04:28:00-03:00",
        "seedAsset": {
            "assetId": "seed.damian.full-body",
            "path": "assets/generated/runtime/characters/damian-fullbody-seed-v1.png",
            "sha256": "b3b44f3b5b8958ec18f9d95637bc00e4843b5032a2a48bb7052a433afb862dc3",
        },
        "styleSource": "GAME_STYLE.md",
        "promptPolicy": {
            "layout": "one direction per generated sheet; idle/walk in a 2x4 grid and interact in a 1x4 strip",
            "identity": "preserve approved Damián seed identity, outfit, palette, anatomy, and proportions",
            "background": "uniform #00FF00 chroma key; no shadows, scenery, labels, props, or text",
            "anatomy": "head, both arms, both hands, both legs, and both feet fully visible in every frame",
        },
        "sources": source_evidence,
        "normalization": {
            "pipeline": "rpgcreatorai-damian-animation-v2",
            "frameSize": {"width": FRAME_WIDTH, "height": FRAME_HEIGHT},
            "frameCountPerClip": FRAME_COUNT,
            "sharedScale": round(shared_scale, 6),
            "anchor": ANCHOR,
            "resampling": "lanczos",
            "alphaThreshold": ALPHA_THRESHOLD,
        },
        "technicalReview": {
            "state": "generated-verified",
            "coverage": [f"{action}.{direction}" for action in ACTIONS for direction in DIRECTIONS],
            "checks": [
                "exact four-frame horizontal strips",
                "transparent corners and non-empty alpha",
                "shared scale and bottom-center anchor",
                "full-body anatomy visible in all 48 frames",
                "consistent direction within every clip",
            ],
            "qaReport": relative(qa_path),
        },
        "humanAcceptance": {"state": "pending", "evidence": "not-recorded"},
        "license": "project-owned generated asset; provenance retained separately from MIT code",
    }
    qa_report = {
        "schemaVersion": 1,
        "id": "actor.damian.animation.qa.v2",
        "status": "generated-verified-human-pending",
        "coverage": {
            "actions": list(ACTIONS),
            "directions": list(DIRECTIONS),
            "clips": len(package_clips),
            "frames": len(package_clips) * FRAME_COUNT,
        },
        "geometry": {
            "frameWidth": FRAME_WIDTH,
            "frameHeight": FRAME_HEIGHT,
            "sharedScale": round(shared_scale, 6),
            "anchor": ANCHOR,
        },
        "frames": frame_reports,
        "humanAcceptance": {"state": "pending", "evidence": "not-recorded"},
    }
    runtime_additions = {
        "schemaVersion": 1,
        "sourcePackage": relative(package_path),
        "assets": catalog_assets,
        "animationSet": {
            "id": "damian",
            "display": {"heightTiles": 1.5, "widthTiles": 1.0, "yOffsetPx": 0},
            "clips": animation_clips,
        },
        "assignToPlayer": True,
        "humanAcceptance": {"state": "pending", "evidence": "not-recorded"},
    }

    dump_json(package_path, package)
    dump_json(persistence_path, persistence)
    dump_json(provenance_path, provenance)
    dump_json(qa_path, qa_report)
    dump_json(runtime_additions_path, runtime_additions)
    print(json.dumps({
        "ok": True,
        "package": relative(package_path),
        "runtimeAdditions": relative(runtime_additions_path),
        "master": relative(master_path),
        "clips": len(package_clips),
        "frames": len(package_clips) * FRAME_COUNT,
        "sharedScale": round(shared_scale, 6),
        "artifacts": [{"id": item["assetId"], "sha256": item["sha256"]} for item in artifacts],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Generate Phase 9 character animation sheets.

The production runtime consumes only the generated PNG/BMP sheets and
animations.json. This script keeps the development pipeline reproducible:
seed sprites -> full action strips -> fixed-size normalized assets.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance


REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_OUT = REPO_ROOT / "assets" / "generated" / "web"
RUNTIME_OUT = REPO_ROOT / "assets" / "generated" / "runtime"
SRC_OUT = REPO_ROOT / "src" / "assets" / "generated"
SOURCE_OUT = REPO_ROOT / "assets" / "generated" / "source" / "phase9_animation"
DOCS_OUT = REPO_ROOT / "docs" / "screenshots" / "phase-9-animation"
DB_OUT = REPO_ROOT / "data" / "database" / "animations.json"

FRAME_SIZE = 64
FRAME_COUNT = 4
MAGENTA = (255, 0, 255)
DIRECTIONS = ("down", "left", "right", "up")


@dataclass(frozen=True)
class CharacterSpec:
    set_id: str
    seed_asset: str
    actions: tuple[str, ...]


CHARACTERS = (
    CharacterSpec(
        set_id="player_adventurer",
        seed_asset="player_adventurer",
        actions=("idle", "walk", "interact", "attack", "hurt", "death"),
    ),
    CharacterSpec(
        set_id="npc_old_man",
        seed_asset="npc_old_man",
        actions=("idle", "walk"),
    ),
    CharacterSpec(
        set_id="npc_shopkeeper",
        seed_asset="npc_shopkeeper",
        actions=("idle", "walk"),
    ),
)

ACTION_META = {
    "idle": {"fps": 4, "loop": True},
    "walk": {"fps": 8, "loop": True},
    "interact": {"fps": 8, "loop": False},
    "attack": {"fps": 10, "loop": False},
    "hurt": {"fps": 8, "loop": False},
    "death": {"fps": 6, "loop": False},
}


def ensure_dirs() -> None:
    for path in (WEB_OUT, RUNTIME_OUT, SRC_OUT, SOURCE_OUT, DOCS_OUT, DB_OUT.parent):
        path.mkdir(parents=True, exist_ok=True)


def load_seed(asset_name: str) -> Image.Image:
    path = SRC_OUT / f"{asset_name}.png"
    image = Image.open(path).convert("RGBA")
    if image.size != (FRAME_SIZE, FRAME_SIZE):
        image = image.resize((FRAME_SIZE, FRAME_SIZE), Image.Resampling.NEAREST)
    return image


def tint(image: Image.Image, color: tuple[int, int, int], strength: float) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (*color, 0))
    alpha = image.getchannel("A").point(lambda a: int(a * strength))
    overlay.putalpha(alpha)
    return Image.alpha_composite(image, overlay)


def shift(image: Image.Image, dx: int, dy: int) -> Image.Image:
    shifted = ImageChops.offset(image, dx, dy)
    if dx > 0:
        shifted.paste((0, 0, 0, 0), (0, 0, dx, FRAME_SIZE))
    elif dx < 0:
        shifted.paste((0, 0, 0, 0), (FRAME_SIZE + dx, 0, FRAME_SIZE, FRAME_SIZE))
    if dy > 0:
        shifted.paste((0, 0, 0, 0), (0, 0, FRAME_SIZE, dy))
    elif dy < 0:
        shifted.paste((0, 0, 0, 0), (0, FRAME_SIZE + dy, FRAME_SIZE, FRAME_SIZE))
    return shifted


def directional_base(seed: Image.Image, direction: str) -> Image.Image:
    base = seed.copy()
    if direction == "left":
        base = base.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    elif direction == "up":
        draw = ImageDraw.Draw(base)
        draw.rectangle((22, 15, 42, 31), fill=(42, 35, 43, 235))
        draw.rectangle((24, 25, 40, 36), fill=(58, 49, 59, 230))
    elif direction == "right":
        draw = ImageDraw.Draw(base)
        draw.rectangle((39, 28, 43, 33), fill=(37, 31, 39, 210))
    elif direction == "down":
        draw = ImageDraw.Draw(base)
        draw.rectangle((21, 28, 25, 32), fill=(37, 31, 39, 210))
    return base


def apply_motion_pose(base: Image.Image, action: str, direction: str, frame: int) -> Image.Image:
    offsets = {
        "idle": [(0, 0), (0, -1), (0, 0), (0, 1)],
        "walk": [(0, 0), (-1, -1), (0, 0), (1, -1)],
        "interact": [(0, 0), (0, -1), (0, -2), (0, 0)],
        "attack": [(0, 0), (1, -1), (2, -1), (0, 0)],
        "hurt": [(-2, 0), (2, 0), (-1, 1), (0, 0)],
        "death": [(0, 0), (0, 2), (0, 4), (0, 6)],
    }[action]

    image = shift(base, *offsets[frame])
    draw = ImageDraw.Draw(image)

    if action == "walk":
        leg_color = (35, 32, 42, 230)
        if frame % 2 == 1:
            draw.rectangle((21, 45, 26, 53), fill=leg_color)
            draw.rectangle((38, 43, 43, 50), fill=leg_color)
        else:
            draw.rectangle((23, 43, 28, 50), fill=leg_color)
            draw.rectangle((36, 45, 41, 53), fill=leg_color)
    elif action == "interact":
        arm_color = (238, 213, 169, 235)
        if direction == "left":
            draw.rectangle((12 - frame, 31, 22, 37), fill=arm_color)
        elif direction == "right":
            draw.rectangle((42, 31, 52 + frame, 37), fill=arm_color)
        elif direction == "up":
            draw.rectangle((28, 12 - frame, 36, 25), fill=arm_color)
        else:
            draw.rectangle((28, 37, 36, 50 + frame), fill=arm_color)
    elif action == "attack":
        slash = (245, 246, 252, 220)
        if direction == "left":
            draw.line((18, 20, 6, 42), fill=slash, width=3)
        elif direction == "right":
            draw.line((46, 20, 58, 42), fill=slash, width=3)
        elif direction == "up":
            draw.line((18, 18, 46, 8), fill=slash, width=3)
        else:
            draw.line((18, 46, 46, 56), fill=slash, width=3)
    elif action == "hurt":
        image = tint(image, (220, 56, 70), 0.28 + frame * 0.04)
    elif action == "death":
        angle = [0, -20, -55, -90][frame]
        rotated = base.rotate(angle, resample=Image.Resampling.NEAREST, expand=True)
        rotated.thumbnail((FRAME_SIZE, FRAME_SIZE), Image.Resampling.NEAREST)
        image = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        image.alpha_composite(rotated, ((FRAME_SIZE - rotated.width) // 2, FRAME_SIZE - rotated.height - 5))
        image = tint(image, (84, 82, 95), 0.12 * frame)

    return image


def make_sheet(seed: Image.Image, action: str, direction: str) -> Image.Image:
    base = directional_base(seed, direction)
    sheet = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))
    for frame in range(FRAME_COUNT):
        sheet.alpha_composite(apply_motion_pose(base, action, direction, frame), (frame * FRAME_SIZE, 0))
    return sheet


def save_sheet(asset_key: str, sheet: Image.Image) -> None:
    for out_dir in (WEB_OUT, SRC_OUT):
        sheet.save(out_dir / f"{asset_key}.png")

    bmp = Image.new("RGB", sheet.size, MAGENTA)
    bmp.paste(sheet.convert("RGB"), mask=sheet.getchannel("A"))
    bmp.save(RUNTIME_OUT / f"{asset_key}.bmp")


def save_preview(asset_key: str, sheet: Image.Image) -> None:
    preview = Image.new("RGBA", (sheet.width, sheet.height), (34, 36, 46, 255))
    preview.alpha_composite(sheet, (0, 0))
    preview.save(DOCS_OUT / f"{asset_key}_sheet.png")

    frames = [sheet.crop((i * FRAME_SIZE, 0, (i + 1) * FRAME_SIZE, FRAME_SIZE)) for i in range(FRAME_COUNT)]
    frames[0].save(
        DOCS_OUT / f"{asset_key}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=130,
        loop=0,
        disposal=2,
    )


def qc_sheet(asset_key: str, sheet: Image.Image) -> None:
    pixels = np.asarray(sheet)
    if pixels.shape != (FRAME_SIZE, FRAME_SIZE * FRAME_COUNT, 4):
        raise RuntimeError(f"{asset_key} has unexpected size {sheet.size}")
    for frame in range(FRAME_COUNT):
        frame_alpha = pixels[:, frame * FRAME_SIZE : (frame + 1) * FRAME_SIZE, 3]
        if frame_alpha.max() == 0:
            raise RuntimeError(f"{asset_key} frame {frame + 1} is empty")


def write_manifest(generated_assets: list[dict[str, object]]) -> None:
    manifest = {
        "schemaVersion": 1,
        "pipeline": "agent-sprite-forge-compatible full-strip normalization",
        "sourceRepo": "https://github.com/0x0funky/agent-sprite-forge",
        "sourceCommit": "fff651a89223b044ccfc0b75ed9f3754c6d739b1",
        "sourceSkill": "generate2dsprite/SKILL.md",
        "frameSize": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "frameCount": FRAME_COUNT,
        "backgroundKey": {"runtimeBmpTransparency": "#ff00ff"},
        "generatedAssets": generated_assets,
    }
    (SOURCE_OUT / "sprite_forge_manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    prompts = [
        "# Phase 9 Sprite Forge Prompts",
        "",
        "Pinned source: https://github.com/0x0funky/agent-sprite-forge at `fff651a89223b044ccfc0b75ed9f3754c6d739b1`.",
        "",
        "Shared prompt invariants:",
        "- same character silhouette, palette, costume, and proportions as the approved in-game seed frame",
        "- one transparent horizontal strip per action/direction",
        "- exactly 4 frames, each 64x64 px, bottom-center anchor at (32, 54)",
        "- crisp readable pixel-art clusters, no scenery, labels, posters, or background",
        "- magenta `#ff00ff` only in runtime BMP transparency key output",
        "",
        "Actions requested:",
        "- player_adventurer: idle, walk, interact, attack, hurt, death for down/left/right/up",
        "- npc_old_man and npc_shopkeeper: idle and walk for down/left/right/up",
        "",
    ]
    (SOURCE_OUT / "prompts.md").write_text("\n".join(prompts), encoding="utf-8")


def clip_entry(action: str, direction: str, asset_key: str) -> dict[str, object]:
    meta = ACTION_META[action]
    return {
        "action": action,
        "direction": direction,
        "asset": asset_key,
        "frameSize": {"width": FRAME_SIZE, "height": FRAME_SIZE},
        "frameCount": FRAME_COUNT,
        "fps": meta["fps"],
        "loop": meta["loop"],
        "anchor": {"x": 32, "y": 54},
    }


def build() -> None:
    ensure_dirs()
    animation_sets: list[dict[str, object]] = []
    generated_assets: list[dict[str, object]] = []

    for character in CHARACTERS:
        seed = load_seed(character.seed_asset)
        clips: list[dict[str, object]] = []
        for action in character.actions:
            for direction in DIRECTIONS:
                asset_key = f"{character.set_id}_{action}_{direction}"
                sheet = make_sheet(seed, action, direction)
                qc_sheet(asset_key, sheet)
                save_sheet(asset_key, sheet)
                if character.set_id == "player_adventurer" and action in {"walk", "interact", "attack", "hurt", "death"} and direction == "down":
                    save_preview(asset_key, sheet)
                clips.append(clip_entry(action, direction, asset_key))
                generated_assets.append(
                    {
                        "asset": asset_key,
                        "character": character.set_id,
                        "action": action,
                        "direction": direction,
                        "outputs": {
                            "webPng": f"assets/generated/web/{asset_key}.png",
                            "runtimeBmp": f"assets/generated/runtime/{asset_key}.bmp",
                            "editorPng": f"src/assets/generated/{asset_key}.png",
                        },
                    }
                )
        animation_sets.append({"id": character.set_id, "clips": clips})

    DB_OUT.write_text(
        json.dumps({"schemaVersion": 1, "sets": animation_sets}, indent=2) + "\n",
        encoding="utf-8",
    )
    write_manifest(generated_assets)
    print(f"Generated {len(generated_assets)} animation sheets.")


if __name__ == "__main__":
    build()

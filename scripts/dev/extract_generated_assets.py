from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
GAME_ATLAS = REPO_ROOT / "assets/generated/source/game_atlas.png"
UI_ATLAS = REPO_ROOT / "assets/generated/source/ui_atlas.png"
WEB_OUT = REPO_ROOT / "assets/generated/web"
RUNTIME_OUT = REPO_ROOT / "assets/generated/runtime"
SRC_OUT = REPO_ROOT / "src/assets/generated"


GAME_ASSETS = (
    ("tile_grass", 0, 0),
    ("tile_path", 1, 0),
    ("tile_water", 2, 0),
    ("tile_wall", 3, 0),
    ("player_adventurer", 0, 1),
    ("npc_old_man", 1, 1),
    ("npc_shopkeeper", 2, 1),
    ("transfer_door", 3, 1),
    ("chest_closed", 0, 2),
    ("item_potion", 1, 2),
    ("item_sword", 2, 2),
    ("item_shield", 3, 2),
    ("enemy_slime", 0, 3),
    ("skill_book", 1, 3),
    ("ui_quest_journal", 1, 3),
    ("ui_inventory", 2, 3),
    ("ui_status", 3, 3),
)

UI_ASSETS = (
    ("icon_map", 0, 0),
    ("icon_event", 1, 0),
    ("icon_database", 2, 0),
    ("icon_dialogue", 3, 0),
    ("icon_assets", 4, 0),
    ("icon_settings", 0, 1),
    ("ui_inventory", 1, 1),
    ("ui_quest_journal", 2, 1),
    ("ui_status", 3, 1),
    ("icon_save", 4, 1),
    ("icon_load", 0, 2),
    ("ui_battle", 1, 2),
    ("ui_shop", 2, 2),
    ("icon_undo", 3, 2),
    ("icon_redo", 4, 2),
    ("icon_duplicate", 1, 3),
    ("icon_delete", 2, 3),
)


def transparent_crop(
    atlas: Image.Image,
    cols: int,
    rows: int,
    col: int,
    row: int,
    *,
    target_size: int = 64,
) -> tuple[Image.Image, Image.Image]:
    cell_w = atlas.width // cols
    cell_h = atlas.height // rows
    cell = atlas.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h)).convert(
        "RGBA"
    )

    pixels = cell.load()
    min_x, min_y = cell.width, cell.height
    max_x = max_y = -1
    for y in range(cell.height):
        for x in range(cell.width):
            r, g, b, a = pixels[x, y]
            if r >= 240 and g <= 30 and b >= 240:
                pixels[x, y] = (255, 0, 255, 0)
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < 0 or max_y < 0:
        raise ValueError("crop contained no visible pixels")

    tight = cell.crop((min_x, min_y, max_x + 1, max_y + 1))
    scale = min(target_size / tight.width, target_size / tight.height)
    draw_w = max(1, round(tight.width * scale))
    draw_h = max(1, round(tight.height * scale))
    resized = tight.resize((draw_w, draw_h), Image.Resampling.NEAREST)

    png_canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
    png_canvas.alpha_composite(resized, ((target_size - draw_w) // 2, (target_size - draw_h) // 2))

    bmp_canvas = Image.new("RGB", (target_size, target_size), (255, 0, 255))
    bmp_canvas.paste(resized.convert("RGB"), ((target_size - draw_w) // 2, (target_size - draw_h) // 2), resized)
    return png_canvas, bmp_canvas


def export_assets(atlas_path: Path, cols: int, rows: int, assets: Iterable[tuple[str, int, int]]) -> None:
    atlas = Image.open(atlas_path)
    for name, col, row in assets:
        png, bmp = transparent_crop(atlas, cols, rows, col, row)
        png.save(WEB_OUT / f"{name}.png")
        png.save(SRC_OUT / f"{name}.png")
        bmp.save(RUNTIME_OUT / f"{name}.bmp")


def main() -> None:
    for directory in (WEB_OUT, RUNTIME_OUT, SRC_OUT):
        directory.mkdir(parents=True, exist_ok=True)
    export_assets(GAME_ATLAS, 4, 4, GAME_ASSETS)
    export_assets(UI_ATLAS, 5, 4, UI_ASSETS)
    print(f"Generated PNG assets in {WEB_OUT} and {SRC_OUT}")
    print(f"Generated BMP assets in {RUNTIME_OUT}")


if __name__ == "__main__":
    main()

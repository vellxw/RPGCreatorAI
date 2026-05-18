from __future__ import annotations

from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw


REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_OUT = REPO_ROOT / "assets/generated/web"
RUNTIME_OUT = REPO_ROOT / "assets/generated/runtime"
SRC_OUT = REPO_ROOT / "src/assets/generated"
SIZE = 32
UPSCALE = 2


def canvas(fill: tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", (SIZE, SIZE), fill)


def save_asset(name: str, draw_fn: Callable[[ImageDraw.ImageDraw], None], *, fill=(0, 0, 0, 0)) -> None:
    image = canvas(fill)
    draw = ImageDraw.Draw(image)
    draw_fn(draw)
    image = image.resize((SIZE * UPSCALE, SIZE * UPSCALE), Image.Resampling.NEAREST)

    for directory in (WEB_OUT, SRC_OUT):
        directory.mkdir(parents=True, exist_ok=True)
        image.save(directory / f"{name}.png")

    bmp = Image.new("RGB", image.size, (255, 0, 255))
    bmp.paste(image.convert("RGB"), mask=image.getchannel("A"))
    RUNTIME_OUT.mkdir(parents=True, exist_ok=True)
    bmp.save(RUNTIME_OUT / f"{name}.bmp")


def draw_grass(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(79, 139, 72, 255))
    for x, y in (
        (3, 7),
        (7, 18),
        (12, 10),
        (18, 24),
        (23, 8),
        (27, 18),
        (15, 28),
    ):
        d.line((x, y + 3, x + 1, y), fill=(113, 170, 80, 255), width=2)
    for x, y in ((5, 25), (11, 4), (20, 14), (28, 28)):
        d.rectangle((x, y, x + 1, y + 1), fill=(55, 111, 59, 255))


def draw_path(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(176, 136, 94, 255))
    for x, y, w in (
        (2, 5, 8),
        (14, 8, 5),
        (23, 4, 6),
        (5, 18, 7),
        (19, 20, 9),
        (10, 27, 5),
    ):
        d.rectangle((x, y, x + w, y + 1), fill=(199, 158, 110, 255))
    for x, y in ((7, 11), (15, 16), (25, 13), (29, 27), (2, 27)):
        d.point((x, y), fill=(137, 99, 69, 255))


def draw_water(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(39, 88, 173, 255))
    for y in (5, 13, 21, 28):
        d.line((0, y, 31, y), fill=(28, 70, 155, 255), width=2)
    for x, y, width in ((3, 8, 9), (16, 10, 11), (7, 18, 10), (20, 24, 8)):
        d.line((x, y, x + width, y), fill=(101, 162, 232, 255), width=2)


def draw_wall(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(69, 64, 72, 255))
    for y in (0, 8, 16, 24):
        d.line((0, y, 31, y), fill=(48, 44, 53, 255), width=2)
    for row, offset in enumerate((0, 8, 0, 8)):
        y = row * 8
        for x in range(offset, 32, 16):
            d.line((x, y, x, min(31, y + 7)), fill=(48, 44, 53, 255), width=2)
    d.rectangle((3, 3, 13, 4), fill=(92, 84, 96, 255))
    d.rectangle((18, 19, 28, 20), fill=(92, 84, 96, 255))


def draw_snow(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(214, 236, 243, 255))
    d.rectangle((0, 23, 31, 31), fill=(194, 224, 236, 255))
    for x, y in ((4, 5), (12, 10), (24, 7), (7, 18), (18, 21), (27, 16)):
        d.rectangle((x, y, x + 1, y + 1), fill=(244, 250, 252, 255))
    for x in range(0, 32, 8):
        d.line((x, 27, x + 4, 24), fill=(183, 214, 229, 255))


def draw_tree(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(93, 163, 117, 255))
    d.rectangle((14, 18, 18, 31), fill=(112, 73, 52, 255))
    d.rectangle((13, 20, 19, 22), fill=(132, 88, 60, 255))
    d.rectangle((7, 12, 25, 24), fill=(33, 110, 74, 255))
    d.rectangle((4, 10, 28, 18), fill=(39, 128, 84, 255))
    d.rectangle((9, 5, 23, 13), fill=(47, 146, 91, 255))
    d.rectangle((12, 3, 20, 8), fill=(72, 172, 105, 255))
    d.rectangle((7, 13, 10, 17), fill=(71, 167, 104, 255))
    d.rectangle((22, 11, 25, 15), fill=(71, 167, 104, 255))


def draw_interior_floor(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(119, 95, 78, 255))
    for y in range(0, 32, 8):
        d.line((0, y, 31, y), fill=(91, 69, 57, 255))
    for row, offset in enumerate((0, 8, 4, 12)):
        y = row * 8
        for x in range(offset, 32, 16):
            d.line((x, y, x, min(31, y + 7)), fill=(92, 69, 57, 255))
    d.rectangle((4, 3, 12, 4), fill=(145, 117, 95, 255))
    d.rectangle((19, 18, 27, 19), fill=(145, 117, 95, 255))


def draw_interior_wall(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(90, 77, 92, 255))
    d.rectangle((0, 0, 31, 7), fill=(116, 100, 120, 255))
    d.rectangle((0, 24, 31, 31), fill=(73, 62, 74, 255))
    for y in (8, 16, 24):
        d.line((0, y, 31, y), fill=(62, 54, 64, 255))
    for x in range(0, 32, 8):
        d.line((x, 8, x, 31), fill=(62, 54, 64, 255))
    d.rectangle((4, 4, 27, 5), fill=(143, 124, 146, 255))


def draw_collision_overlay(d: ImageDraw.ImageDraw) -> None:
    for y in range(0, 32, 4):
        d.rectangle((0, y, 31, y + 1), fill=(239, 68, 68, 92))
    d.line((3, 3, 28, 28), fill=(248, 113, 113, 220), width=3)
    d.line((28, 3, 3, 28), fill=(248, 113, 113, 220), width=3)
    d.rectangle((1, 1, 30, 30), outline=(254, 202, 202, 255), width=2)


def draw_void_warning(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((0, 0, 31, 31), fill=(54, 15, 43, 255))
    for y in range(0, 32, 8):
        for x in range(0, 32, 8):
            if (x // 8 + y // 8) % 2 == 0:
                d.rectangle((x, y, x + 7, y + 7), fill=(125, 45, 101, 255))
    d.line((5, 5, 26, 26), fill=(244, 114, 182, 255), width=3)
    d.line((26, 5, 5, 26), fill=(244, 114, 182, 255), width=3)


def draw_shop_marker(d: ImageDraw.ImageDraw) -> None:
    d.rectangle((7, 8, 24, 25), fill=(111, 71, 48, 255))
    d.rectangle((5, 6, 26, 11), fill=(180, 94, 59, 255))
    for x in (6, 11, 16, 21):
        d.rectangle((x, 6, x + 3, 11), fill=(241, 196, 102, 255))
    d.rectangle((10, 14, 21, 22), fill=(245, 225, 173, 255))
    d.rectangle((14, 16, 17, 20), fill=(92, 58, 41, 255))
    d.rectangle((11, 26, 20, 28), fill=(78, 52, 41, 255))


def draw_battle_marker(d: ImageDraw.ImageDraw) -> None:
    d.polygon([(8, 25), (11, 22), (20, 9), (23, 6), (25, 8), (22, 11), (11, 24)], fill=(211, 217, 226, 255))
    d.polygon([(24, 25), (21, 22), (12, 9), (9, 6), (7, 8), (10, 11), (21, 24)], fill=(235, 185, 93, 255))
    d.rectangle((6, 24, 13, 27), fill=(95, 61, 45, 255))
    d.rectangle((19, 24, 26, 27), fill=(95, 61, 45, 255))


def main() -> None:
    save_asset("tile_grass", draw_grass)
    save_asset("tile_path", draw_path)
    save_asset("tile_water", draw_water)
    save_asset("tile_wall", draw_wall)
    save_asset("tile_snow", draw_snow)
    save_asset("tile_tree", draw_tree)
    save_asset("tile_interior_floor", draw_interior_floor)
    save_asset("tile_interior_wall", draw_interior_wall)
    save_asset("tile_collision_overlay", draw_collision_overlay)
    save_asset("tile_void_warning", draw_void_warning)
    save_asset("shop_marker", draw_shop_marker)
    save_asset("battle_marker", draw_battle_marker)
    print("Generated supplementary visual assets.")


if __name__ == "__main__":
    main()

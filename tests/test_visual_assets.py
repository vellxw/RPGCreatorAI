from pathlib import Path
import unittest

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
VISUAL_TILE_NAMES = (
    "tile_grass.png",
    "tile_path.png",
    "tile_water.png",
    "tile_wall.png",
    "tile_snow.png",
    "tile_tree.png",
    "tile_interior_floor.png",
    "tile_interior_wall.png",
)


class GeneratedVisualAssetTests(unittest.TestCase):
    def test_visual_tiles_cover_their_full_cell_without_transparent_edges(self) -> None:
        for asset_name in VISUAL_TILE_NAMES:
            with self.subTest(asset_name=asset_name):
                image = Image.open(REPO_ROOT / "src" / "assets" / "generated" / asset_name).convert("RGBA")
                width, height = image.size
                edge_pixels = []
                edge_pixels.extend(image.getpixel((x, 0)) for x in range(width))
                edge_pixels.extend(image.getpixel((x, height - 1)) for x in range(width))
                edge_pixels.extend(image.getpixel((0, y)) for y in range(height))
                edge_pixels.extend(image.getpixel((width - 1, y)) for y in range(height))
                self.assertTrue(
                    all(pixel[3] == 255 for pixel in edge_pixels),
                    f"{asset_name} must be fully opaque on every outer edge",
                )


if __name__ == "__main__":
    unittest.main()

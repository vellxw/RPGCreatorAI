"""M11 sprite-sheet optimization fixture tests.

Exercises the canonical ``scripts/dev/normalize_animation_strip.py``
end-to-end with a small 6-frame, 32x32 strip and asserts the contract
the runtime depends on:

- sheet width equals ``frameWidth * frameCount`` (192 = 32 * 6),
- frame count matches the input,
- the runtime BMP uses ``#ff00ff`` as the transparency key.
"""

from __future__ import annotations

import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "dev" / "normalize_animation_strip.py"


def _load_normalizer():
    spec = importlib.util.spec_from_file_location("normalize_animation_strip_m11", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load normalize_animation_strip.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SpriteSheetOptimizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="rpgcreatorai_sprite_sheet_m11_"))
        self.module = _load_normalizer()

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def _write_synthetic_strip(
        self,
        relative_path: str,
        *,
        frame_count: int = 6,
        slot_width: int = 32,
        slot_height: int = 32,
    ) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (slot_width * frame_count, slot_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for frame in range(frame_count):
            x = frame * slot_width
            draw.rectangle((x + 12, 6, x + 20, 14), fill=(80 + frame * 20, 110, 180, 255))
            draw.rectangle((x + 10, 14, x + 22, 22), fill=(100 + frame * 20, 130, 200, 255))
            draw.rectangle((x + 12, 22, x + 16, 28), fill=(26, 35, 48, 255))
            draw.rectangle((x + 18, 22, x + 22, 28), fill=(26, 35, 48, 255))
        image.save(path)
        return path

    def _normalize(self, *, input_rel: str, output_id: str) -> dict:
        result = self.module.normalize_animation_strip(
            self.root,
            input_path=input_rel,
            output_id=output_id,
            name=output_id.replace("_", " ").title(),
            action="walk",
            direction="down",
            frame_width=32,
            frame_height=32,
            frame_count=6,
            fps=8,
            loop=True,
            anchor={"x": 16, "y": 28},
        )
        self.assertTrue(result.ok, result.messages)
        return json.loads(Path(result.manifest_path).read_text(encoding="utf-8"))

    def test_happy_path_normalizes_6_frame_32x32_strip_to_runtime_outputs(self) -> None:
        self._write_synthetic_strip("assets/generated/source/raw/m11-raw.png")
        manifest = self._normalize(input_rel="assets/generated/source/raw/m11-raw.png", output_id="m11_happy")
        self.assertEqual(manifest["frameCount"], 6)
        self.assertEqual(manifest["frameSize"], {"width": 32, "height": 32})
        self.assertEqual(manifest["normalization"]["layout"], "horizontal-strip")
        self.assertEqual(manifest["transparency"]["runtimeBmpTransparencyKey"], "#ff00ff")
        self.assertEqual(len(manifest["sourceFrames"]), 6)
        web = self.root / "assets/generated/web/m11_happy.png"
        bmp = self.root / "assets/generated/runtime/m11_happy.bmp"
        with Image.open(web) as image:
            self.assertEqual(image.size, (192, 32))
        with Image.open(bmp) as image:
            self.assertEqual(image.size, (192, 32))
            self.assertEqual(image.convert("RGB").getpixel((0, 0)), (255, 0, 255))
            self.assertEqual(image.convert("RGB").getpixel((191, 0)), (255, 0, 255))

    def test_manifest_frame_count_matches_input(self) -> None:
        self._write_synthetic_strip("assets/generated/source/raw/m11-frame-count.png")
        manifest = self._normalize(
            input_rel="assets/generated/source/raw/m11-frame-count.png",
            output_id="m11_frame_count",
        )
        self.assertEqual(manifest["frameCount"], 6)
        self.assertEqual(len(manifest["sourceFrames"]), 6)

    def test_runtime_bmp_uses_magenta_transparency_key(self) -> None:
        self._write_synthetic_strip("assets/generated/source/raw/m11-magenta.png")
        self._normalize(input_rel="assets/generated/source/raw/m11-magenta.png", output_id="m11_magenta")
        bmp_path = self.root / "assets/generated/runtime/m11_magenta.bmp"
        with Image.open(bmp_path) as image:
            bmp = image.convert("RGB")
            self.assertEqual(bmp.size, (192, 32))
            self.assertEqual(bmp.getpixel((0, 0)), (255, 0, 255))
            self.assertEqual(bmp.getpixel((191, 31)), (255, 0, 255))

    def test_sheet_width_equals_frame_width_times_frame_count(self) -> None:
        self._write_synthetic_strip("assets/generated/source/raw/m11-width.png")
        manifest = self._normalize(input_rel="assets/generated/source/raw/m11-width.png", output_id="m11_width")
        self.assertEqual(manifest["frameSize"]["width"] * manifest["frameCount"], 192)
        self.assertEqual(manifest["frameSize"]["width"], 32)
        self.assertEqual(manifest["frameCount"], 6)
        web = self.root / "assets/generated/web/m11_width.png"
        editor = self.root / "src/assets/generated/m11_width.png"
        bmp = self.root / "assets/generated/runtime/m11_width.bmp"
        for path in (web, editor, bmp):
            with Image.open(path) as image:
                self.assertEqual(image.size, (192, 32))


if __name__ == "__main__":
    unittest.main()

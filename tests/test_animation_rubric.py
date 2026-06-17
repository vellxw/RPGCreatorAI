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


def load_normalizer_module():
    spec = importlib.util.spec_from_file_location("normalize_animation_strip_rubric", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load normalize_animation_strip.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AnimationRubricTests(unittest.TestCase):
    """M09 fixture-driven rubric for the animation strip normalizer.

    The normalizer is the Python companion to
    `src/providers/generatedAnimationQa.ts`. This suite locks down the
    invariants the QA contract relies on (alpha bounds, BMP transparency
    key, manifest well-formedness, frame count divisibility) and asserts
    that bad input is rejected with a clear error.
    """

    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="rpgcreatorai_animation_rubric_"))
        self.module = load_normalizer_module()

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def write_synthetic_strip(
        self,
        relative_path: str,
        *,
        frame_count: int = 3,
        slot_width: int = 96,
        slot_height: int = 80,
    ) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (slot_width * frame_count, slot_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for frame in range(frame_count):
            x = frame * slot_width
            # A character silhouette: head, torso, and two feet columns.
            draw.rectangle((x + 30, 18, x + 60, 38), fill=(40 + frame * 30, 90, 180, 255))
            draw.rectangle((x + 28, 38, x + 62, 60), fill=(60 + frame * 30, 110, 200, 255))
            draw.rectangle((x + 32, 60, x + 44, 76), fill=(26, 35, 48, 255))
            draw.rectangle((x + 48, 60, x + 58, 76), fill=(26, 35, 48, 255))
        image.save(path)
        return path

    def test_synthetic_strip_normalizes_to_expected_outputs_and_manifest(self) -> None:
        self.write_synthetic_strip("assets/generated/source/raw/hero-rubric-raw.png")
        result = self.module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/hero-rubric-raw.png",
            output_id="hero_rubric",
            name="Hero Rubric",
            action="walk",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=8,
            loop=True,
            anchor={"x": 32, "y": 56},
            source_asset_id="hero_rubric_candidate",
            source_concept_id="hero_concept",
        )

        self.assertTrue(result.ok, result.messages)
        self.assertIsNotNone(result.manifest_path)
        manifest_path = result.manifest_path

        # Manifest well-formedness — every key the QA contract relies on.
        manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
        self.assertEqual(manifest["schemaVersion"], 1)
        self.assertEqual(manifest["pipeline"], "rpgcreatorai-animation-strip-normalization-v1")
        self.assertEqual(manifest["id"], "hero_rubric")
        self.assertEqual(manifest["name"], "Hero Rubric")
        self.assertEqual(manifest["action"], "walk")
        self.assertEqual(manifest["direction"], "down")
        self.assertEqual(manifest["sourcePath"], "assets/generated/source/raw/hero-rubric-raw.png")
        self.assertEqual(manifest["sourceAssetId"], "hero_rubric_candidate")
        self.assertEqual(manifest["sourceConceptId"], "hero_concept")
        self.assertEqual(manifest["frameSize"], {"width": 64, "height": 64})
        self.assertEqual(manifest["sourceFrameSize"], {"width": 96, "height": 80})
        # Frame count match — the canonical M09 invariant.
        self.assertEqual(manifest["frameCount"], 3)
        self.assertEqual(manifest["fps"], 8)
        self.assertEqual(manifest["loop"], True)
        self.assertEqual(manifest["anchor"], {"x": 32, "y": 56})
        self.assertEqual(manifest["transparency"]["pngBackground"], "alpha")
        # The runtime BMP transparency key is the value the catalog and
        # generatedAnimationQa contract both rely on.
        self.assertEqual(manifest["transparency"]["runtimeBmpTransparencyKey"], "#ff00ff")
        for key in ("webPng", "editorPng", "runtimeBmp"):
            self.assertIn(key, manifest["outputs"])
        self.assertEqual(len(manifest["sourceFrames"]), 3)
        for index, frame in enumerate(manifest["sourceFrames"], start=1):
            self.assertEqual(frame["index"], index)
            self.assertIn("sourceBounds", frame)
            self.assertIn("normalizedBounds", frame)

        # Output files exist and have the right shape.
        web_png = self.root / "assets/generated/web/hero_rubric.png"
        editor_png = self.root / "src/assets/generated/hero_rubric.png"
        runtime_bmp = self.root / "assets/generated/runtime/hero_rubric.bmp"
        for output in (web_png, editor_png, runtime_bmp):
            with self.subTest(output=output):
                self.assertTrue(output.is_file(), f"{output} should exist")

        # All frames have non-empty alpha — the alpha-bounds half of the rubric.
        with Image.open(web_png) as opened:
            web = opened.convert("RGBA")
            self.assertEqual(web.size, (192, 64))  # frameWidth * frameCount × frameHeight
            self.assertEqual(web.getpixel((0, 0))[3], 0)  # transparent margin
            for frame in range(3):
                bbox = web.crop((frame * 64, 0, (frame + 1) * 64, 64)).getchannel("A").getbbox()
                self.assertIsNotNone(bbox, f"web frame {frame + 1} must have non-empty alpha")

        with Image.open(editor_png) as opened:
            editor = opened.convert("RGBA")
            self.assertEqual(editor.size, (192, 64))

        # The runtime BMP must use the #ff00ff magenta key for transparency.
        with Image.open(runtime_bmp) as opened:
            bmp = opened.convert("RGB")
            self.assertEqual(bmp.size, (192, 64))
            # The corner of the first frame is a transparent margin pixel
            # in the source RGBA, so the BMP must paint it magenta.
            self.assertEqual(bmp.getpixel((0, 0)), (255, 0, 255))

        # validate_normalized_strip_outputs round-trip is the final gate.
        validation = self.module.validate_normalized_strip_outputs(self.root, manifest_path)
        self.assertTrue(validation.ok, validation.messages)

    def test_mismatched_width_is_rejected_with_clear_error(self) -> None:
        # 191 is not divisible by 3; the normalizer must refuse the input
        # with a message that names the offending value, not a generic error.
        bad_path = self.root / "assets/generated/source/raw/bad-rubric.png"
        bad_path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGBA", (191, 64), (0, 0, 0, 0)).save(bad_path)

        result = self.module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/bad-rubric.png",
            output_id="bad_rubric",
            name="Bad Rubric",
            action="walk",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=8,
            loop=True,
            anchor={"x": 32, "y": 56},
        )

        self.assertFalse(result.ok)
        self.assertTrue(
            any("191" in message and "3" in message and "divisible" in message
                for message in result.messages),
            f"expected a clear divisibility error, got {result.messages}",
        )
        # No outputs should be written when the input is rejected.
        self.assertFalse((self.root / "assets/generated/web/bad_rubric.png").exists())
        self.assertFalse((self.root / "assets/generated/runtime/bad_rubric.bmp").exists())

    def test_missing_input_file_is_rejected_with_clear_error(self) -> None:
        result = self.module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/does-not-exist.png",
            output_id="missing_rubric",
            name="Missing Rubric",
            action="walk",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=8,
            loop=True,
            anchor={"x": 32, "y": 56},
        )

        self.assertFalse(result.ok)
        self.assertTrue(
            any("not found" in message for message in result.messages),
            f"expected a 'not found' error, got {result.messages}",
        )

    def test_fully_transparent_input_is_rejected(self) -> None:
        # The alpha-bounds rubric forbids a 100% transparent input. PIL
        # writes a fully-transparent PNG when we save an all-zero RGBA image.
        empty_path = self.root / "assets/generated/source/raw/empty-rubric.png"
        empty_path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGBA", (192, 80), (0, 0, 0, 0)).save(empty_path)

        result = self.module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/empty-rubric.png",
            output_id="empty_rubric",
            name="Empty Rubric",
            action="walk",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=8,
            loop=True,
            anchor={"x": 32, "y": 56},
        )

        self.assertFalse(result.ok)
        self.assertTrue(
            any("fully transparent" in message for message in result.messages),
            f"expected a 'fully transparent' error, got {result.messages}",
        )


if __name__ == "__main__":
    unittest.main()

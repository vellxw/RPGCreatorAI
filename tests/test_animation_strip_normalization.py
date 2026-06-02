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
    spec = importlib.util.spec_from_file_location("normalize_animation_strip", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load normalize_animation_strip.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AnimationStripNormalizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="rpgcreatorai_strip_normalization_"))

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def write_raw_strip(
        self,
        relative_path: str,
        *,
        frame_count: int = 3,
        slot_width: int = 96,
        slot_height: int = 80,
        empty_frame: int | None = None,
    ) -> Path:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (slot_width * frame_count, slot_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for frame in range(frame_count):
            if empty_frame == frame + 1:
                continue
            x = frame * slot_width
            draw.rectangle((x + 28, 16, x + 64, 62), fill=(40 + frame * 30, 90, 180, 255))
            draw.rectangle((x + 38, 52, x + 52, 72), fill=(26, 35, 48, 255))
        image.save(path)
        return path

    def test_normalizes_raw_strip_to_editor_runtime_outputs_and_manifest(self) -> None:
        self.write_raw_strip("assets/generated/source/raw/hero-run-raw.png")
        module = load_normalizer_module()

        result = module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/hero-run-raw.png",
            output_id="hero_run_normalized",
            name="Hero Run Normalized",
            action="walk",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=8,
            loop=True,
            anchor={"x": 32, "y": 56},
            source_asset_id="hero_run_candidate",
            source_concept_id="hero_concept",
        )

        self.assertTrue(result.ok, result.messages)

        web_png = self.root / "assets/generated/web/hero_run_normalized.png"
        editor_png = self.root / "src/assets/generated/hero_run_normalized.png"
        runtime_bmp = self.root / "assets/generated/runtime/hero_run_normalized.bmp"
        manifest_path = self.root / "assets/generated/source/phase11_animation_normalization/hero_run_normalized.json"

        for output in (web_png, editor_png, runtime_bmp, manifest_path):
            with self.subTest(output=output):
                self.assertTrue(output.is_file(), f"{output} should exist")

        with Image.open(web_png) as image:
            png = image.convert("RGBA")
            self.assertEqual(png.size, (192, 64))
            self.assertEqual(png.getpixel((0, 0))[3], 0)
            for frame in range(3):
                frame_alpha = png.crop((frame * 64, 0, (frame + 1) * 64, 64)).getchannel("A")
                self.assertGreater(frame_alpha.getextrema()[1], 0)

        with Image.open(editor_png) as image:
            self.assertEqual(image.convert("RGBA").size, (192, 64))

        with Image.open(runtime_bmp) as image:
            bmp = image.convert("RGB")
            self.assertEqual(bmp.size, (192, 64))
            self.assertEqual(bmp.getpixel((0, 0)), (255, 0, 255))

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["schemaVersion"], 1)
        self.assertEqual(manifest["pipeline"], "rpgcreatorai-animation-strip-normalization-v1")
        self.assertEqual(manifest["sourcePath"], "assets/generated/source/raw/hero-run-raw.png")
        self.assertEqual(manifest["sourceAssetId"], "hero_run_candidate")
        self.assertEqual(manifest["sourceConceptId"], "hero_concept")
        self.assertEqual(manifest["frameSize"], {"width": 64, "height": 64})
        self.assertEqual(manifest["sourceFrameSize"], {"width": 96, "height": 80})
        self.assertEqual(manifest["frameCount"], 3)
        self.assertEqual(manifest["fps"], 8)
        self.assertEqual(manifest["loop"], True)
        self.assertEqual(manifest["anchor"], {"x": 32, "y": 56})
        self.assertEqual(manifest["outputs"]["webPng"], "assets/generated/web/hero_run_normalized.png")
        self.assertEqual(manifest["outputs"]["editorPng"], "src/assets/generated/hero_run_normalized.png")
        self.assertEqual(manifest["outputs"]["runtimeBmp"], "assets/generated/runtime/hero_run_normalized.bmp")
        self.assertEqual(len(manifest["sourceFrames"]), 3)

        validation = module.validate_normalized_strip_outputs(self.root, manifest_path)
        self.assertTrue(validation.ok, validation.messages)

    def test_rejects_empty_source_frames_before_writing_outputs(self) -> None:
        self.write_raw_strip("assets/generated/source/raw/hero-idle-raw.png", empty_frame=2)
        module = load_normalizer_module()

        result = module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/hero-idle-raw.png",
            output_id="hero_idle_normalized",
            name="Hero Idle Normalized",
            action="idle",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=4,
            loop=True,
            anchor={"x": 32, "y": 56},
        )

        self.assertFalse(result.ok)
        self.assertIn("hero_idle_normalized frame 2 is empty", result.messages)
        self.assertFalse((self.root / "assets/generated/web/hero_idle_normalized.png").exists())

    def test_rejects_malformed_dimensions_and_missing_outputs(self) -> None:
        path = self.root / "assets/generated/source/raw/bad-width.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGBA", (191, 64), (0, 0, 0, 0)).save(path)
        module = load_normalizer_module()

        result = module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/bad-width.png",
            output_id="bad_width",
            name="Bad Width",
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
        self.assertIn("Input width 191 must be divisible by frame count 3", result.messages)

        self.write_raw_strip("assets/generated/source/raw/valid-run-raw.png")
        ok = module.normalize_animation_strip(
            self.root,
            input_path="assets/generated/source/raw/valid-run-raw.png",
            output_id="valid_run",
            name="Valid Run",
            action="walk",
            direction="down",
            frame_width=64,
            frame_height=64,
            frame_count=3,
            fps=8,
            loop=True,
            anchor={"x": 32, "y": 56},
        )
        self.assertTrue(ok.ok, ok.messages)
        (self.root / "assets/generated/runtime/valid_run.bmp").unlink()

        validation = module.validate_normalized_strip_outputs(
            self.root,
            self.root / "assets/generated/source/phase11_animation_normalization/valid_run.json",
        )
        self.assertFalse(validation.ok)
        self.assertIn(
            "Missing normalized output runtimeBmp: assets/generated/runtime/valid_run.bmp",
            validation.messages,
        )


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageSequence


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "dev" / "generate_animation_preview.py"


def load_preview_module():
    spec = importlib.util.spec_from_file_location("generate_animation_preview", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load generate_animation_preview.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AnimationPreviewGenerationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="rpgcreatorai_animation_preview_"))

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def write_normalized_strip(self, output_id: str, *, empty_frame: int | None = None) -> Path:
        strip_path = self.root / "assets/generated/web" / f"{output_id}.png"
        strip_path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (64 * 4, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        for frame in range(4):
            if empty_frame == frame + 1:
                continue
            x = frame * 64
            draw.rectangle((x + 22, 18, x + 42, 52), fill=(40 + frame * 30, 120, 210, 255))
            draw.rectangle((x + 28, 48, x + 36, 58), fill=(22, 32, 44, 255))
        image.save(strip_path)

        manifest_path = self.root / "assets/generated/source/phase11_animation_normalization" / f"{output_id}.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "pipeline": "rpgcreatorai-animation-strip-normalization-v1",
                    "id": output_id,
                    "name": "Hero Walk",
                    "action": "walk",
                    "direction": "down",
                    "sourcePath": "assets/generated/source/raw/hero-walk-raw.png",
                    "sourceAssetId": "hero_walk_candidate",
                    "sourceConceptId": "hero_concept",
                    "frameSize": {"width": 64, "height": 64},
                    "sourceFrameSize": {"width": 96, "height": 80},
                    "frameCount": 4,
                    "fps": 8,
                    "loop": True,
                    "anchor": {"x": 32, "y": 56},
                    "outputs": {
                        "webPng": f"assets/generated/web/{output_id}.png",
                        "editorPng": f"src/assets/generated/{output_id}.png",
                        "runtimeBmp": f"assets/generated/runtime/{output_id}.bmp",
                    },
                    "sourceFrames": [],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        return manifest_path

    def test_generates_gif_sheet_and_preview_manifest_from_normalization_manifest(self) -> None:
        normalization_manifest = self.write_normalized_strip("hero_walk_normalized")
        module = load_preview_module()

        result = module.generate_animation_preview(
            self.root,
            normalization_manifest=normalization_manifest,
            preview_scale=2,
        )

        self.assertTrue(result.ok, result.messages)

        preview_gif = self.root / "docs/screenshots/phase11-animation-preview/hero_walk_normalized.gif"
        preview_sheet = self.root / "docs/screenshots/phase11-animation-preview/hero_walk_normalized_sheet.png"
        preview_manifest = self.root / "assets/generated/source/phase11_animation_previews/hero_walk_normalized.json"
        for output in (preview_gif, preview_sheet, preview_manifest):
            with self.subTest(output=output):
                self.assertTrue(output.is_file(), f"{output} should exist")

        with Image.open(preview_sheet) as image:
            self.assertEqual(image.convert("RGBA").size, (64 * 4 * 2, 64 * 2))

        with Image.open(preview_gif) as image:
            self.assertEqual(image.size, (64 * 2, 64 * 2))
            frames = [frame.copy() for frame in ImageSequence.Iterator(image)]
            self.assertEqual(len(frames), 4)
            self.assertIn(image.info.get("duration"), {120, 125, 130})

        manifest = json.loads(preview_manifest.read_text(encoding="utf-8"))
        self.assertEqual(manifest["schemaVersion"], 1)
        self.assertEqual(manifest["pipeline"], "rpgcreatorai-animation-preview-generation-v1")
        self.assertEqual(
            manifest["sourceNormalizationManifest"],
            "assets/generated/source/phase11_animation_normalization/hero_walk_normalized.json",
        )
        self.assertEqual(manifest["sourceStrip"], "assets/generated/web/hero_walk_normalized.png")
        self.assertEqual(manifest["sourceAssetId"], "hero_walk_candidate")
        self.assertEqual(manifest["sourceConceptId"], "hero_concept")
        self.assertEqual(manifest["runtimeDependency"], False)
        self.assertEqual(manifest["preview"]["durationMs"], 125)
        self.assertEqual(manifest["outputs"]["previewGif"], "docs/screenshots/phase11-animation-preview/hero_walk_normalized.gif")
        self.assertEqual(manifest["outputs"]["previewSheetPng"], "docs/screenshots/phase11-animation-preview/hero_walk_normalized_sheet.png")

        validation = module.validate_animation_preview_outputs(self.root, preview_manifest)
        self.assertTrue(validation.ok, validation.messages)

    def test_rejects_empty_frames_before_writing_preview_outputs(self) -> None:
        normalization_manifest = self.write_normalized_strip("hero_idle_normalized", empty_frame=2)
        module = load_preview_module()

        result = module.generate_animation_preview(
            self.root,
            normalization_manifest=normalization_manifest,
            preview_scale=2,
        )

        self.assertFalse(result.ok)
        self.assertIn("hero_idle_normalized preview frame 2 is empty", result.messages)
        self.assertFalse((self.root / "docs/screenshots/phase11-animation-preview/hero_idle_normalized.gif").exists())

    def test_preview_validation_reports_missing_outputs(self) -> None:
        normalization_manifest = self.write_normalized_strip("hero_attack_normalized")
        module = load_preview_module()
        generated = module.generate_animation_preview(self.root, normalization_manifest=normalization_manifest)
        self.assertTrue(generated.ok, generated.messages)

        (self.root / "docs/screenshots/phase11-animation-preview/hero_attack_normalized.gif").unlink()
        validation = module.validate_animation_preview_outputs(
            self.root,
            self.root / "assets/generated/source/phase11_animation_previews/hero_attack_normalized.json",
        )

        self.assertFalse(validation.ok)
        self.assertIn(
            "Missing animation preview output previewGif: docs/screenshots/phase11-animation-preview/hero_attack_normalized.gif",
            validation.messages,
        )


if __name__ == "__main__":
    unittest.main()

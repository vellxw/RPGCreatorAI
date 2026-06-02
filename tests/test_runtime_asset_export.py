from __future__ import annotations

import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "dev" / "export_runtime_assets.py"


def load_export_module():
    spec = importlib.util.spec_from_file_location("export_runtime_assets", SCRIPT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load export_runtime_assets.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuntimeAssetExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="rpgcreatorai_runtime_assets_"))
        (self.root / "data" / "assets").mkdir(parents=True)

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def write_catalog(self, assets: list[dict[str, object]]) -> None:
        (self.root / "data" / "assets" / "catalog.json").write_text(
            json.dumps({"schemaVersion": 1, "assets": assets}, indent=2) + "\n",
            encoding="utf-8",
        )

    def write_rgba(self, relative_path: str) -> None:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (2, 2), (12, 34, 56, 255))
        image.putpixel((1, 1), (0, 0, 0, 0))
        image.save(path)

    def write_animation_strip(self, relative_path: str) -> None:
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (64 * 4, 64), (0, 0, 0, 0))
        for frame in range(4):
            for x in range(frame * 64 + 24, frame * 64 + 42):
                for y in range(18, 56):
                    image.putpixel((x, y), (45 + frame * 20, 120, 210, 255))
        image.save(path)

    def write_normalization_manifest(self, output_id: str, strip_path: str) -> None:
        manifest_path = self.root / "assets/generated/source/phase11_animation_normalization" / f"{output_id}.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "pipeline": "rpgcreatorai-animation-strip-normalization-v1",
                    "id": output_id,
                    "name": "Hero Walk Normalized",
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
                        "webPng": strip_path,
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

    def test_exports_visual_assets_to_runtime_bmp_manifest(self) -> None:
        self.write_rgba("assets/imported/images/hero.png")
        self.write_rgba("assets/imported/spritesheets/hero-run.png")
        self.write_rgba("assets/imported/tilesets/forest.png")
        self.write_catalog(
            [
                {
                    "id": "hero_portrait",
                    "name": "Hero Portrait",
                    "kind": "image",
                    "source": "imported",
                    "path": "assets/imported/images/hero.png",
                },
                {
                    "id": "hero_run_sheet",
                    "name": "Hero Run Sheet",
                    "kind": "spritesheet",
                    "source": "imported",
                    "path": "assets/imported/spritesheets/hero-run.png",
                    "frameWidth": 1,
                    "frameHeight": 2,
                    "frames": 2,
                },
                {
                    "id": "forest_pack",
                    "name": "Forest Pack",
                    "kind": "tileset",
                    "source": "imported",
                    "path": "assets/imported/tilesets/forest.png",
                    "width": 2,
                    "height": 2,
                },
                {
                    "id": "town_loop",
                    "name": "Town Loop",
                    "kind": "audio",
                    "source": "imported",
                    "path": "assets/imported/audio/town-loop.wav",
                },
            ],
        )
        (self.root / "assets" / "imported" / "audio").mkdir(parents=True)
        (self.root / "assets" / "imported" / "audio" / "town-loop.wav").write_bytes(b"RIFF")

        module = load_export_module()
        result = module.export_runtime_assets(self.root)

        self.assertTrue(result.ok, result.messages)
        runtime_bmp = self.root / "assets" / "generated" / "runtime" / "hero_portrait.bmp"
        self.assertTrue(runtime_bmp.is_file())
        with Image.open(runtime_bmp) as image:
            self.assertEqual(image.mode, "RGB")
            self.assertEqual(image.size, (2, 2))
            self.assertEqual(image.getpixel((1, 1)), (255, 0, 255))

        manifest = json.loads((self.root / "data" / "assets" / "runtime-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["schemaVersion"], 1)
        self.assertEqual(manifest["transparencyKey"], "#ff00ff")
        by_id = {entry["id"]: entry for entry in manifest["assets"]}
        self.assertEqual(by_id["hero_portrait"]["runtimePath"], "assets/generated/runtime/hero_portrait.bmp")
        self.assertEqual(by_id["hero_portrait"]["sourcePath"], "assets/imported/images/hero.png")
        self.assertEqual(by_id["hero_portrait"]["runtimeFormat"], "bmp")
        self.assertEqual(by_id["hero_run_sheet"]["runtimeKey"], "hero_run_sheet")
        self.assertEqual(by_id["forest_pack"]["runtimePath"], "assets/generated/runtime/forest_pack.bmp")
        self.assertEqual(by_id["town_loop"]["runtimeFormat"], "wav")
        self.assertEqual(by_id["town_loop"]["runtimePath"], "assets/imported/audio/town-loop.wav")

    def test_exports_normalized_generated_animation_strips_to_runtime_bmp_manifest(self) -> None:
        self.write_catalog([])
        self.write_animation_strip("assets/generated/web/hero_walk_normalized.png")
        self.write_normalization_manifest("hero_walk_normalized", "assets/generated/web/hero_walk_normalized.png")

        module = load_export_module()
        result = module.export_runtime_assets(self.root)

        self.assertTrue(result.ok, result.messages)
        runtime_bmp = self.root / "assets/generated/runtime/hero_walk_normalized.bmp"
        self.assertTrue(runtime_bmp.is_file())
        with Image.open(runtime_bmp) as image:
            bmp = image.convert("RGB")
            self.assertEqual(bmp.size, (64 * 4, 64))
            self.assertEqual(bmp.getpixel((0, 0)), (255, 0, 255))

        manifest = json.loads((self.root / "data" / "assets" / "runtime-manifest.json").read_text(encoding="utf-8"))
        by_id = {entry["id"]: entry for entry in manifest["assets"]}
        entry = by_id["hero_walk_normalized"]
        self.assertEqual(entry["kind"], "spritesheet")
        self.assertEqual(entry["source"], "generated")
        self.assertEqual(entry["sourcePath"], "assets/generated/web/hero_walk_normalized.png")
        self.assertEqual(entry["runtimePath"], "assets/generated/runtime/hero_walk_normalized.bmp")
        self.assertEqual(entry["runtimeKey"], "hero_walk_normalized")
        self.assertEqual(entry["runtimeFormat"], "bmp")
        self.assertEqual(entry["frameWidth"], 64)
        self.assertEqual(entry["frameHeight"], 64)
        self.assertEqual(entry["frames"], 4)
        self.assertEqual(
            entry["sourceNormalizationManifest"],
            "assets/generated/source/phase11_animation_normalization/hero_walk_normalized.json",
        )
        self.assertEqual(entry["action"], "walk")
        self.assertEqual(entry["direction"], "down")
        self.assertEqual(entry["fps"], 8)
        self.assertEqual(entry["loop"], True)

    def test_validation_reports_missing_runtime_outputs(self) -> None:
        self.write_catalog(
            [
                {
                    "id": "hero_run_sheet",
                    "name": "Hero Run Sheet",
                    "kind": "spritesheet",
                    "source": "imported",
                    "path": "assets/imported/spritesheets/hero-run.png",
                },
            ],
        )
        (self.root / "data" / "assets" / "runtime-manifest.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "pipeline": "rpgcreatorai-runtime-asset-export-v1",
                    "transparencyKey": "#ff00ff",
                    "assets": [
                        {
                            "id": "hero_run_sheet",
                            "kind": "spritesheet",
                            "sourcePath": "assets/imported/spritesheets/hero-run.png",
                            "runtimePath": "assets/generated/runtime/hero_run_sheet.bmp",
                            "runtimeKey": "hero_run_sheet",
                            "runtimeFormat": "bmp",
                        }
                    ],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

        module = load_export_module()
        result = module.validate_runtime_outputs(self.root)

        self.assertFalse(result.ok)
        self.assertIn(
            "Missing runtime output for asset hero_run_sheet: assets/generated/runtime/hero_run_sheet.bmp",
            result.messages,
        )


if __name__ == "__main__":
    unittest.main()

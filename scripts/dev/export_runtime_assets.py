from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = Path("data/assets/catalog.json")
MANIFEST_PATH = Path("data/assets/runtime-manifest.json")
RUNTIME_DIR = Path("assets/generated/runtime")
TRANSPARENCY_KEY = "#ff00ff"
MAGENTA = (255, 0, 255)
VISUAL_KINDS = {"image", "spritesheet", "tileset", "generated"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp"}
SAFE_RUNTIME_KEY = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,127}$")


class RuntimeAssetExportResult:
    def __init__(self, messages: list[str] | None = None) -> None:
        self.messages = list(messages or [])

    @property
    def ok(self) -> bool:
        return not self.messages


def project_relative(path: Path) -> str:
    return path.as_posix()


def is_safe_project_relative_path(value: str) -> bool:
    normalized = value.replace("\\", "/").strip()
    if not normalized:
        return False
    if normalized.startswith("/") or normalized.startswith("//"):
        return False
    if re.match(r"^[A-Za-z]:/", normalized):
        return False
    if re.match(r"^[a-z][a-z0-9+.-]*:", normalized, flags=re.IGNORECASE):
        return False
    return ".." not in normalized.split("/")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalog(project_root: Path) -> list[dict[str, Any]]:
    catalog = load_json(project_root / CATALOG_PATH)
    assets = catalog.get("assets", [])
    if not isinstance(assets, list):
        raise RuntimeError(f"{CATALOG_PATH.as_posix()} assets must be an array")
    return [asset for asset in assets if isinstance(asset, dict)]


def runtime_key_for_asset(asset: dict[str, Any]) -> str:
    asset_id = str(asset.get("id", "")).strip()
    source_path = str(asset.get("path", "")).replace("\\", "/").strip()
    source = str(asset.get("source", "")).strip()
    if source == "generated" and source_path.startswith("assets/generated/web/"):
        return Path(source_path).stem
    return asset_id


def validate_runtime_key(asset_id: str, runtime_key: str, result: RuntimeAssetExportResult) -> bool:
    if SAFE_RUNTIME_KEY.match(runtime_key):
        return True
    result.messages.append(f"Asset {asset_id} has invalid runtime key: {runtime_key}")
    return False


def visual_manifest_entry(asset: dict[str, Any], runtime_path: Path, width: int, height: int) -> dict[str, Any]:
    asset_id = str(asset.get("id", "")).strip()
    entry = {
        "id": asset_id,
        "name": asset.get("name"),
        "kind": asset.get("kind"),
        "source": asset.get("source"),
        "sourcePath": str(asset.get("path", "")).replace("\\", "/").strip(),
        "runtimeKey": runtime_key_for_asset(asset),
        "runtimePath": project_relative(runtime_path),
        "runtimeFormat": "bmp",
        "width": width,
        "height": height,
        "transparencyKey": TRANSPARENCY_KEY,
    }
    for key in ("frameWidth", "frameHeight", "frames"):
        if key in asset:
            entry[key] = asset[key]
    return entry


def audio_manifest_entry(asset: dict[str, Any]) -> dict[str, Any]:
    source_path = str(asset.get("path", "")).replace("\\", "/").strip()
    return {
        "id": str(asset.get("id", "")).strip(),
        "name": asset.get("name"),
        "kind": asset.get("kind"),
        "source": asset.get("source"),
        "sourcePath": source_path,
        "runtimeKey": str(asset.get("id", "")).strip(),
        "runtimePath": source_path,
        "runtimeFormat": "wav",
    }


def write_runtime_bmp(source: Path, target: Path) -> tuple[int, int]:
    with Image.open(source) as opened:
        rgba = opened.convert("RGBA")
        bmp = Image.new("RGB", rgba.size, MAGENTA)
        bmp.paste(rgba.convert("RGB"), mask=rgba.getchannel("A"))
        target.parent.mkdir(parents=True, exist_ok=True)
        bmp.save(target)
        return rgba.size


def export_runtime_assets(project_root: str | Path = REPO_ROOT) -> RuntimeAssetExportResult:
    root = Path(project_root)
    result = RuntimeAssetExportResult()
    manifest_assets: list[dict[str, Any]] = []

    try:
        assets = load_catalog(root)
    except Exception as exc:
        return RuntimeAssetExportResult([f"Could not read asset catalog: {exc}"])

    for asset in assets:
        asset_id = str(asset.get("id", "")).strip()
        kind = str(asset.get("kind", "")).strip()
        source_path = str(asset.get("path", "")).replace("\\", "/").strip()
        if not asset_id:
            result.messages.append("Skipping asset with missing id")
            continue
        if not source_path or not is_safe_project_relative_path(source_path):
            result.messages.append(f"Asset {asset_id} has unsafe or empty source path: {source_path}")
            continue

        source = root / source_path
        if kind == "audio":
            if source.suffix.lower() != ".wav":
                result.messages.append(f"Audio asset {asset_id} is not a WAV runtime asset: {source_path}")
            if not source.is_file():
                result.messages.append(f"Audio asset {asset_id} file not found: {source_path}")
            manifest_assets.append(audio_manifest_entry(asset))
            continue

        if kind not in VISUAL_KINDS:
            result.messages.append(f"Asset {asset_id} has unsupported runtime export kind: {kind}")
            continue
        if source.suffix.lower() not in IMAGE_EXTENSIONS:
            result.messages.append(f"Asset {asset_id} has unsupported runtime image extension: {source_path}")
            continue
        if not source.is_file():
            result.messages.append(f"Asset {asset_id} source file not found: {source_path}")
            continue

        runtime_key = runtime_key_for_asset(asset)
        if not validate_runtime_key(asset_id, runtime_key, result):
            continue
        runtime_path = RUNTIME_DIR / f"{runtime_key}.bmp"
        try:
            width, height = write_runtime_bmp(source, root / runtime_path)
        except Exception as exc:
            result.messages.append(f"Asset {asset_id} export failed: {exc}")
            continue
        manifest_assets.append(visual_manifest_entry(asset, runtime_path, width, height))

    manifest = {
        "schemaVersion": 1,
        "pipeline": "rpgcreatorai-runtime-asset-export-v1",
        "outputRoot": RUNTIME_DIR.as_posix(),
        "rules": {
            "visualRuntimeDir": RUNTIME_DIR.as_posix(),
            "visualRuntimeFormat": "bmp",
            "audioRuntimeFormat": "wav",
        },
        "transparencyKey": TRANSPARENCY_KEY,
        "assets": manifest_assets,
    }
    manifest_target = root / MANIFEST_PATH
    manifest_target.parent.mkdir(parents=True, exist_ok=True)
    manifest_target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return result


def validate_runtime_outputs(project_root: str | Path = REPO_ROOT) -> RuntimeAssetExportResult:
    root = Path(project_root)
    manifest_path = root / MANIFEST_PATH
    if not manifest_path.is_file():
        return RuntimeAssetExportResult([f"Runtime asset manifest not found: {MANIFEST_PATH.as_posix()}"])

    try:
        manifest = load_json(manifest_path)
    except Exception as exc:
        return RuntimeAssetExportResult([f"Could not read runtime asset manifest: {exc}"])

    result = RuntimeAssetExportResult()
    if manifest.get("schemaVersion") != 1:
        result.messages.append("Runtime asset manifest schemaVersion must be 1")
    if manifest.get("transparencyKey") != TRANSPARENCY_KEY:
        result.messages.append(f"Runtime asset manifest transparencyKey must be {TRANSPARENCY_KEY}")

    assets = manifest.get("assets", [])
    if not isinstance(assets, list):
        result.messages.append("Runtime asset manifest assets must be an array")
        return result

    for entry in assets:
        if not isinstance(entry, dict):
            result.messages.append("Runtime asset manifest contains a non-object entry")
            continue
        asset_id = str(entry.get("id", "")).strip()
        runtime_path = str(entry.get("runtimePath", "")).replace("\\", "/").strip()
        runtime_format = str(entry.get("runtimeFormat", "")).strip()
        if not asset_id:
            result.messages.append("Runtime asset manifest entry is missing id")
            continue
        if not is_safe_project_relative_path(runtime_path):
            result.messages.append(f"Runtime asset {asset_id} has unsafe runtime path: {runtime_path}")
            continue
        if runtime_format == "bmp" and Path(runtime_path).suffix.lower() != ".bmp":
            result.messages.append(f"Runtime asset {asset_id} must use a .bmp runtime output")
        if runtime_format == "wav" and Path(runtime_path).suffix.lower() != ".wav":
            result.messages.append(f"Runtime asset {asset_id} must use a .wav runtime output")
        if not (root / runtime_path).is_file():
            result.messages.append(f"Missing runtime output for asset {asset_id}: {runtime_path}")

    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export and validate runtime-ready RPGCreatorAI assets.")
    parser.add_argument(
        "--project-root",
        default=str(REPO_ROOT),
        help="Project root containing data/assets/catalog.json.",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Only validate data/assets/runtime-manifest.json and referenced outputs.",
    )
    args = parser.parse_args(argv)

    root = Path(args.project_root)
    result = validate_runtime_outputs(root) if args.validate_only else export_runtime_assets(root)
    if result.ok and not args.validate_only:
        result = validate_runtime_outputs(root)

    if result.ok:
        print("Runtime asset export validation passed.")
        return 0

    for message in result.messages:
        print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

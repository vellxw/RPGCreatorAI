from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from PIL import Image, ImageSequence


REPO_ROOT = Path(__file__).resolve().parents[2]
PIPELINE_ID = "rpgcreatorai-animation-preview-generation-v1"
NORMALIZATION_PIPELINE_ID = "rpgcreatorai-animation-strip-normalization-v1"
PREVIEW_OUT_DIR = Path("docs/screenshots/phase11-animation-preview")
MANIFEST_OUT_DIR = Path("assets/generated/source/phase11_animation_previews")
PREVIEW_BACKGROUND = (34, 36, 46, 255)


class AnimationPreviewGenerationResult:
    def __init__(self, messages: list[str] | None = None, manifest_path: Path | None = None) -> None:
        self.messages = list(messages or [])
        self.manifest_path = manifest_path

    @property
    def ok(self) -> bool:
        return not self.messages


def normalize_relative_path(value: str | Path) -> str:
    return str(value).replace("\\", "/").strip()


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


def resolve_project_relative(root: Path, value: str | Path) -> tuple[Path, str] | None:
    raw = normalize_relative_path(value)
    path = Path(raw)
    if path.is_absolute():
        try:
            relative = path.resolve().relative_to(root.resolve())
        except ValueError:
            return None
        relative_path = relative.as_posix()
    else:
        relative_path = raw

    if not is_safe_project_relative_path(relative_path):
        return None
    return root / relative_path, relative_path


def project_relative(path: Path) -> str:
    return path.as_posix()


def frame_alpha_is_nonempty(image: Image.Image) -> bool:
    extrema = image.convert("RGBA").getchannel("A").getextrema()
    return bool(extrema and extrema[1] > 0)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_normalization_manifest(
    root: Path,
    normalization_manifest: str | Path,
    messages: list[str],
) -> tuple[dict[str, Any], str] | None:
    resolved = resolve_project_relative(root, normalization_manifest)
    if resolved is None:
        messages.append(f"Normalization manifest must stay inside the project: {normalization_manifest}")
        return None

    manifest_path, relative_manifest_path = resolved
    if not manifest_path.is_file():
        messages.append(f"Normalization manifest not found: {relative_manifest_path}")
        return None

    try:
        manifest = load_json(manifest_path)
    except Exception as exc:
        messages.append(f"Could not read normalization manifest {relative_manifest_path}: {exc}")
        return None

    if manifest.get("schemaVersion") != 1:
        messages.append("Normalization manifest schemaVersion must be 1")
    if manifest.get("pipeline") != NORMALIZATION_PIPELINE_ID:
        messages.append(f"Normalization manifest pipeline must be {NORMALIZATION_PIPELINE_ID}")
    return manifest, relative_manifest_path


def manifest_int(manifest: dict[str, Any], key: str, messages: list[str]) -> int | None:
    value = manifest.get(key)
    if not isinstance(value, int) or value <= 0:
        messages.append(f"Normalization manifest {key} must be a positive integer")
        return None
    return value


def load_source_strip(
    root: Path,
    source_path: str,
    frame_width: int,
    frame_height: int,
    frame_count: int,
    messages: list[str],
) -> Image.Image | None:
    if not is_safe_project_relative_path(source_path):
        messages.append(f"Source strip path must be project-relative and safe: {source_path}")
        return None
    target = root / source_path
    if not target.is_file():
        messages.append(f"Source strip not found: {source_path}")
        return None
    try:
        image = Image.open(target).convert("RGBA")
    except Exception as exc:
        messages.append(f"Could not read source strip {source_path}: {exc}")
        return None
    expected_size = (frame_width * frame_count, frame_height)
    if image.size != expected_size:
        messages.append(f"Source strip has size {image.size}, expected {expected_size}")
        return None
    return image


def extract_preview_frames(
    image: Image.Image,
    *,
    output_id: str,
    frame_width: int,
    frame_height: int,
    frame_count: int,
    preview_scale: int,
    messages: list[str],
) -> list[Image.Image] | None:
    frames: list[Image.Image] = []
    for index in range(frame_count):
        frame = image.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height)).convert("RGBA")
        if not frame_alpha_is_nonempty(frame):
            messages.append(f"{output_id} preview frame {index + 1} is empty")
            return None
        scaled = frame.resize((frame_width * preview_scale, frame_height * preview_scale), Image.Resampling.NEAREST)
        background = Image.new("RGBA", scaled.size, PREVIEW_BACKGROUND)
        background.alpha_composite(scaled, (0, 0))
        frames.append(background.convert("RGB"))
    return frames


def write_preview_sheet(frames: list[Image.Image], target: Path) -> None:
    if not frames:
        raise RuntimeError("No frames supplied for preview sheet")
    sheet = Image.new("RGB", (frames[0].width * len(frames), frames[0].height), PREVIEW_BACKGROUND[:3])
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index * frame.width, 0))
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target)


def write_preview_gif(frames: list[Image.Image], target: Path, *, duration_ms: int, loop: bool) -> None:
    if not frames:
        raise RuntimeError("No frames supplied for preview gif")
    target.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        target,
        save_all=True,
        append_images=frames[1:],
        duration=duration_ms,
        loop=0 if loop else 1,
        disposal=2,
        optimize=False,
    )


def write_preview_manifest(
    root: Path,
    *,
    output_id: str,
    normalization_manifest_path: str,
    normalization_manifest: dict[str, Any],
    source_strip: str,
    preview_scale: int,
    duration_ms: int,
    outputs: dict[str, str],
    manifest_out_dir: Path,
) -> Path:
    manifest_path = manifest_out_dir / f"{output_id}.json"
    frame_size = normalization_manifest.get("frameSize", {})
    manifest = {
        "schemaVersion": 1,
        "pipeline": PIPELINE_ID,
        "id": output_id,
        "name": normalization_manifest.get("name", output_id),
        "action": normalization_manifest.get("action"),
        "direction": normalization_manifest.get("direction"),
        "sourceNormalizationManifest": normalization_manifest_path,
        "sourceStrip": source_strip,
        "sourceAssetId": normalization_manifest.get("sourceAssetId"),
        "sourceConceptId": normalization_manifest.get("sourceConceptId"),
        "frameSize": frame_size,
        "frameCount": normalization_manifest.get("frameCount"),
        "fps": normalization_manifest.get("fps"),
        "loop": normalization_manifest.get("loop"),
        "anchor": normalization_manifest.get("anchor"),
        "preview": {
            "scale": preview_scale,
            "durationMs": duration_ms,
            "background": "#22242e",
        },
        "runtimeDependency": False,
        "outputs": outputs,
    }
    target = root / manifest_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return target


def generate_animation_preview(
    project_root: str | Path = REPO_ROOT,
    *,
    normalization_manifest: str | Path,
    preview_scale: int = 2,
    preview_out_dir: str | Path = PREVIEW_OUT_DIR,
    manifest_out_dir: str | Path = MANIFEST_OUT_DIR,
) -> AnimationPreviewGenerationResult:
    root = Path(project_root)
    messages: list[str] = []

    if not isinstance(preview_scale, int) or preview_scale <= 0:
        messages.append("preview_scale must be a positive integer")
    if not is_safe_project_relative_path(normalize_relative_path(preview_out_dir)):
        messages.append(f"preview_out_dir must be a safe project-relative path: {preview_out_dir}")
    if not is_safe_project_relative_path(normalize_relative_path(manifest_out_dir)):
        messages.append(f"manifest_out_dir must be a safe project-relative path: {manifest_out_dir}")
    if messages:
        return AnimationPreviewGenerationResult(messages)

    loaded = load_normalization_manifest(root, normalization_manifest, messages)
    if loaded is None or messages:
        return AnimationPreviewGenerationResult(messages)
    source_manifest, relative_manifest_path = loaded

    output_id = str(source_manifest.get("id", "")).strip()
    if not re.match(r"^[A-Za-z][A-Za-z0-9_-]{0,127}$", output_id):
        return AnimationPreviewGenerationResult([f"Normalization manifest id is invalid: {output_id}"])

    frame_size = source_manifest.get("frameSize")
    if not isinstance(frame_size, dict):
        return AnimationPreviewGenerationResult(["Normalization manifest frameSize must be an object"])
    frame_width = frame_size.get("width")
    frame_height = frame_size.get("height")
    if not isinstance(frame_width, int) or frame_width <= 0:
        messages.append("Normalization manifest frameSize.width must be a positive integer")
    if not isinstance(frame_height, int) or frame_height <= 0:
        messages.append("Normalization manifest frameSize.height must be a positive integer")
    frame_count = manifest_int(source_manifest, "frameCount", messages)
    fps = manifest_int(source_manifest, "fps", messages)
    loop = source_manifest.get("loop")
    if not isinstance(loop, bool):
        messages.append("Normalization manifest loop must be boolean")
    if messages:
        return AnimationPreviewGenerationResult(messages)

    outputs = source_manifest.get("outputs")
    if not isinstance(outputs, dict) or not isinstance(outputs.get("webPng"), str):
        return AnimationPreviewGenerationResult(["Normalization manifest outputs.webPng is required"])
    source_strip = outputs["webPng"]
    strip = load_source_strip(root, source_strip, frame_width, frame_height, frame_count, messages)
    if strip is None:
        return AnimationPreviewGenerationResult(messages)

    frames = extract_preview_frames(
        strip,
        output_id=output_id,
        frame_width=frame_width,
        frame_height=frame_height,
        frame_count=frame_count,
        preview_scale=preview_scale,
        messages=messages,
    )
    if frames is None:
        return AnimationPreviewGenerationResult(messages)

    preview_dir = Path(normalize_relative_path(preview_out_dir))
    preview_gif = preview_dir / f"{output_id}.gif"
    preview_sheet = preview_dir / f"{output_id}_sheet.png"
    duration_ms = max(1, round(1000 / fps))

    write_preview_sheet(frames, root / preview_sheet)
    write_preview_gif(frames, root / preview_gif, duration_ms=duration_ms, loop=loop)

    manifest_path = write_preview_manifest(
        root,
        output_id=output_id,
        normalization_manifest_path=relative_manifest_path,
        normalization_manifest=source_manifest,
        source_strip=source_strip,
        preview_scale=preview_scale,
        duration_ms=duration_ms,
        outputs={
            "previewGif": project_relative(preview_gif),
            "previewSheetPng": project_relative(preview_sheet),
        },
        manifest_out_dir=Path(normalize_relative_path(manifest_out_dir)),
    )

    validation = validate_animation_preview_outputs(root, manifest_path)
    if not validation.ok:
        return AnimationPreviewGenerationResult(validation.messages, manifest_path=manifest_path)
    return AnimationPreviewGenerationResult(manifest_path=manifest_path)


def validate_animation_preview_outputs(
    project_root: str | Path = REPO_ROOT,
    preview_manifest: str | Path | None = None,
) -> AnimationPreviewGenerationResult:
    root = Path(project_root)
    messages: list[str] = []
    if preview_manifest is None:
        return AnimationPreviewGenerationResult(["preview_manifest is required"])

    resolved = resolve_project_relative(root, preview_manifest)
    if resolved is None:
        return AnimationPreviewGenerationResult([f"Preview manifest must stay inside the project: {preview_manifest}"])
    manifest_path, relative_manifest_path = resolved
    if not manifest_path.is_file():
        return AnimationPreviewGenerationResult([f"Animation preview manifest not found: {relative_manifest_path}"])

    try:
        manifest = load_json(manifest_path)
    except Exception as exc:
        return AnimationPreviewGenerationResult([f"Could not read animation preview manifest: {exc}"])

    if manifest.get("schemaVersion") != 1:
        messages.append("Animation preview manifest schemaVersion must be 1")
    if manifest.get("pipeline") != PIPELINE_ID:
        messages.append(f"Animation preview manifest pipeline must be {PIPELINE_ID}")
    if manifest.get("runtimeDependency") is not False:
        messages.append("Animation preview manifest runtimeDependency must be false")

    frame_size = manifest.get("frameSize")
    if not isinstance(frame_size, dict):
        messages.append("Animation preview manifest frameSize must be an object")
        return AnimationPreviewGenerationResult(messages)
    frame_width = frame_size.get("width")
    frame_height = frame_size.get("height")
    frame_count = manifest.get("frameCount")
    fps = manifest.get("fps")
    preview = manifest.get("preview")
    outputs = manifest.get("outputs")
    if not isinstance(frame_width, int) or frame_width <= 0:
        messages.append("Animation preview manifest frameSize.width must be a positive integer")
    if not isinstance(frame_height, int) or frame_height <= 0:
        messages.append("Animation preview manifest frameSize.height must be a positive integer")
    if not isinstance(frame_count, int) or frame_count <= 0:
        messages.append("Animation preview manifest frameCount must be a positive integer")
    if not isinstance(fps, int) or fps <= 0:
        messages.append("Animation preview manifest fps must be a positive integer")
    if not isinstance(preview, dict) or not isinstance(preview.get("scale"), int) or preview.get("scale") <= 0:
        messages.append("Animation preview manifest preview.scale must be a positive integer")
    if not isinstance(outputs, dict):
        messages.append("Animation preview manifest outputs must be an object")
    if messages:
        return AnimationPreviewGenerationResult(messages)

    preview_scale = preview["scale"]
    expected_sheet_size = (frame_width * frame_count * preview_scale, frame_height * preview_scale)
    expected_gif_size = (frame_width * preview_scale, frame_height * preview_scale)

    for key in ("previewGif", "previewSheetPng"):
        value = outputs.get(key)
        if not isinstance(value, str) or not is_safe_project_relative_path(value):
            messages.append(f"Animation preview output {key} must be a safe project-relative path")
            continue
        if value.startswith("assets/generated/runtime/"):
            messages.append(f"Animation preview output {key} must not be a runtime dependency path")

    if messages:
        return AnimationPreviewGenerationResult(messages)

    preview_gif = outputs["previewGif"]
    preview_sheet = outputs["previewSheetPng"]
    gif_path = root / preview_gif
    sheet_path = root / preview_sheet
    if not gif_path.is_file():
        messages.append(f"Missing animation preview output previewGif: {preview_gif}")
    else:
        try:
            with Image.open(gif_path) as image:
                if image.size != expected_gif_size:
                    messages.append(f"Animation preview GIF has size {image.size}, expected {expected_gif_size}")
                frames = [frame.copy() for frame in ImageSequence.Iterator(image)]
                if len(frames) != frame_count:
                    messages.append(f"Animation preview GIF frame count {len(frames)} must equal {frame_count}")
                duration = image.info.get("duration")
                if not isinstance(duration, int) or duration <= 0:
                    messages.append("Animation preview GIF duration must be positive")
        except Exception as exc:
            messages.append(f"Could not read animation preview GIF {preview_gif}: {exc}")

    if not sheet_path.is_file():
        messages.append(f"Missing animation preview output previewSheetPng: {preview_sheet}")
    else:
        try:
            with Image.open(sheet_path) as image:
                if image.convert("RGBA").size != expected_sheet_size:
                    messages.append(f"Animation preview sheet has size {image.size}, expected {expected_sheet_size}")
        except Exception as exc:
            messages.append(f"Could not read animation preview sheet {preview_sheet}: {exc}")

    return AnimationPreviewGenerationResult(messages, manifest_path=manifest_path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate or validate animation preview GIF/sheet evidence.")
    parser.add_argument("--project-root", default=str(REPO_ROOT))
    parser.add_argument("--manifest", help="Normalization manifest to preview.")
    parser.add_argument("--preview-scale", type=int, default=2)
    parser.add_argument("--preview-out-dir", default=PREVIEW_OUT_DIR.as_posix())
    parser.add_argument("--manifest-out-dir", default=MANIFEST_OUT_DIR.as_posix())
    parser.add_argument("--validate-preview-manifest", help="Validate an existing preview manifest instead of writing outputs.")
    args = parser.parse_args(argv)

    if args.validate_preview_manifest:
        result = validate_animation_preview_outputs(args.project_root, args.validate_preview_manifest)
    else:
        if not args.manifest:
            parser.error("--manifest is required unless --validate-preview-manifest is used")
        result = generate_animation_preview(
            args.project_root,
            normalization_manifest=args.manifest,
            preview_scale=args.preview_scale,
            preview_out_dir=args.preview_out_dir,
            manifest_out_dir=args.manifest_out_dir,
        )

    if result.ok:
        print("Animation preview generation validation passed.")
        if result.manifest_path:
            print(f"Manifest: {result.manifest_path}")
        return 0

    for message in result.messages:
        print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_OUT_DIR = Path("assets/generated/web")
EDITOR_OUT_DIR = Path("src/assets/generated")
RUNTIME_OUT_DIR = Path("assets/generated/runtime")
MANIFEST_OUT_DIR = Path("assets/generated/source/phase11_animation_normalization")
PIPELINE_ID = "rpgcreatorai-animation-strip-normalization-v1"
TRANSPARENCY_KEY = "#ff00ff"
MAGENTA = (255, 0, 255)
SAFE_ID = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,127}$")
VALID_DIRECTIONS = {"down", "left", "right", "up", "any"}


class AnimationStripNormalizationResult:
    def __init__(self, messages: list[str] | None = None, manifest_path: Path | None = None) -> None:
        self.messages = list(messages or [])
        self.manifest_path = manifest_path

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


def normalize_relative_path(value: str | Path) -> str:
    return str(value).replace("\\", "/").strip()


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


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").getbbox()


def frame_alpha_is_nonempty(image: Image.Image) -> bool:
    extrema = image.getchannel("A").getextrema()
    return bool(extrema and extrema[1] > 0)


def validate_positive_int(name: str, value: int, messages: list[str]) -> None:
    if not isinstance(value, int) or value <= 0:
        messages.append(f"{name} must be a positive integer")


def validate_request(
    *,
    input_path: str | Path,
    output_id: str,
    action: str,
    direction: str,
    frame_width: int,
    frame_height: int,
    frame_count: int,
    fps: int,
    loop: bool,
    anchor: dict[str, int],
    web_out_dir: str | Path,
    editor_out_dir: str | Path,
    runtime_out_dir: str | Path,
    manifest_out_dir: str | Path,
) -> list[str]:
    messages: list[str] = []
    if not is_safe_project_relative_path(normalize_relative_path(input_path)):
        # Absolute paths are checked separately by resolve_project_relative.
        if not Path(normalize_relative_path(input_path)).is_absolute():
            messages.append(f"Input path must be project-relative and safe: {input_path}")
    if not SAFE_ID.match(output_id):
        messages.append(f"output_id must match {SAFE_ID.pattern}: {output_id}")
    if not str(action).strip():
        messages.append("action is required")
    if direction not in VALID_DIRECTIONS:
        messages.append(f"direction must be one of {sorted(VALID_DIRECTIONS)}")
    validate_positive_int("frame_width", frame_width, messages)
    validate_positive_int("frame_height", frame_height, messages)
    validate_positive_int("frame_count", frame_count, messages)
    validate_positive_int("fps", fps, messages)
    if not isinstance(loop, bool):
        messages.append("loop must be a boolean")

    anchor_x = anchor.get("x")
    anchor_y = anchor.get("y")
    if not isinstance(anchor_x, int) or not isinstance(anchor_y, int):
        messages.append("anchor must include integer x and y")
    elif frame_width > 0 and frame_height > 0:
        if anchor_x < 0 or anchor_x >= frame_width:
            messages.append(f"anchor.x must be between 0 and {frame_width - 1}")
        if anchor_y <= 0 or anchor_y >= frame_height:
            messages.append(f"anchor.y must be between 1 and {frame_height - 1}")

    for label, directory in (
        ("web_out_dir", web_out_dir),
        ("editor_out_dir", editor_out_dir),
        ("runtime_out_dir", runtime_out_dir),
        ("manifest_out_dir", manifest_out_dir),
    ):
        if not is_safe_project_relative_path(normalize_relative_path(directory)):
            messages.append(f"{label} must be a safe project-relative path: {directory}")

    return messages


def load_source_strip(root: Path, input_path: str | Path, messages: list[str]) -> tuple[Image.Image, str] | None:
    resolved = resolve_project_relative(root, input_path)
    if resolved is None:
        messages.append(f"Input path must stay inside the project: {input_path}")
        return None

    source_path, relative_path = resolved
    if not source_path.is_file():
        messages.append(f"Input strip not found: {relative_path}")
        return None

    try:
        opened = Image.open(source_path)
        return opened.convert("RGBA"), relative_path
    except Exception as exc:
        messages.append(f"Could not read input strip {relative_path}: {exc}")
        return None


def build_normalized_strip(
    *,
    image: Image.Image,
    output_id: str,
    frame_width: int,
    frame_height: int,
    frame_count: int,
    anchor: dict[str, int],
    messages: list[str],
) -> tuple[Image.Image, list[dict[str, Any]], float] | None:
    if image.width % frame_count != 0:
        messages.append(f"Input width {image.width} must be divisible by frame count {frame_count}")
        return None
    if image.height <= 0:
        messages.append("Input height must be positive")
        return None

    source_frame_width = image.width // frame_count
    if source_frame_width <= 0:
        messages.append("Input source frame width must be positive")
        return None

    alpha_min, alpha_max = image.getchannel("A").getextrema()
    if alpha_max == 0:
        messages.append("Input strip is fully transparent")
        return None
    if alpha_min == 255:
        messages.append("Input strip must preserve transparent background pixels")
        return None

    source_frames: list[dict[str, Any]] = []
    bboxes: list[tuple[int, int, int, int]] = []
    max_bbox_width = 0
    max_bbox_height = 0

    for index in range(frame_count):
        frame = image.crop((index * source_frame_width, 0, (index + 1) * source_frame_width, image.height))
        bbox = alpha_bbox(frame)
        if bbox is None:
            messages.append(f"{output_id} frame {index + 1} is empty")
            return None
        x0, y0, x1, y1 = bbox
        bbox_width = x1 - x0
        bbox_height = y1 - y0
        max_bbox_width = max(max_bbox_width, bbox_width)
        max_bbox_height = max(max_bbox_height, bbox_height)
        bboxes.append(bbox)
        source_frames.append(
            {
                "index": index + 1,
                "sourceBounds": {
                    "x": x0,
                    "y": y0,
                    "width": bbox_width,
                    "height": bbox_height,
                },
            }
        )

    anchor_x = anchor["x"]
    anchor_y = anchor["y"]
    horizontal_space = max(1, 2 * min(anchor_x, frame_width - anchor_x))
    vertical_space = max(1, anchor_y)
    scale = min(1.0, horizontal_space / max_bbox_width, vertical_space / max_bbox_height)
    if scale <= 0:
        messages.append("Could not compute a positive shared frame scale")
        return None

    normalized = Image.new("RGBA", (frame_width * frame_count, frame_height), (0, 0, 0, 0))
    for index, bbox in enumerate(bboxes):
        frame = image.crop((index * source_frame_width, 0, (index + 1) * source_frame_width, image.height))
        crop = frame.crop(bbox)
        target_width = max(1, round(crop.width * scale))
        target_height = max(1, round(crop.height * scale))
        resized = crop.resize((target_width, target_height), Image.Resampling.NEAREST)
        left = round(anchor_x - target_width / 2)
        top = round(anchor_y - target_height)
        right = left + target_width
        bottom = top + target_height
        if left < 0 or top < 0 or right > frame_width or bottom > frame_height:
            messages.append(
                f"{output_id} frame {index + 1} does not fit normalized frame "
                f"{frame_width}x{frame_height} at anchor ({anchor_x}, {anchor_y})"
            )
            return None
        normalized.alpha_composite(resized, (index * frame_width + left, top))
        source_frames[index]["normalizedBounds"] = {
            "x": left,
            "y": top,
            "width": target_width,
            "height": target_height,
        }

    for index in range(frame_count):
        frame = normalized.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height))
        if not frame_alpha_is_nonempty(frame):
            messages.append(f"{output_id} normalized frame {index + 1} is empty")
            return None

    return normalized, source_frames, scale


def save_runtime_bmp(strip: Image.Image, target: Path) -> None:
    bmp = Image.new("RGB", strip.size, MAGENTA)
    bmp.paste(strip.convert("RGB"), mask=strip.getchannel("A"))
    target.parent.mkdir(parents=True, exist_ok=True)
    bmp.save(target)


def write_outputs(
    root: Path,
    strip: Image.Image,
    *,
    output_id: str,
    web_out_dir: Path,
    editor_out_dir: Path,
    runtime_out_dir: Path,
) -> dict[str, str]:
    web_path = web_out_dir / f"{output_id}.png"
    editor_path = editor_out_dir / f"{output_id}.png"
    runtime_path = runtime_out_dir / f"{output_id}.bmp"

    for target in (web_path, editor_path):
        absolute = root / target
        absolute.parent.mkdir(parents=True, exist_ok=True)
        strip.save(absolute)
    save_runtime_bmp(strip, root / runtime_path)

    return {
        "webPng": project_relative(web_path),
        "editorPng": project_relative(editor_path),
        "runtimeBmp": project_relative(runtime_path),
    }


def write_manifest(
    root: Path,
    *,
    output_id: str,
    name: str,
    action: str,
    direction: str,
    frame_width: int,
    frame_height: int,
    frame_count: int,
    source_frame_width: int,
    source_frame_height: int,
    fps: int,
    loop: bool,
    anchor: dict[str, int],
    source_path: str,
    source_asset_id: str | None,
    source_concept_id: str | None,
    source_frames: list[dict[str, Any]],
    scale: float,
    outputs: dict[str, str],
    manifest_out_dir: Path,
) -> Path:
    manifest_path = manifest_out_dir / f"{output_id}.json"
    manifest = {
        "schemaVersion": 1,
        "pipeline": PIPELINE_ID,
        "id": output_id,
        "name": name,
        "action": action,
        "direction": direction,
        "sourcePath": source_path,
        "sourceAssetId": source_asset_id,
        "sourceConceptId": source_concept_id,
        "frameSize": {"width": frame_width, "height": frame_height},
        "sourceFrameSize": {"width": source_frame_width, "height": source_frame_height},
        "frameCount": frame_count,
        "fps": fps,
        "loop": loop,
        "anchor": {"x": anchor["x"], "y": anchor["y"]},
        "normalization": {
            "sharedScale": round(scale, 6),
            "anchorRule": "bottom-center",
            "layout": "horizontal-strip",
        },
        "transparency": {
            "pngBackground": "alpha",
            "runtimeBmpTransparencyKey": TRANSPARENCY_KEY,
        },
        "sourceFrames": source_frames,
        "outputs": outputs,
    }
    target = root / manifest_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return target


def normalize_animation_strip(
    project_root: str | Path = REPO_ROOT,
    *,
    input_path: str | Path,
    output_id: str,
    name: str,
    action: str,
    direction: str,
    frame_width: int,
    frame_height: int,
    frame_count: int,
    fps: int,
    loop: bool,
    anchor: dict[str, int],
    source_asset_id: str | None = None,
    source_concept_id: str | None = None,
    web_out_dir: str | Path = WEB_OUT_DIR,
    editor_out_dir: str | Path = EDITOR_OUT_DIR,
    runtime_out_dir: str | Path = RUNTIME_OUT_DIR,
    manifest_out_dir: str | Path = MANIFEST_OUT_DIR,
) -> AnimationStripNormalizationResult:
    root = Path(project_root)
    messages = validate_request(
        input_path=input_path,
        output_id=output_id,
        action=action,
        direction=direction,
        frame_width=frame_width,
        frame_height=frame_height,
        frame_count=frame_count,
        fps=fps,
        loop=loop,
        anchor=anchor,
        web_out_dir=web_out_dir,
        editor_out_dir=editor_out_dir,
        runtime_out_dir=runtime_out_dir,
        manifest_out_dir=manifest_out_dir,
    )
    if messages:
        return AnimationStripNormalizationResult(messages)

    loaded = load_source_strip(root, input_path, messages)
    if loaded is None:
        return AnimationStripNormalizationResult(messages)
    image, relative_source_path = loaded

    built = build_normalized_strip(
        image=image,
        output_id=output_id,
        frame_width=frame_width,
        frame_height=frame_height,
        frame_count=frame_count,
        anchor=anchor,
        messages=messages,
    )
    if built is None:
        return AnimationStripNormalizationResult(messages)
    strip, source_frames, scale = built

    web_dir = Path(normalize_relative_path(web_out_dir))
    editor_dir = Path(normalize_relative_path(editor_out_dir))
    runtime_dir = Path(normalize_relative_path(runtime_out_dir))
    manifest_dir = Path(normalize_relative_path(manifest_out_dir))

    outputs = write_outputs(
        root,
        strip,
        output_id=output_id,
        web_out_dir=web_dir,
        editor_out_dir=editor_dir,
        runtime_out_dir=runtime_dir,
    )
    manifest_path = write_manifest(
        root,
        output_id=output_id,
        name=name,
        action=action,
        direction=direction,
        frame_width=frame_width,
        frame_height=frame_height,
        frame_count=frame_count,
        source_frame_width=image.width // frame_count,
        source_frame_height=image.height,
        fps=fps,
        loop=loop,
        anchor=anchor,
        source_path=relative_source_path,
        source_asset_id=source_asset_id,
        source_concept_id=source_concept_id,
        source_frames=source_frames,
        scale=scale,
        outputs=outputs,
        manifest_out_dir=manifest_dir,
    )

    validation = validate_normalized_strip_outputs(root, manifest_path)
    if not validation.ok:
        return AnimationStripNormalizationResult(validation.messages, manifest_path=manifest_path)
    return AnimationStripNormalizationResult(manifest_path=manifest_path)


def validate_png_output(root: Path, path: str, frame_width: int, frame_height: int, frame_count: int, label: str, messages: list[str]) -> None:
    target = root / path
    if not target.is_file():
        messages.append(f"Missing normalized output {label}: {path}")
        return
    try:
        with Image.open(target) as opened:
            image = opened.convert("RGBA")
            if image.size != (frame_width * frame_count, frame_height):
                messages.append(
                    f"Normalized output {label} has size {image.size}, expected {(frame_width * frame_count, frame_height)}"
                )
                return
            for index in range(frame_count):
                frame = image.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height))
                if not frame_alpha_is_nonempty(frame):
                    messages.append(f"Normalized output {label} frame {index + 1} is empty")
    except Exception as exc:
        messages.append(f"Could not read normalized output {label}: {path}: {exc}")


def validate_bmp_output(root: Path, path: str, frame_width: int, frame_height: int, frame_count: int, label: str, messages: list[str]) -> None:
    target = root / path
    if not target.is_file():
        messages.append(f"Missing normalized output {label}: {path}")
        return
    try:
        with Image.open(target) as opened:
            image = opened.convert("RGB")
            if image.size != (frame_width * frame_count, frame_height):
                messages.append(
                    f"Normalized output {label} has size {image.size}, expected {(frame_width * frame_count, frame_height)}"
                )
                return
            if image.getpixel((0, 0)) != MAGENTA:
                messages.append(f"Normalized output {label} must use {TRANSPARENCY_KEY} for transparent runtime pixels")
    except Exception as exc:
        messages.append(f"Could not read normalized output {label}: {path}: {exc}")


def validate_normalized_strip_outputs(
    project_root: str | Path = REPO_ROOT,
    manifest_path: str | Path | None = None,
) -> AnimationStripNormalizationResult:
    root = Path(project_root)
    messages: list[str] = []

    if manifest_path is None:
        messages.append("manifest_path is required")
        return AnimationStripNormalizationResult(messages)

    manifest_input = Path(manifest_path)
    if manifest_input.is_absolute():
        manifest_file = manifest_input
    else:
        manifest_file = root / manifest_input
    if not manifest_file.is_file():
        messages.append(f"Normalized strip manifest not found: {normalize_relative_path(manifest_path)}")
        return AnimationStripNormalizationResult(messages)

    try:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except Exception as exc:
        return AnimationStripNormalizationResult([f"Could not read normalized strip manifest: {exc}"])

    if manifest.get("schemaVersion") != 1:
        messages.append("Normalized strip manifest schemaVersion must be 1")
    if manifest.get("pipeline") != PIPELINE_ID:
        messages.append(f"Normalized strip manifest pipeline must be {PIPELINE_ID}")

    frame_size = manifest.get("frameSize")
    if not isinstance(frame_size, dict):
        messages.append("Normalized strip manifest frameSize must be an object")
        return AnimationStripNormalizationResult(messages)
    frame_width = frame_size.get("width")
    frame_height = frame_size.get("height")
    frame_count = manifest.get("frameCount")
    if not isinstance(frame_width, int) or frame_width <= 0:
        messages.append("Normalized strip manifest frameSize.width must be a positive integer")
    if not isinstance(frame_height, int) or frame_height <= 0:
        messages.append("Normalized strip manifest frameSize.height must be a positive integer")
    if not isinstance(frame_count, int) or frame_count <= 0:
        messages.append("Normalized strip manifest frameCount must be a positive integer")
    if messages:
        return AnimationStripNormalizationResult(messages)

    outputs = manifest.get("outputs")
    if not isinstance(outputs, dict):
        messages.append("Normalized strip manifest outputs must be an object")
        return AnimationStripNormalizationResult(messages)

    for key in ("webPng", "editorPng", "runtimeBmp"):
        value = outputs.get(key)
        if not isinstance(value, str) or not is_safe_project_relative_path(value):
            messages.append(f"Normalized strip manifest output {key} must be a safe project-relative path")

    source_frames = manifest.get("sourceFrames")
    if not isinstance(source_frames, list) or len(source_frames) != frame_count:
        messages.append("Normalized strip manifest sourceFrames must match frameCount")

    if messages:
        return AnimationStripNormalizationResult(messages)

    validate_png_output(root, outputs["webPng"], frame_width, frame_height, frame_count, "webPng", messages)
    validate_png_output(root, outputs["editorPng"], frame_width, frame_height, frame_count, "editorPng", messages)
    validate_bmp_output(root, outputs["runtimeBmp"], frame_width, frame_height, frame_count, "runtimeBmp", messages)
    return AnimationStripNormalizationResult(messages, manifest_path=manifest_file)


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError("expected true or false")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Normalize a generated/imported character strip into runtime-ready RPGCreatorAI outputs.")
    parser.add_argument("--project-root", default=str(REPO_ROOT))
    parser.add_argument("--input", dest="input_path", help="Project-relative source strip path.")
    parser.add_argument("--output-id", help="Runtime/editor-safe output id.")
    parser.add_argument("--name", default="")
    parser.add_argument("--action", default="idle")
    parser.add_argument("--direction", default="down", choices=sorted(VALID_DIRECTIONS))
    parser.add_argument("--frame-width", type=int, default=64)
    parser.add_argument("--frame-height", type=int, default=64)
    parser.add_argument("--frame-count", type=int, default=4)
    parser.add_argument("--fps", type=int, default=8)
    parser.add_argument("--loop", type=parse_bool, default=True)
    parser.add_argument("--anchor-x", type=int, default=32)
    parser.add_argument("--anchor-y", type=int, default=56)
    parser.add_argument("--source-asset-id")
    parser.add_argument("--source-concept-id")
    parser.add_argument("--web-out-dir", default=WEB_OUT_DIR.as_posix())
    parser.add_argument("--editor-out-dir", default=EDITOR_OUT_DIR.as_posix())
    parser.add_argument("--runtime-out-dir", default=RUNTIME_OUT_DIR.as_posix())
    parser.add_argument("--manifest-out-dir", default=MANIFEST_OUT_DIR.as_posix())
    parser.add_argument("--validate-manifest", help="Validate an existing normalization manifest instead of writing outputs.")
    args = parser.parse_args(argv)

    if args.validate_manifest:
        result = validate_normalized_strip_outputs(args.project_root, args.validate_manifest)
    else:
        if not args.input_path or not args.output_id:
            parser.error("--input and --output-id are required unless --validate-manifest is used")
        result = normalize_animation_strip(
            args.project_root,
            input_path=args.input_path,
            output_id=args.output_id,
            name=args.name or args.output_id,
            action=args.action,
            direction=args.direction,
            frame_width=args.frame_width,
            frame_height=args.frame_height,
            frame_count=args.frame_count,
            fps=args.fps,
            loop=args.loop,
            anchor={"x": args.anchor_x, "y": args.anchor_y},
            source_asset_id=args.source_asset_id,
            source_concept_id=args.source_concept_id,
            web_out_dir=args.web_out_dir,
            editor_out_dir=args.editor_out_dir,
            runtime_out_dir=args.runtime_out_dir,
            manifest_out_dir=args.manifest_out_dir,
        )

    if result.ok:
        print("Animation strip normalization validation passed.")
        if result.manifest_path:
            print(f"Manifest: {result.manifest_path}")
        return 0

    for message in result.messages:
        print(message, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

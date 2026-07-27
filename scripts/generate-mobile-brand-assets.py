from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
IOS_ICON_DIRS = [
    ROOT / "apps" / "ios" / "Sources" / "Assets.xcassets" / "AppIcon.appiconset",
    ROOT / "apps" / "ios" / "WatchApp" / "Assets.xcassets" / "AppIcon.appiconset",
]
IOS_MARK_DIRS = [
    ROOT / "apps" / "ios" / "Sources" / "Assets.xcassets" / "ZavorthIcon.imageset",
    ROOT / "apps" / "ios" / "WatchApp" / "Assets.xcassets" / "ZavorthIcon.imageset",
]
ANDROID_RES = ROOT / "apps" / "android" / "app" / "src" / "main" / "res"
MASTER_SIZE = 4096
GREEN = (0, 232, 143, 255)
BACKGROUND = (6, 8, 9, 255)


def rounded_line(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], width: int, fill: tuple[int, ...]) -> None:
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in points:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def render_full_icon() -> Image.Image:
    image = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), BACKGROUND)
    draw = ImageDraw.Draw(image, "RGBA")
    unit = MASTER_SIZE / 64
    draw.rounded_rectangle(
        (7 * unit, 7 * unit, 57 * unit, 57 * unit),
        radius=15 * unit,
        fill=(5, 35, 25, 255),
    )
    rounded_line(
        draw,
        [(19 * unit, 19 * unit), (47 * unit, 19 * unit), (24 * unit, 45 * unit), (52 * unit, 45 * unit)],
        round(7 * unit),
        GREEN,
    )
    draw.ellipse((42 * unit, 14 * unit, 50 * unit, 22 * unit), fill=GREEN)
    return image.convert("RGB")


def render_adaptive_foreground() -> Image.Image:
    image = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    unit = MASTER_SIZE / 108
    offset = 22 * unit
    scale = 64 * unit
    point = lambda x, y: (offset + x * scale / 64, offset + y * scale / 64)
    rounded_line(
        draw,
        [point(19, 19), point(47, 19), point(24, 45), point(52, 45)],
        round(7 * scale / 64),
        GREEN,
    )
    cx, cy = point(46, 18)
    radius = 4 * scale / 64
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=GREEN)
    return image


def rewrite_existing_pngs(directory: Path, source: Image.Image) -> int:
    count = 0
    for target in sorted(directory.glob("*.png")):
        with Image.open(target) as current:
            size = current.size
        source.resize(size, Image.Resampling.LANCZOS).save(target, format="PNG", optimize=True)
        count += 1
    return count


def main() -> None:
    full_icon = render_full_icon()
    adaptive_foreground = render_adaptive_foreground()
    written = sum(rewrite_existing_pngs(directory, full_icon) for directory in IOS_ICON_DIRS)
    written += sum(rewrite_existing_pngs(directory, adaptive_foreground) for directory in IOS_MARK_DIRS)
    for density_dir in sorted(ANDROID_RES.glob("mipmap-*dpi")):
        launcher = density_dir / "ic_launcher.png"
        foreground = density_dir / "ic_launcher_foreground.png"
        if launcher.exists():
            with Image.open(launcher) as current:
                size = current.size
            full_icon.resize(size, Image.Resampling.LANCZOS).save(launcher, format="PNG", optimize=True)
            written += 1
        if foreground.exists():
            with Image.open(foreground) as current:
                size = current.size
            adaptive_foreground.resize(size, Image.Resampling.LANCZOS).save(foreground, format="PNG", optimize=True)
            written += 1
    print(f"Generated {written} Zavorth mobile brand assets.")


if __name__ == "__main__":
    main()

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from PIL import Image, ImageOps

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_SIDE = 8000
TARGET_SIDE = 2048
READ_CHUNK = 64 * 1024
ALLOWED_FORMATS = ("JPEG", "PNG", "WEBP")

# Предел выше допустимых 8000x8000 Pillow считает декомпрессионной бомбой.
Image.MAX_IMAGE_PIXELS = MAX_SIDE * MAX_SIDE


class ImageTooLarge(Exception):
    pass


class ImageRejected(Exception):
    pass


@dataclass(frozen=True)
class StoredImage:
    file_key: str
    width: int
    height: int


def read_limited(stream: BinaryIO) -> bytes:
    """Читает файл кусками и останавливается сразу после превышения лимита."""
    buffer = bytearray()
    while chunk := stream.read(READ_CHUNK):
        buffer.extend(chunk)
        if len(buffer) > MAX_UPLOAD_BYTES:
            raise ImageTooLarge
    return bytes(buffer)


def store_image(data: bytes, media_dir: Path) -> StoredImage:
    try:
        with Image.open(BytesIO(data), formats=ALLOWED_FORMATS) as source:
            if source.width > MAX_SIDE or source.height > MAX_SIDE:
                raise ImageRejected
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError) as exc:
        raise ImageRejected from exc
    image.thumbnail((TARGET_SIDE, TARGET_SIDE), Image.Resampling.LANCZOS)
    file_key = uuid4().hex
    # save получает только параметры сжатия, поэтому EXIF, ICC и XMP в файл не попадают.
    image.save(media_dir / f"{file_key}.jpg", "JPEG", quality=85, optimize=True)
    return StoredImage(file_key=file_key, width=image.width, height=image.height)

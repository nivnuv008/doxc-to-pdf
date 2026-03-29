import logging
import os
import re
import socket
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


app = FastAPI(title="DOCX to PDF Converter")
logger = logging.getLogger("converter")
if not logging.getLogger().handlers:
    logging.basicConfig(level=logging.INFO)


ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:4200,http://127.0.0.1:4200",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversion-Engine"],
)


UNOSERVER_HOST = os.getenv("UNOSERVER_HOST", "127.0.0.1")
UNOSERVER_PORT = os.getenv("UNOSERVER_PORT", "2003")
LIBREOFFICE_BINARY = os.getenv("LIBREOFFICE_BINARY", "").strip()
PREFER_WORD_CONVERSION = os.getenv("PREFER_WORD_CONVERSION", "true").strip().lower() not in {"0", "false", "no"}
WORD_CONVERSION_TIMEOUT = int(os.getenv("WORD_CONVERSION_TIMEOUT", "75"))
UNOCONVERT_TIMEOUT = int(os.getenv("UNOCONVERT_TIMEOUT", "20"))
LIBREOFFICE_TIMEOUT = int(os.getenv("LIBREOFFICE_TIMEOUT", "90"))

ALLOWED_EXTENSIONS = {".doc", ".docx", ".odt", ".rtf", ".txt"}


def _resolve_libreoffice_binary() -> str | None:
    candidates = [
        LIBREOFFICE_BINARY,
        shutil.which("soffice") or "",
        shutil.which("libreoffice") or "",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ]

    for candidate in candidates:
        if not candidate:
            continue
        if Path(candidate).exists() or shutil.which(candidate):
            return candidate

    return None


def _build_download_header(filename: str) -> str:
    safe_ascii_name = re.sub(r'[^A-Za-z0-9._-]', '_', filename) or 'document.pdf'
    encoded_name = quote(filename)
    return f'attachment; filename="{safe_ascii_name}"; filename*=UTF-8\'\'{encoded_name}'


def _is_word_available() -> bool:
    if sys.platform == "darwin":
        return Path("/Applications/Microsoft Word.app").exists()

    if sys.platform.startswith("win"):
        program_files = [
            os.getenv("ProgramFiles", ""),
            os.getenv("ProgramFiles(x86)", ""),
        ]
        return any(
            base and Path(base, "Microsoft Office").exists()
            for base in program_files
        )

    return False


def _convert_with_word(input_path: Path, output_path: Path) -> str | None:
    if not PREFER_WORD_CONVERSION:
        return "Word conversion is disabled by configuration."

    if input_path.suffix.lower() != ".docx":
        return "Word conversion is only enabled for DOCX files."

    if not _is_word_available():
        return "Microsoft Word was not found."

    try:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from docx2pdf import convert; import sys; convert(sys.argv[1], sys.argv[2])",
                str(input_path),
                str(input_path.parent),
            ],
            capture_output=True,
            text=True,
            timeout=WORD_CONVERSION_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        return f"Word conversion timed out after {WORD_CONVERSION_TIMEOUT} seconds."
    except Exception as exc:
        return f"Word conversion failed: {exc}"

    generated_pdf_path = input_path.with_suffix(".pdf")
    if generated_pdf_path.exists():
        generated_pdf_path.replace(output_path)
        return None

    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        detail = " | ".join(part for part in [stderr, stdout] if part) or "Unknown docx2pdf error."
        return f"Word conversion failed (code {result.returncode}): {detail}"

    return "Word conversion did not produce an output PDF."


def _is_unoserver_reachable() -> bool:
    try:
        port = int(UNOSERVER_PORT)
    except ValueError:
        return False

    try:
        with socket.create_connection((UNOSERVER_HOST, port), timeout=1.0):
            return True
    except OSError:
        return False


def _convert_with_unoconvert(input_path: Path, output_path: Path) -> str | None:
    if not shutil.which("unoconvert"):
        return "unoconvert is not installed or not available on PATH."

    if not _is_unoserver_reachable():
        return f"unoserver is not reachable at {UNOSERVER_HOST}:{UNOSERVER_PORT}."

    result = subprocess.run(
        [
            "unoconvert",
            "--host",
            UNOSERVER_HOST,
            "--port",
            UNOSERVER_PORT,
            str(input_path),
            str(output_path),
        ],
        capture_output=True,
        text=True,
        timeout=UNOCONVERT_TIMEOUT,
    )

    if result.returncode == 0 and output_path.exists():
        return None

    stderr = (result.stderr or result.stdout or "Unknown unoconvert error.").strip()
    return f"unoconvert failed: {stderr}"


def _convert_with_libreoffice(input_path: Path, output_path: Path) -> str | None:
    libreoffice_binary = _resolve_libreoffice_binary()
    if not libreoffice_binary:
        return "LibreOffice was not found. Install LibreOffice or set LIBREOFFICE_BINARY."

    expected_output_path = input_path.with_suffix(".pdf")
    result = subprocess.run(
        [
            libreoffice_binary,
            "--headless",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            str(input_path.parent),
            str(input_path),
        ],
        capture_output=True,
        text=True,
        timeout=LIBREOFFICE_TIMEOUT,
    )

    if result.returncode != 0 or not expected_output_path.exists():
        stderr = (result.stderr or result.stdout or "Unknown LibreOffice error.").strip()
        return f"LibreOffice conversion failed: {stderr}"

    expected_output_path.replace(output_path)
    return None


def _convert_to_pdf(input_path: Path, output_path: Path) -> str:
    errors: list[str] = []
    attempts = [
        ("word", _convert_with_word),
        ("unoconvert", _convert_with_unoconvert),
        ("libreoffice", _convert_with_libreoffice),
    ]

    for engine, converter in attempts:
        started_at = time.monotonic()
        error = converter(input_path, output_path)
        elapsed = time.monotonic() - started_at

        if error is None:
            logger.info("Conversion succeeded with %s in %.2fs", engine, elapsed)
            return engine

        logger.warning("Conversion failed with %s in %.2fs: %s", engine, elapsed, error)
        errors.append(f"{engine} ({elapsed:.2f}s): {error}")

    raise HTTPException(
        status_code=500,
        detail="Conversion failed. " + " ".join(errors),
    )


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/convert")
async def convert(file: UploadFile = File(...)) -> Response:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_dir_path = Path(tmp_dir)
            input_path = tmp_dir_path / f"input{ext}"
            output_path = tmp_dir_path / "output.pdf"

            with input_path.open("wb") as input_file:
                shutil.copyfileobj(file.file, input_file)

            engine = _convert_to_pdf(input_path, output_path)

            base_name = Path(file.filename).stem or "document"
            download_name = f"{base_name}.pdf"
            pdf_bytes = output_path.read_bytes()

            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": _build_download_header(download_name),
                    "X-Conversion-Engine": engine,
                },
            )
    finally:
        await file.close()



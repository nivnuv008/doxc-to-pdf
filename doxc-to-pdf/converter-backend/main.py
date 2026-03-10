import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse


app = FastAPI(title="DOCX to PDF Converter")


ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:56420").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UNOSERVER_HOST = os.getenv("UNOSERVER_HOST", "127.0.0.1")
UNOSERVER_PORT = os.getenv("UNOSERVER_PORT", "2003")

ALLOWED_EXTENSIONS = {".doc", ".docx", ".odt", ".rtf", ".txt"}


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


@app.post("/convert")
async def convert(file: UploadFile = File(...)) -> FileResponse:
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

            cmd = [
                "unoconvert",
                str(input_path),
                str(output_path),
                "--host",
                UNOSERVER_HOST,
                "--port",
                UNOSERVER_PORT,
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0 or not output_path.exists():
                raise HTTPException(
                    status_code=500,
                    detail="Conversion failed. Please check unoserver and LibreOffice.",
                )

            base_name = Path(file.filename).stem or "document"
            download_name = f"{base_name}.pdf"

            return FileResponse(
                path=str(output_path),
                media_type="application/pdf",
                filename=download_name,
            )
    finally:
        await file.close()



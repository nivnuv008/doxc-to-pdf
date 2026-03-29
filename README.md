# DOCX to PDF Converter (Angular + FastAPI + unoserver)

This project provides:

- An Angular frontend (`docx-to-pdf-ui`) to upload a DOCX file and download the converted PDF.
- A FastAPI backend (`converter-backend`) that prefers native Microsoft Word conversion for `.docx` files on macOS/Windows when available, then falls back to `unoconvert`, and finally to direct LibreOffice conversion.

## Folder structure

- `docx-to-pdf-ui`: Angular application.
- `converter-backend`: FastAPI backend service.

## Running the Angular app

1. Open a terminal in `docx-to-pdf-ui`.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm start
   ```

   This serves the app at `http://localhost:4200`.

The Angular app is configured (via `environment.ts`) to call the backend at `http://localhost:8000`.

## Backend conversion options

The backend now supports two conversion paths:

1. Native Microsoft Word conversion for `.docx` files on macOS/Windows via `docx2pdf`.
2. `unoconvert` + `unoserver`.
3. Direct LibreOffice conversion with `soffice --headless`.

If Word is available, the backend uses that first for `.docx` files because it preserves complex layout, RTL text, and shapes more reliably. Otherwise it tries `unoconvert`, and if that is unavailable it automatically tries LibreOffice directly.

## Setting up LibreOffice + unoserver on the backend server

1. **Install LibreOffice** on the backend machine.
2. Install `unoserver` with the LibreOffice Python as described in the upstream docs: see [`unoserver` README](https://github.com/unoconv/unoserver/).
3. Start `unoserver` (for example):

   ```bash
   unoserver --interface 127.0.0.1 --port 2003 --uno-port 2002
   ```

   Adjust ports as needed. Keep this process running (e.g. via systemd or a process manager).

## Running the FastAPI backend

1. Open a terminal in `converter-backend`.
2. (Optional) Create and activate a virtualenv.
3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI app with Uvicorn:

   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

   Environment variables:

   - `UNOSERVER_HOST` (default `127.0.0.1`)
   - `UNOSERVER_PORT` (default `2003`)
   - `ALLOWED_ORIGINS` (comma-separated list; default `http://localhost:4200`)
   - `LIBREOFFICE_BINARY` (optional absolute path to `soffice`; useful on macOS if it is not on `PATH`)
   - `PREFER_WORD_CONVERSION` (default `true`; set to `false` to skip the native Word conversion path)

## Using the application

1. Ensure LibreOffice is installed. If you want to use `unoserver`, ensure that is running too.
2. Start the FastAPI backend on port 8000.
3. Start the Angular dev server.
4. Visit `http://localhost:4200`, select a DOCX (or supported) file and click **Convert to PDF**.
5. The browser will download the resulting PDF once conversion completes.

## Fresh setup on a clean Windows machine (only Node installed)

The steps below assume:

- You are on **Windows**.
- You already have **Node.js** and **npm** installed.
- This repo is cloned at  
  `C:\Users\<you>\OneDrive\שולחן העבודה\ZAHAL\word-to-pdf`.

### 1. Install Python

1. Download and install Python 3 from `https://www.python.org/downloads/`.
2. During setup, **check “Add Python to PATH”**.
3. Verify in a new PowerShell window:

   ```powershell
   python --version
   ```

### 2. Install LibreOffice

1. Download LibreOffice from `https://www.libreoffice.org/download/download-libreoffice/`.
2. Install with default options (note the install path, typically `C:\Program Files\LibreOffice`).

### 3. Install `unoserver`

`unoserver` must be installed with the **same Python that LibreOffice uses**. On Windows that Python is usually:

`C:\Program Files\LibreOffice\program\python.exe`

In PowerShell:

```powershell
& "C:\Program Files\LibreOffice\program\python.exe" -m pip install --upgrade pip
& "C:\Program Files\LibreOffice\program\python.exe" -m pip install unoserver
```

If LibreOffice is installed in a different folder, adjust the path accordingly.

### 4. Start `unoserver`

Open a **new** PowerShell window and run:

```powershell
& "C:\Program Files\LibreOffice\program\python.exe" -m unoserver.server --interface 127.0.0.1 --port 2003 --uno-port 2002
```

Leave this terminal **running**. This is the LibreOffice listener that performs conversions, as described in the [`unoserver` docs](https://github.com/unoconv/unoserver/).

### 5. Set up and run the FastAPI backend

Open another PowerShell window:

```powershell
cd "C:\Users\kfiri\OneDrive\שולחן העבודה\ZAHAL\word-to-pdf\converter-backend"
```

Install backend dependencies (one time):

```powershell
python -m pip install -r requirements.txt
```

Start the backend:

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

Keep this terminal open. Optionally, test the health endpoint in another terminal:

```powershell
curl http://localhost:8000/health
```

You should see `{"status":"ok"}`.

### 6. Set up and run the Angular frontend

Open a third PowerShell window:

```powershell
cd "C:\Users\kfiri\OneDrive\שולחן העבודה\ZAHAL\word-to-pdf\docx-to-pdf-ui"
```

Install frontend dependencies (one time):

```powershell
npm install
```

Start the Angular dev server:

```powershell
npm start
```

This serves the app at `http://localhost:4200`.

### 7. End‑to‑end test

1. Ensure **all three** are running:
   - `unoserver` (LibreOffice listener, LibreOffice Python).
   - FastAPI backend (`uvicorn main:app --host 0.0.0.0 --port 8000`).
   - Angular dev server (`npm start` in `docx-to-pdf-ui`).
2. Open a browser at `http://localhost:4200`.
3. Choose a `.docx` (or supported) file in the UI.
4. Click **Convert to PDF**.
5. A PDF with the same base filename should download automatically.



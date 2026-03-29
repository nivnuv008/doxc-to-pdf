# DOCX to PDF Converter (Angular + FastAPI + unoserver)

This project provides:

- An Angular frontend (`docx-to-pdf-ui`) to upload a DOCX file and download the converted PDF.
- A FastAPI backend (`converter-backend`) that prefers native Microsoft Word conversion for `.docx` files on macOS/Windows when available, then falls back to `unoconvert` from [`unoserver`](https://github.com/unoconv/unoserver/) and LibreOffice.

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

## Setting up conversion on the backend server

For the best fidelity on complex `.docx` files, especially documents with Hebrew/RTL text, equations, or diagrams:

1. Install **Microsoft Word** on macOS or Windows if available.
2. Install backend dependencies, including `docx2pdf`.
3. The backend will prefer Word-based conversion automatically for `.docx` files.

If Word is not available, use LibreOffice + unoserver:

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
   - `PREFER_WORD_CONVERSION` (default `true`; set to `false` to skip the native Word conversion path)

## Using the application

1. Ensure either Microsoft Word is installed for native `.docx` conversion, or **unoserver** is running and LibreOffice is installed on the backend server.
2. Start the FastAPI backend on port 8000.
3. Start the Angular dev server.
4. Visit `http://localhost:4200`, select a DOCX (or supported) file and click **Convert to PDF**.
5. The browser will download the resulting PDF once conversion completes.


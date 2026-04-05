# Project Instructions

## Auto-Open Documents
When creating or updating any document file (HTML, PDF, MD preview, report),
automatically open it in the default browser immediately after writing it.
- **HTML files**: Use `npx live-server "<parent_dir>" --open="<filename>"` — this serves the file on localhost with auto-refresh on file changes, preserving scroll position.
- **Non-HTML files** (PDF, PPTX, etc.): Use `start "" "<full_file_path>"` via Bash.
Do not wait for the user to ask.

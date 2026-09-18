"""Offline text extraction only. PDF text, actions and attachments are never executed."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from datetime import datetime, timezone

from pypdf import PdfReader

MAX_BYTES = 160 * 1024 * 1024
MAX_PAGES = 2000
MAX_TEXT_BYTES = 32 * 1024 * 1024


def write_json(path, data):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    sources = args.source_dir.resolve()
    catalog_path = root / "knowledge/catalog.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    output = root / ".data/knowledge"
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"version": 1, "extractedAt": datetime.now(timezone.utc).isoformat(), "books": []}
    failed = False
    for book in catalog:
        if not re.fullmatch(r"[a-z0-9-]+", book["id"]):
            raise ValueError("Invalid catalog id")
        filename = book["originalFilename"]
        if Path(filename).name != filename or "/" in filename or "\\" in filename:
            raise ValueError("Original filename must be a basename")
        source = (sources / filename).resolve()
        if source.parent != sources:
            raise ValueError("Source escapes selected directory")
        target = output / (book["id"] + ".txt")
        if target.resolve().parent != output.resolve():
            raise ValueError("Output escapes private knowledge directory")
        book["textPath"] = ".data/knowledge/" + target.name
        private = {"id": book["id"], "originalPath": str(source)}
        try:
            size = source.stat().st_size
            if not source.is_file() or not 5 <= size <= MAX_BYTES:
                raise ValueError("PDF missing, empty, or over 160 MiB")
            with source.open("rb") as stream:
                if stream.read(5) != b"%PDF-":
                    raise ValueError("Invalid PDF byte signature")
            reader = PdfReader(str(source), strict=False)
            if reader.is_encrypted and not reader.decrypt(""):
                raise ValueError("PDF requires a password; no password guessing is performed")
            pages = len(reader.pages)
            if not 1 <= pages <= MAX_PAGES:
                raise ValueError("PDF exceeds page limit")
            temporary = target.with_suffix(".txt.tmp")
            characters = nonempty = text_bytes = 0
            try:
                with temporary.open("w", encoding="utf-8", newline="\n") as stream:
                    for index, page in enumerate(reader.pages):
                        text = (page.extract_text() or "").replace("\r\n", "\n")
                        text = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text).strip()
                        characters += len(text)
                        nonempty += bool(re.search(r"[^\W_]{2,}", text))
                        data = ("\f" if index else "") + text + "\n"
                        text_bytes += len(data.encode("utf-8"))
                        if text_bytes > MAX_TEXT_BYTES:
                            raise ValueError("Extracted text exceeds 32 MiB")
                        stream.write(data)
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
            book["pages"] = pages
            book["extraction"] = {"status": "extracted" if nonempty else "no-text", "extractor": "pypdf", "pagesWithText": nonempty, "characters": characters, "bytes": text_bytes}
            with source.open("rb") as stream:
                private.update({"originalBytes": size, "originalSha256": hashlib.file_digest(stream, "sha256").hexdigest()})
            private["textSha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
            print(f'{book["id"]}: {nonempty}/{pages} pages with text, {characters} characters, {text_bytes} bytes', flush=True)
            if nonempty < pages:
                print("  Some pages have no searchable text; OCR was not run.", flush=True)
        except Exception as error:
            failed = True
            target.unlink(missing_ok=True)
            book["pages"] = 0
            book["extraction"] = {"status": "failed", "pagesWithText": 0, "characters": 0, "bytes": 0}
            private["error"] = str(error)
            print(f'{book["id"]}: extraction failed (details in private manifest)', file=sys.stderr, flush=True)
        private.update({"pages": book["pages"], "extraction": book["extraction"], "textPath": book["textPath"]})
        manifest["books"].append(private)
        write_json(catalog_path, catalog)
        write_json(output / "extraction-manifest.json", manifest)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

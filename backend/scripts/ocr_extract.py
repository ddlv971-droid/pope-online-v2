#!/usr/bin/env python3
import sys, json
from pathlib import Path
from pdf2image import convert_from_path
import pytesseract


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing_path"}))
        return
    path = Path(sys.argv[1])
    lang = sys.argv[2] if len(sys.argv) > 2 else 'fra+eng'
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    try:
        images = convert_from_path(str(path), dpi=220, first_page=1, last_page=max_pages)
        texts = []
        for image in images:
            text = pytesseract.image_to_string(image, lang=lang)
            if text:
                texts.append(text)
        print(json.dumps({"ok": True, "text": "

".join(texts)}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))

if __name__ == '__main__':
    main()

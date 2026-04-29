# 🖼️ Image Forge

Image Forge is a static, browser-only image converter. It converts common image formats directly in the visitor's browser and can be hosted with GitHub Pages.

Website: https://angzeli.github.io/image-forge/

## ✨ Features

- Convert JPG, JPEG, PNG, PDF, SVG, HEIC, HEIF, TIFF, and best-effort RAW files.
- Export to PNG, JPG, JPEG, PDF, SVG, or TIF.
- Resize output by pixels, centimeters, or percentage.
- Lock or unlock aspect ratio while editing width and height.
- Convert multiple files and package batch outputs into a ZIP.
- Convert every PDF page or only the first page.
- Runs locally in the browser; this project does not upload files to a server.

## 📦 Browser Libraries

The page loads these libraries from CDNs:

- JSZip for ZIP downloads.
- PDF.js for rendering PDF pages.
- jsPDF for PDF export.
- heic2any for HEIC/HEIF decoding.
- UTIF for TIFF decoding and encoding.

Visitors need an internet connection for those libraries to load.

## 🔒 Privacy

All conversion work happens locally in the browser. Files are not sent to a backend server by this project.

## 👋 Author

Made by Angze "Squiddy" Li.

    const fileInput = document.getElementById("file-input");
    const dropzone = document.getElementById("dropzone");
    const fileCard = document.getElementById("file-card");
    const fileName = document.getElementById("file-name");
    const fileMeta = document.getElementById("file-meta");
    const clearButton = document.getElementById("clear-button");
    const convertButton = document.getElementById("convert-button");
    const sampleButton = document.getElementById("sample-button");
    const formatSelect = document.getElementById("format-select");
    const widthInput = document.getElementById("width-input");
    const heightInput = document.getElementById("height-input");
    const dimensionHelp = document.getElementById("dimension-help");
    const estimatedSize = document.getElementById("estimated-size");
    const aspectLockButton = document.getElementById("aspect-lock");
    const unitButtons = Array.from(document.querySelectorAll("[data-unit]"));
    const unitLabels = Array.from(document.querySelectorAll("[data-unit-label]"));
    const transparentBg = document.getElementById("transparent-bg");
    const pdfAllPages = document.getElementById("pdf-all-pages");
    const statusEl = document.getElementById("status");
    const previewStage = document.getElementById("preview-stage");
    const previewState = document.getElementById("preview-state");

    let selectedFiles = [];
    let selectedSourceSize = null;
    let cachedFirstCanvas = null;
    let outputSize = null;
    let dimensionUnit = "px";
    let aspectLocked = true;
    let estimateTimer = 0;
    let estimateVersion = 0;
    let metricsVersion = 0;
    const DEFAULT_EXPORT_QUALITY = 0.92;

    const supportedExtensions = [
      "jpg", "jpeg", "png", "webp", "pdf", "svg", "heic", "heif", "raw",
      "dng", "cr2", "cr3", "nef", "arw", "orf", "rw2", "raf", "tif", "tiff"
    ];

    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length) {
        setFiles(Array.from(fileInput.files));
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
      });
    });

    dropzone.addEventListener("drop", (event) => {
      const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
      if (files.length) {
        setFiles(files);
      }
    });

    clearButton.addEventListener("click", () => {
      selectedFiles = [];
      estimateVersion += 1;
      metricsVersion += 1;
      clearTimeout(estimateTimer);
      fileInput.value = "";
      fileCard.classList.remove("is-visible");
      convertButton.disabled = true;
      resetDimensionControls();
      updateSizeEstimateLabel();
      previewStage.innerHTML = '<div class="empty-preview">Your first converted image will appear here.</div>';
      previewState.textContent = "Waiting";
      setStatus("Choose files to begin.");
    });

    widthInput.addEventListener("input", () => {
      setOutputWidth(Number(widthInput.value), dimensionUnit);
      updateSizeEstimateLabel("estimating");
      scheduleSizeEstimate();
    });

    heightInput.addEventListener("input", () => {
      setOutputHeight(Number(heightInput.value), dimensionUnit);
      updateSizeEstimateLabel("estimating");
      scheduleSizeEstimate();
    });

    aspectLockButton.addEventListener("click", () => {
      aspectLocked = !aspectLocked;
      aspectLockButton.setAttribute("aria-pressed", String(aspectLocked));
      aspectLockButton.setAttribute("aria-label", aspectLocked ? "Unlock width and height ratio" : "Lock width and height ratio");
      if (aspectLocked && outputSize && selectedSourceSize) {
        outputSize.height = Math.max(1, Math.round(outputSize.width * selectedSourceSize.height / selectedSourceSize.width));
      }
      updateDimensionLabel();
      updateSizeEstimateLabel("estimating");
      scheduleSizeEstimate();
    });

    formatSelect.addEventListener("change", () => {
      updateSizeEstimateLabel("estimating");
      scheduleSizeEstimate();
    });

    transparentBg.addEventListener("change", () => {
      updateSizeEstimateLabel("estimating");
      scheduleSizeEstimate();
    });

    pdfAllPages.addEventListener("change", () => {
      updateSizeEstimateLabel("estimating");
      scheduleSizeEstimate();
    });

    unitButtons.forEach((button) => {
      button.addEventListener("click", () => {
        dimensionUnit = button.dataset.unit;
        unitButtons.forEach((unitButton) => {
          const isActive = unitButton === button;
          unitButton.classList.toggle("is-active", isActive);
          unitButton.setAttribute("aria-pressed", String(isActive));
        });
        updateDimensionLabel();
      });
    });

    sampleButton.addEventListener("click", async () => {
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="920" viewBox="0 0 1400 920">
          <defs>
            <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#fffdf8"/>
              <stop offset="1" stop-color="#efe3d1"/>
            </linearGradient>
            <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#c3542d"/>
              <stop offset="0.58" stop-color="#e8b85a"/>
              <stop offset="1" stop-color="#7f9a80"/>
            </linearGradient>
          </defs>
          <rect width="1400" height="920" fill="url(#paper)"/>
          <circle cx="1110" cy="180" r="210" fill="#7f9a80" opacity=".24"/>
          <circle cx="230" cy="740" r="270" fill="#c3542d" opacity=".14"/>
          <rect x="170" y="150" width="1060" height="620" rx="58" fill="#fffaf2" stroke="#211c18" stroke-opacity=".14" stroke-width="6"/>
          <rect x="250" y="230" width="360" height="260" rx="38" fill="url(#mark)"/>
          <path d="M303 426 410 310l86 88 45-48 97 108" fill="none" stroke="#fffdf8" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="358" cy="292" r="32" fill="#fffdf8"/>
          <text x="700" y="340" fill="#211c18" font-family="Georgia, serif" font-size="88" font-weight="700">Image Forge</text>
          <text x="704" y="428" fill="#71665f" font-family="Optima, Avenir Next, sans-serif" font-size="42">sample conversion artwork</text>
          <text x="704" y="508" fill="#8f371d" font-family="Optima, Avenir Next, sans-serif" font-size="32" font-weight="700">JPG · PNG · PDF · SVG · TIFF</text>
        </svg>
      `;
      const file = new File([svg], "image-forge-sample.svg", { type: "image/svg+xml" });
      setFiles([file]);
      setStatus("Sample SVG loaded. Choose an export format and convert it.");
    });

    convertButton.addEventListener("click", async () => {
      if (!selectedFiles.length) {
        return;
      }

      convertButton.disabled = true;
      setStatus("Reading files...");
      previewState.textContent = "Working";

      try {
        const format = formatSelect.value;
        const quality = getQualityValue();
        const resizeOptions = getResizeOptions();
        const keepTransparency = transparentBg.checked;
        const canvases = [];
        const warnings = [];

        for (const file of selectedFiles) {
          setStatus(`Rendering ${escapeHtml(file.name)}...`);
          const rendered = await renderFileToCanvases(file, {
            ...resizeOptions,
            keepTransparency,
            allPdfPages: pdfAllPages.checked
          });
          canvases.push(...rendered.canvases);
          warnings.push(...rendered.warnings);
        }

        if (!canvases.length) {
          throw new Error("No images could be rendered from the selected files.");
        }

        showPreview(canvases[0].canvas, canvases[0].name);
        setStatus("Packaging download...");

        if (format === "pdf") {
          const pdfBlob = await canvasesToPdf(canvases, quality);
          downloadBlob(pdfBlob, outputBaseName(selectedFiles, "converted-images") + ".pdf");
        } else if (canvases.length === 1) {
          const item = canvases[0];
          const blob = await canvasToFormatBlob(item.canvas, format, quality, keepTransparency);
          downloadBlob(blob, `${slugify(item.name) || "converted-image"}.${extensionForFormat(format)}`);
        } else {
          const zip = new JSZip();
          for (const item of canvases) {
            const blob = await canvasToFormatBlob(item.canvas, format, quality, keepTransparency);
            zip.file(`${slugify(item.name) || "converted-image"}.${extensionForFormat(format)}`, blob);
          }
          const zipBlob = await zip.generateAsync({ type: "blob" });
          downloadBlob(zipBlob, outputBaseName(selectedFiles, "converted-images") + ".zip");
        }

        const warningText = warnings.length ? ` ${warnings.map(escapeHtml).join(" ")}` : "";
        setStatus(`<strong>Finished.</strong> Converted ${canvases.length} image${canvases.length === 1 ? "" : "s"}.${warningText}`);
        previewState.textContent = "Converted";
      } catch (error) {
        console.error(error);
        setStatus(`<strong>Could not convert these files.</strong> ${escapeHtml(error.message || "Please try another image.")}`);
        previewState.textContent = "Error";
      } finally {
        convertButton.disabled = selectedFiles.length === 0;
      }
    });

    function setFiles(files) {
      const validFiles = files.filter((file) => supportedExtensions.includes(getExtension(file.name)));

      if (!validFiles.length) {
        setStatus("<strong>Unsupported file type.</strong> Choose JPG, PNG, JPEG, WebP, PDF, SVG, HEIC, HEIF, RAW, or TIFF files.");
        return;
      }

      selectedFiles = validFiles;
      estimateVersion += 1;
      metricsVersion += 1;
      clearTimeout(estimateTimer);
      fileName.textContent = validFiles.length === 1 ? validFiles[0].name : `${validFiles.length} files selected`;
      fileMeta.textContent = `${formatBytes(validFiles.reduce((sum, file) => sum + file.size, 0))} total`;
      fileCard.classList.add("is-visible");
      convertButton.disabled = false;
      previewState.textContent = "Ready";
      setStatus(validFiles.length === files.length ? "Ready to convert." : "Some unsupported files were skipped.");
      refreshSelectedFileMetrics();
    }

    async function refreshSelectedFileMetrics() {
      const version = metricsVersion;
      selectedSourceSize = null;
      cachedFirstCanvas = null;
      outputSize = null;
      resetDimensionControls("Reading dimensions...");
      updateSizeEstimateLabel("estimating");

      try {
        const rendered = await renderFileToCanvases(selectedFiles[0], {
          maxWidth: 0,
          keepTransparency: true,
          allPdfPages: false
        });

        if (version !== metricsVersion || !rendered.canvases.length) {
          return;
        }

        const canvas = rendered.canvases[0].canvas;
        cachedFirstCanvas = canvas;
        selectedSourceSize = {
          width: canvas.width,
          height: canvas.height
        };
        outputSize = {
          width: canvas.width,
          height: canvas.height
        };
        widthInput.disabled = false;
        heightInput.disabled = false;
        updateDimensionLabel();
        scheduleSizeEstimate(0);
      } catch (error) {
        console.warn(error);
        resetDimensionControls("Dimensions unavailable for this file until conversion.");
        updateSizeEstimateLabel();
      }
    }

    function resetDimensionControls(helpText = "Choose files to see the output width and height.") {
      selectedSourceSize = null;
      cachedFirstCanvas = null;
      outputSize = null;
      widthInput.disabled = true;
      heightInput.disabled = true;
      widthInput.value = "";
      heightInput.value = "";
      widthInput.placeholder = "--";
      heightInput.placeholder = "--";
      updateUnitLabels();
      dimensionHelp.textContent = helpText;
    }

    function getResizeOptions() {
      if (!outputSize) {
        return {};
      }

      return {
        targetWidth: Math.max(1, Math.round(outputSize.width)),
        targetHeight: Math.max(1, Math.round(outputSize.height))
      };
    }

    function setOutputWidth(value, unit) {
      if (!selectedSourceSize || !Number.isFinite(value) || value <= 0) {
        return;
      }

      const width = unitToPx(value, "width");
      outputSize = outputSize || { width: selectedSourceSize.width, height: selectedSourceSize.height };
      outputSize.width = clampDimension(width);
      if (aspectLocked) {
        outputSize.height = Math.max(1, Math.round(outputSize.width * selectedSourceSize.height / selectedSourceSize.width));
      }
      updateDimensionLabel();
    }

    function setOutputHeight(value, unit) {
      if (!selectedSourceSize || !Number.isFinite(value) || value <= 0) {
        return;
      }

      const height = unitToPx(value, "height");
      outputSize = outputSize || { width: selectedSourceSize.width, height: selectedSourceSize.height };
      outputSize.height = clampDimension(height);
      if (aspectLocked) {
        outputSize.width = Math.max(1, Math.round(outputSize.height * selectedSourceSize.width / selectedSourceSize.height));
      }
      updateDimensionLabel();
    }

    function updateDimensionLabel(skipField = "") {
      updateUnitLabels();

      if (!selectedSourceSize || !outputSize) {
        widthInput.value = "";
        heightInput.value = "";
        dimensionHelp.textContent = "Choose files to see the output width and height.";
        return;
      }

      if (skipField !== "width") {
        widthInput.value = formatDimensionValue(outputSize.width, "width");
      }
      if (skipField !== "height") {
        heightInput.value = formatDimensionValue(outputSize.height, "height");
      }

      const originalText = outputSize.width === selectedSourceSize.width && outputSize.height === selectedSourceSize.height ? "Original" : "Scaled";
      const lockText = aspectLocked ? "ratio locked" : "free sizing";
      dimensionHelp.textContent = `${originalText} from ${selectedSourceSize.width} x ${selectedSourceSize.height} px, ${lockText}.`;
    }

    function formatDimensionValue(px, axis) {
      if (dimensionUnit === "cm") {
        return (pxToCm(px)).toFixed(2);
      }
      if (dimensionUnit === "pct" && selectedSourceSize) {
        const original = axis === "width" ? selectedSourceSize.width : selectedSourceSize.height;
        return (px / original * 100).toFixed(1).replace(/\.0$/, "");
      }
      return String(Math.round(px));
    }

    function updateUnitLabels() {
      unitLabels.forEach((label) => {
        label.textContent = dimensionUnit === "pct" ? "%" : dimensionUnit;
      });
      const step = dimensionUnit === "cm" ? "0.01" : dimensionUnit === "pct" ? "0.1" : "1";
      widthInput.step = step;
      heightInput.step = step;
    }

    function unitToPx(value, axis) {
      if (dimensionUnit === "cm") {
        return value * 96 / 2.54;
      }
      if (dimensionUnit === "pct" && selectedSourceSize) {
        const original = axis === "width" ? selectedSourceSize.width : selectedSourceSize.height;
        return original * value / 100;
      }
      return value;
    }

    function pxToCm(px) {
      return px * 2.54 / 96;
    }

    function clampDimension(value) {
      return Math.min(12000, Math.max(1, Math.round(value)));
    }

    function updateSizeEstimateLabel(sizeText = "") {
      if (sizeText === "estimating") {
        estimatedSize.textContent = "Estimating file size...";
      } else if (sizeText) {
        estimatedSize.textContent = sizeText;
      } else {
        estimatedSize.textContent = selectedFiles.length ? "File size estimate pending." : "Estimated file size appears after choosing files.";
      }
    }

    function scheduleSizeEstimate(delay = 120) {
      clearTimeout(estimateTimer);
      if (!selectedFiles.length) {
        updateSizeEstimateLabel();
        return;
      }
      estimateTimer = setTimeout(estimateConvertedSize, delay);
    }

    async function estimateConvertedSize() {
      const version = ++estimateVersion;
      updateSizeEstimateLabel("estimating");

      try {
        const format = formatSelect.value;
        const quality = getQualityValue();
        const resizeOptions = getResizeOptions();
        const keepTransparency = transparentBg.checked;
        const rendered = cachedFirstCanvas
          ? {
              canvases: [{
                canvas: prepareCachedCanvas(cachedFirstCanvas, resizeOptions, keepTransparency),
                name: stripExtension(selectedFiles[0].name)
              }],
              warnings: []
            }
          : await renderFileToCanvases(selectedFiles[0], {
              ...resizeOptions,
              keepTransparency,
              allPdfPages: false
            });

        if (version !== estimateVersion || !rendered.canvases.length) {
          return;
        }

        let blob;
        if (format === "pdf") {
          blob = await canvasesToPdf([rendered.canvases[0]], quality);
        } else {
          blob = await canvasToFormatBlob(rendered.canvases[0].canvas, format, quality, keepTransparency);
        }

        if (version !== estimateVersion) {
          return;
        }

        const estimatesFirstOutput = selectedFiles.length > 1 || getExtension(selectedFiles[0].name) === "pdf";
        const suffix = estimatesFirstOutput ? "first output estimate" : "estimated output";
        updateSizeEstimateLabel(`${formatBytes(blob.size)} ${suffix}`);
      } catch (error) {
        console.warn(error);
        if (version === estimateVersion) {
          updateSizeEstimateLabel("File size unavailable for this file.");
        }
      }
    }

    function getQualityValue() {
      return DEFAULT_EXPORT_QUALITY;
    }

    function prepareCachedCanvas(source, resizeOptions, keepTransparency) {
      const resized = resizeCanvas(source, resizeOptions, true);
      return keepTransparency ? resized : flattenCanvas(resized);
    }

    async function renderFileToCanvases(file, options) {
      const extension = getExtension(file.name);
      const baseName = stripExtension(file.name);

      if (extension === "pdf") {
        return renderPdf(file, baseName, options);
      }

      if (extension === "tif" || extension === "tiff") {
        return renderTiff(file, baseName, options);
      }

      if (extension === "heic" || extension === "heif") {
        return renderHeic(file, baseName, options);
      }

      return {
        canvases: [{
          canvas: await imageFileToCanvas(file, options),
          name: baseName
        }],
        warnings: isRawExtension(extension) ? ["RAW conversion succeeded using browser decoding. Some camera RAW files may not decode in every browser."] : []
      };
    }

    async function renderPdf(file, baseName, options) {
      if (!window.pdfjsLib) {
        throw new Error("PDF.js could not be loaded.");
      }

      const bytes = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pageTotal = options.allPdfPages ? pdf.numPages : 1;
      const canvases = [];

      for (let pageNumber = 1; pageNumber <= pageTotal; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        canvases.push({
          canvas: resizeCanvas(canvas, options, false),
          name: `${baseName}-page-${String(pageNumber).padStart(2, "0")}`
        });
      }

      return { canvases, warnings: [] };
    }

    async function renderTiff(file, baseName, options) {
      if (!window.UTIF) {
        throw new Error("TIFF support library could not be loaded.");
      }

      const buffer = await file.arrayBuffer();
      const ifds = UTIF.decode(buffer);
      if (!ifds.length) {
        throw new Error("This TIFF file did not contain any readable images.");
      }

      const canvases = [];
      for (let index = 0; index < ifds.length; index += 1) {
        UTIF.decodeImage(buffer, ifds[index]);
        const rgba = UTIF.toRGBA8(ifds[index]);
        const canvas = document.createElement("canvas");
        canvas.width = ifds[index].width;
        canvas.height = ifds[index].height;
        const ctx = canvas.getContext("2d");
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        canvases.push({
          canvas: resizeCanvas(canvas, options, options.keepTransparency),
          name: ifds.length === 1 ? baseName : `${baseName}-${String(index + 1).padStart(2, "0")}`
        });
      }

      return { canvases, warnings: [] };
    }

    async function renderHeic(file, baseName, options) {
      if (!window.heic2any) {
        throw new Error("HEIC/HEIF support library could not be loaded.");
      }

      const converted = await heic2any({
        blob: file,
        toType: "image/png",
        quality: 1
      });
      const blobs = Array.isArray(converted) ? converted : [converted];
      const canvases = [];

      for (let index = 0; index < blobs.length; index += 1) {
        canvases.push({
          canvas: await imageFileToCanvas(blobs[index], options),
          name: blobs.length === 1 ? baseName : `${baseName}-${String(index + 1).padStart(2, "0")}`
        });
      }

      return { canvases, warnings: [] };
    }

    async function imageFileToCanvas(fileOrBlob, options) {
      const url = URL.createObjectURL(fileOrBlob);

      try {
        const image = await loadImage(url);
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const ctx = canvas.getContext("2d");
        if (!options.keepTransparency) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(image, 0, 0);
        return resizeCanvas(canvas, options, options.keepTransparency);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    function resizeCanvas(source, options, keepTransparency) {
      const targetWidth = options && options.targetWidth ? Math.max(1, Math.round(options.targetWidth)) : 0;
      const targetHeight = options && options.targetHeight ? Math.max(1, Math.round(options.targetHeight)) : 0;

      if (!targetWidth && !targetHeight) {
        return source;
      }

      const width = targetWidth || Math.max(1, Math.round(source.width * (targetHeight / source.height)));
      const height = targetHeight || Math.max(1, Math.round(source.height * (targetWidth / source.width)));

      if (source.width === width && source.height === height) {
        return source;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!keepTransparency) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    async function canvasToFormatBlob(canvas, format, quality, keepTransparency) {
      if (format === "jpg" || format === "jpeg") {
        return canvasToBlob(flattenCanvas(canvas), "image/jpeg", quality);
      }

      if (format === "png") {
        return canvasToBlob(canvas, "image/png", 1);
      }

      if (format === "webp") {
        return canvasToBlob(canvas, "image/webp", quality);
      }

      if (format === "svg") {
        const pngDataUrl = canvas.toDataURL("image/png");
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="${canvas.width}" height="${canvas.height}" href="${pngDataUrl}"/></svg>`;
        return new Blob([svg], { type: "image/svg+xml" });
      }

      if (format === "tif") {
        if (!window.UTIF) {
          throw new Error("TIFF support library could not be loaded.");
        }
        const rgbaCanvas = keepTransparency ? canvas : flattenCanvas(canvas);
        const ctx = rgbaCanvas.getContext("2d");
        const rgba = ctx.getImageData(0, 0, rgbaCanvas.width, rgbaCanvas.height).data;
        const arrayBuffer = UTIF.encodeImage(rgba, rgbaCanvas.width, rgbaCanvas.height);
        return new Blob([arrayBuffer], { type: "image/tiff" });
      }

      throw new Error("Unsupported export format.");
    }

    async function canvasesToPdf(items, quality) {
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        throw new Error("PDF export library could not be loaded.");
      }

      let doc = null;

      for (const item of items) {
        const canvas = flattenCanvas(item.canvas);
        const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
        const pageFormat = [canvas.width, canvas.height];
        const image = canvas.toDataURL("image/jpeg", quality);

        if (!doc) {
          doc = new jsPDF({ orientation, unit: "px", format: pageFormat, compress: true });
        } else {
          doc.addPage(pageFormat, orientation);
        }

        doc.addImage(image, "JPEG", 0, 0, canvas.width, canvas.height);
      }

      return doc.output("blob");
    }

    function flattenCanvas(source) {
      const canvas = document.createElement("canvas");
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0);
      return canvas;
    }

    function canvasToBlob(canvas, type, quality) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("The browser could not create this output file."));
          }
        }, type, quality);
      });
    }

    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This file could not be decoded by the browser."));
        image.src = url;
      });
    }

    function showPreview(canvas, name) {
      previewStage.innerHTML = "";
      const clone = document.createElement("canvas");
      clone.width = canvas.width;
      clone.height = canvas.height;
      clone.getContext("2d").drawImage(canvas, 0, 0);
      clone.setAttribute("aria-label", `Preview of ${name}`);
      previewStage.appendChild(clone);
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function outputBaseName(files, fallback) {
      if (files.length === 1) {
        return slugify(stripExtension(files[0].name)) || fallback;
      }
      return fallback;
    }

    function getExtension(filename) {
      return filename.toLowerCase().split(".").pop() || "";
    }

    function stripExtension(filename) {
      return filename.replace(/\.[^.]+$/, "");
    }

    function extensionForFormat(format) {
      if (format === "jpeg") {
        return "jpeg";
      }
      if (format === "jpg") {
        return "jpg";
      }
      if (format === "tif") {
        return "tif";
      }
      if (format === "webp") {
        return "webp";
      }
      return format;
    }

    function isRawExtension(extension) {
      return ["raw", "dng", "cr2", "cr3", "nef", "arw", "orf", "rw2", "raf"].includes(extension);
    }

    function slugify(value) {
      return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    }

    function formatBytes(bytes) {
      if (!bytes) {
        return "0 B";
      }
      const units = ["B", "KB", "MB", "GB"];
      const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      const size = bytes / Math.pow(1024, index);
      return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
    }

    function setStatus(message) {
      statusEl.innerHTML = message;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

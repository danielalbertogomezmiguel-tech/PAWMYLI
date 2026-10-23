(function (factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (typeof window !== "undefined") {
        window.PawImageUpload = api;
    }
})(function () {
    const MAX_INPUT = 15 * 1024 * 1024;
    const TARGET = 1.2 * 1024 * 1024;
    const HARD = 1.5 * 1024 * 1024;
    const MAX_EDGE = 1600;
    const MSG_TYPE = "Solo se permiten imágenes JPG, PNG o WebP.";
    const MSG_LIMIT = "La imagen supera el máximo de 15 MB. Elige una foto más liviana.";
    const MSG_STILL = "No se pudo reducir la foto por debajo de 1.5 MB. Elige otra imagen.";
    const MSG_DECODE = "No se pudo leer la imagen. Prueba con otra foto JPG, PNG o WebP.";

    function detectImageMime(bytes) {
        const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
        if (
            b.length >= 8 &&
            b[0] === 0x89 &&
            b[1] === 0x50 &&
            b[2] === 0x4e &&
            b[3] === 0x47 &&
            b[4] === 0x0d &&
            b[5] === 0x0a &&
            b[6] === 0x1a &&
            b[7] === 0x0a
        ) {
            return "image/png";
        }
        if (
            b.length >= 12 &&
            b[0] === 0x52 &&
            b[1] === 0x49 &&
            b[2] === 0x46 &&
            b[3] === 0x46 &&
            b[8] === 0x57 &&
            b[9] === 0x45 &&
            b[10] === 0x42 &&
            b[11] === 0x50
        ) {
            return "image/webp";
        }
        return "";
    }

    function formatMb(bytes) {
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function baseName(name) {
        const clean = String(name || "foto").replace(/[/\\]/g, "");
        const stripped = clean.replace(/\.[^.]+$/, "");
        return stripped || "foto";
    }

    async function assertImageFile(file) {
        if (!file) throw new Error("No se seleccionó ninguna imagen.");
        if ((Number(file.size) || 0) > MAX_INPUT) throw new Error(MSG_LIMIT);
        const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
        const mime = detectImageMime(bytes);
        if (!mime) throw new Error(MSG_TYPE);
        return { mime: mime };
    }

    async function fileWithType(file, mime) {
        if (!file) throw new Error("No se seleccionó ninguna imagen.");
        if (file.type === mime) return file;
        const buffer = await file.arrayBuffer();
        const ext = mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
        return new File([buffer], baseName(file.name) + ext, {
            type: mime,
            lastModified: file.lastModified || Date.now(),
        });
    }

    function serverPhotoMessage(err) {
        if (!err) return "";
        const status = Number(err.status);
        const code = String(err.code || "");
        if (status === 413) {
            return String(err.serverMessage || err.message || "").trim();
        }
        if (status === 400 && /VALIDATION_ERROR/i.test(code)) {
            return String(err.message || "").trim();
        }
        return "";
    }

    function notifyOptimized(originalBytes, outputBytes) {
        const message = "Foto optimizada (de " + formatMb(originalBytes) + " a " + formatMb(outputBytes) + ")";
        try {
            if (typeof window !== "undefined" && window.PawToast && typeof window.PawToast.show === "function") {
                window.PawToast.show({ type: "info", message: message });
            }
        } catch (_) {
            /* el aviso no debe impedir la subida */
        }
        return message;
    }

    function sourceSize(source) {
        return {
            width: source.naturalWidth || source.width || 0,
            height: source.naturalHeight || source.height || 0,
        };
    }

    function releaseSource(source) {
        if (source && typeof source.close === "function") {
            try {
                source.close();
            } catch (_) {}
        }
        if (source && source._pawObjectUrl && typeof URL !== "undefined") {
            URL.revokeObjectURL(source._pawObjectUrl);
        }
    }

    async function loadSource(file) {
        if (typeof createImageBitmap === "function") {
            try {
                return await createImageBitmap(file, { imageOrientation: "from-image" });
            } catch (_) {
                try {
                    return await createImageBitmap(file);
                } catch (_) {
                    /* sigue con Image */
                }
            }
        }
        if (typeof Image === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) {
            throw new Error(MSG_DECODE);
        }
        const url = URL.createObjectURL(file);
        try {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(MSG_DECODE));
                img.src = url;
            });
            image._pawObjectUrl = url;
            return image;
        } catch (err) {
            URL.revokeObjectURL(url);
            throw err instanceof Error ? err : new Error(MSG_DECODE);
        }
    }

    function drawFitted(source, size) {
        const longest = Math.max(size.width, size.height);
        const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
        const width = Math.max(1, Math.round(size.width * scale));
        const height = Math.max(1, Math.round(size.height * scale));
        if (typeof document === "undefined") throw new Error(MSG_DECODE);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error(MSG_DECODE);
        ctx.drawImage(source, 0, 0, width, height);
        return canvas;
    }

    function canvasToBlob(canvas, quality) {
        return new Promise((resolve) => {
            if (!canvas.toBlob) {
                resolve(null);
                return;
            }
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
        });
    }

    async function compressCanvas(canvas) {
        const qualities = [0.85, 0.8, 0.75, 0.7, 0.65, 0.6];
        let best = null;
        for (let i = 0; i < qualities.length; i++) {
            const blob = await canvasToBlob(canvas, qualities[i]);
            if (!blob) continue;
            best = blob;
            if (blob.size <= TARGET) return blob;
        }
        if (!best) throw new Error(MSG_DECODE);
        if (best.size > HARD) throw new Error(MSG_STILL);
        return best;
    }

    async function blobToDataUrl(blob, mime) {
        if (typeof FileReader === "undefined") throw new Error(MSG_DECODE);
        const url = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error(MSG_DECODE));
            reader.readAsDataURL(blob);
        });
        if (/^data:image\/(jpeg|png|webp);base64,/i.test(url)) return url;
        if (mime && /^image\/(jpeg|png|webp)$/i.test(mime) && /^data:[^;]+;base64,/i.test(url)) {
            return url.replace(/^data:[^;]+/i, "data:" + mime);
        }
        throw new Error(MSG_DECODE);
    }

    async function prepare(file) {
        const checked = await assertImageFile(file);
        const source = await loadSource(file);
        try {
            const size = sourceSize(source);
            if (!size.width || !size.height) throw new Error(MSG_DECODE);
            const tooHeavy = file.size > TARGET;
            const tooBig = size.width > MAX_EDGE || size.height > MAX_EDGE;
            if (!tooHeavy && !tooBig) {
                const dataUrl = await blobToDataUrl(file, checked.mime);
                const typed = await fileWithType(file, checked.mime);
                return {
                    dataUrl: dataUrl,
                    file: typed,
                    blob: file,
                    mime: checked.mime,
                    optimized: false,
                    originalBytes: file.size,
                    outputBytes: file.size,
                };
            }
            const blob = await compressCanvas(drawFitted(source, size));
            const dataUrl = await blobToDataUrl(blob, "image/jpeg");
            const uploadFile = new File([blob], baseName(file.name) + ".jpg", {
                type: "image/jpeg",
                lastModified: Date.now(),
            });
            notifyOptimized(file.size, blob.size);
            return {
                dataUrl: dataUrl,
                file: uploadFile,
                blob: blob,
                mime: "image/jpeg",
                optimized: true,
                originalBytes: file.size,
                outputBytes: blob.size,
            };
        } finally {
            releaseSource(source);
        }
    }

    return {
        detectImageMime: detectImageMime,
        assertImageFile: assertImageFile,
        fileWithType: fileWithType,
        prepare: prepare,
        serverPhotoMessage: serverPhotoMessage,
    };
});

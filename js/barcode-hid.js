(function (global) {
    /**
     * HID keyboard-wedge barcode support (Motorola SYMBOL LS1203 and similar).
     * Strategy:
     *  1) Prefer a focused barcode target input (scanner types into it natively).
     *  2) Fallback to a global burst buffer with a generous inter-key gap (LS1203).
     */
    function isBarcodeTarget(el) {
        if (!el || !el.tagName) return false;
        if (el.id === "pawInputCodigo" || el.id === "scanHidInput" || el.id === "buscarCodigo") {
            return true;
        }
        return el.getAttribute && el.getAttribute("data-barcode-target") === "1";
    }

    function normalizeCode(raw) {
        return String(raw || "")
            .replace(/[\r\n\t]+/g, "")
            .trim()
            .toUpperCase();
    }

    function looksLikeCode(code) {
        if (!code || code.length < 4) return false;
        return /^PAW-\d{3,}$/i.test(code) || /^[A-Z0-9-]{4,32}$/i.test(code);
    }

    function attachHidBarcodeListener(onCode) {
        let buffer = "";
        let lastKeyAt = 0;
        let burstCount = 0;
        let idleTimer = null;
        const MAX_GAP_MS = 350;
        const IDLE_FLUSH_MS = 420;
        const MIN_LEN = 4;
        const MIN_BURST = 3;

        function emit(code) {
            const value = normalizeCode(code);
            if (!looksLikeCode(value)) return false;
            const modal = document.getElementById("pawModalCodigo");
            const modalInput = document.getElementById("pawInputCodigo");
            if (modal && modal.classList.contains("activo") && modalInput) {
                modalInput.dispatchEvent(
                    new CustomEvent("paw-barcode", { detail: { code: value } })
                );
                return true;
            }
            onCode(value);
            return true;
        }

        function resetBuffer() {
            buffer = "";
            burstCount = 0;
            if (idleTimer) {
                clearTimeout(idleTimer);
                idleTimer = null;
            }
        }

        function flushBuffer() {
            const code = buffer;
            resetBuffer();
            emit(code);
        }

        function scheduleIdleFlush() {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (buffer.length >= MIN_LEN && burstCount >= MIN_BURST) flushBuffer();
                else resetBuffer();
            }, IDLE_FLUSH_MS);
        }

        global.addEventListener(
            "keydown",
            (e) => {
                if (e.ctrlKey || e.altKey || e.metaKey) return;
                const target = e.target;
                const tag = (target && target.tagName) || "";
                const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
                const barcodeField = isBarcodeTarget(target);

                // Native wedge into barcode fields: keep chars in the input, submit on Enter.
                if (barcodeField) {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        const code = normalizeCode(target.value);
                        if (looksLikeCode(code)) {
                            const modal = document.getElementById("pawModalCodigo");
                            if (modal && modal.classList.contains("activo")) {
                                target.dispatchEvent(
                                    new CustomEvent("paw-barcode", { detail: { code: code } })
                                );
                            } else {
                                onCode(code);
                            }
                            target.value = "";
                        }
                        resetBuffer();
                    }
                    return;
                }

                const now = Date.now();
                const gap = now - lastKeyAt;

                if (e.key === "Enter") {
                    if (buffer.length >= MIN_LEN && (burstCount >= MIN_BURST || !inField)) {
                        e.preventDefault();
                        e.stopPropagation();
                        flushBuffer();
                    } else {
                        resetBuffer();
                    }
                    return;
                }

                if (e.key.length !== 1) return;

                // Ignore slow human typing in normal form fields.
                if (inField && !barcodeField && gap > MAX_GAP_MS && burstCount === 0) {
                    return;
                }

                if (gap > MAX_GAP_MS) {
                    buffer = "";
                    burstCount = 0;
                }
                lastKeyAt = now;
                buffer += e.key;
                burstCount += 1;
                scheduleIdleFlush();
            },
            true
        );

        // Some wedges fire keypress more reliably than keydown for printable chars.
        global.addEventListener(
            "keypress",
            (e) => {
                const target = e.target;
                if (isBarcodeTarget(target)) return;
                if (e.ctrlKey || e.altKey || e.metaKey) return;
                if (!e.key || e.key.length !== 1) return;
                // Already captured by keydown path in modern browsers; keep as backup
                // only when buffer empty and we see a rapid PAW- start via keypress alone.
            },
            true
        );
    }

    /** Focus a dedicated scan field so LS1203 types into it. */
    function focusScanTarget() {
        const el =
            document.getElementById("scanHidInput") ||
            document.getElementById("pawInputCodigo") ||
            document.querySelector("[data-barcode-target='1']");
        if (el && typeof el.focus === "function") {
            el.focus();
            if (typeof el.select === "function") el.select();
            return el;
        }
        return null;
    }

    global.PawBarcodeHid = {
        attach: attachHidBarcodeListener,
        focusTarget: focusScanTarget,
        normalize: normalizeCode,
    };
})(window);

(function (global) {
    /**
     * USB barcode scanners (HID keyboard wedge) type chars rapidly and end with Enter.
     * Works even when focus is inside INPUT/TEXTAREA (search fields), by detecting
     * rapid keystroke bursts typical of wedges.
     */
    function attachHidBarcodeListener(onCode) {
        let buffer = "";
        let lastKeyAt = 0;
        let burstCount = 0;
        const MAX_GAP_MS = 120;
        const MIN_LEN = 4;
        const MIN_BURST = 3;

        function looksLikePatientCode(code) {
            return /^PAW-\d{4,}$/i.test(code) || /^[A-Z0-9-]{4,32}$/i.test(code);
        }

        function flush() {
            const code = buffer.trim().toUpperCase();
            buffer = "";
            burstCount = 0;
            if (code.length >= MIN_LEN && looksLikePatientCode(code)) {
                onCode(code);
            }
        }

        global.addEventListener(
            "keydown",
            (e) => {
                if (e.ctrlKey || e.altKey || e.metaKey) return;
                const tag = (e.target && e.target.tagName) || "";
                const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
                const now = Date.now();
                const gap = now - lastKeyAt;

                if (e.key === "Enter") {
                    if (buffer.length >= MIN_LEN && (burstCount >= MIN_BURST || !inField)) {
                        e.preventDefault();
                        e.stopPropagation();
                        flush();
                    } else if (buffer.length > 0) {
                        buffer = "";
                        burstCount = 0;
                    }
                    return;
                }

                if (e.key.length !== 1) return;

                if (gap > MAX_GAP_MS) {
                    buffer = "";
                    burstCount = 0;
                }
                lastKeyAt = now;
                buffer += e.key;
                burstCount += 1;
            },
            true
        );
    }

    global.PawBarcodeHid = { attach: attachHidBarcodeListener };
})(window);

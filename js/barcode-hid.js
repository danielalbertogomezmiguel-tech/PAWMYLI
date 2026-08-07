(function (global) {
    /**
     * USB barcode scanners that act as HID keyboards type digits/chars
     * rapidly and end with Enter. This listener aggregates that buffer.
     */
    function attachHidBarcodeListener(onCode) {
        let buffer = "";
        let lastKeyAt = 0;
        const MAX_GAP_MS = 80;
        const MIN_LEN = 4;

        function flush() {
            const code = buffer.trim();
            buffer = "";
            if (code.length >= MIN_LEN) onCode(code);
        }

        global.addEventListener("keydown", (e) => {
            const tag = (e.target && e.target.tagName) || "";
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                return;
            }
            const now = Date.now();
            if (now - lastKeyAt > MAX_GAP_MS) buffer = "";
            lastKeyAt = now;

            if (e.key === "Enter") {
                if (buffer.length >= MIN_LEN) {
                    e.preventDefault();
                    flush();
                }
                return;
            }
            if (e.key.length === 1) {
                buffer += e.key;
            }
        });
    }

    global.PawBarcodeHid = { attach: attachHidBarcodeListener };
})(window);

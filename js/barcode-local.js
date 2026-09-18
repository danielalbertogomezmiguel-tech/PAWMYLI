(function (global) {
    /**
     * Render Code128 locally (JsBarcode). Avoids external TEC-IT hotlink failures.
     */
    function render(target, code, options) {
        const value = String(code || "").trim();
        const el =
            typeof target === "string" ? document.getElementById(target) : target;
        if (!el || !value) return false;

        if (typeof global.JsBarcode === "function") {
            try {
                global.JsBarcode(el, value, Object.assign({
                    format: "CODE128",
                    displayValue: true,
                    fontSize: 14,
                    height: 64,
                    margin: 8,
                    background: "#ffffff",
                    lineColor: "#1a1a1a",
                }, options || {}));
                return true;
            } catch (_err) {
                /* fall through to external URL */
            }
        }

        const api =
            (global.PAWMYLI_CONFIG && global.PAWMYLI_CONFIG.barcodeApiUrl) ||
            "https://barcode.tec-it.com/barcode.ashx";
        if (el.tagName === "IMG") {
            el.src =
                api +
                "?data=" +
                encodeURIComponent(value) +
                "&code=Code128&dpi=96&imagetype=png";
        }
        return false;
    }

    global.PawBarcodeLocal = { render: render };
})(window);

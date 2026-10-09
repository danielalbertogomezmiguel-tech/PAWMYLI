(function (global) {
    /**
     * Render Code128 locally (JsBarcode). If the library is missing, show the code as text.
     */
    function showAsText(el, value) {
        if (el.tagName === "IMG") {
            el.removeAttribute("src");
            el.alt = value;
            el.hidden = true;
            let label = el.nextElementSibling;
            if (!label || !label.classList || !label.classList.contains("barcode-fallback")) {
                label = document.createElement("p");
                label.className = "barcode-fallback";
                el.insertAdjacentElement("afterend", label);
            }
            label.textContent = value;
            return;
        }
        el.textContent = value;
    }

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
                /* library present but could not draw */
            }
        }

        showAsText(el, value);
        return false;
    }

    global.PawBarcodeLocal = { render: render };
})(window);

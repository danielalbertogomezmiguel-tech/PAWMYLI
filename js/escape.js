(function (factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (typeof window !== "undefined") {
        window.PawEscape = api;
        window.escapeHtml = api.escapeHtml;
    }
})(function () {
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function safeImageUrl(value, fallback) {
        const fb = fallback == null ? "" : String(fallback);
        if (value == null) return fb;
        const raw = String(value).trim();
        if (!raw) return fb;
        let url;
        try {
            url = new URL(raw);
        } catch (_) {
            return fb;
        }
        const protocol = String(url.protocol || "").toLowerCase();
        if (protocol === "https:" || protocol === "blob:") {
            if (protocol === "https:" && !url.hostname) return fb;
            if (/[\u0000-\u001F\u007F<>"'\\\s`]/.test(raw)) return fb;
            return raw;
        }
        if (protocol === "data:" && /^data:image\/[a-z0-9.+-]+/i.test(raw)) {
            return raw;
        }
        return fb;
    }

    return {
        escapeHtml: escapeHtml,
        safeImageUrl: safeImageUrl,
    };
});

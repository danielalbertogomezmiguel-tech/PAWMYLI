(function (factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (typeof window === "undefined") return;

    const env = window.PAWMYLI_ENV || {};
    const apiBase = api.applyStoredApiOverride(
        window.localStorage,
        (window.location && window.location.hostname) || "",
        env.PAWMYLI_API_BASE || "https://api-production-66b1.up.railway.app/api"
    );

    window.PAWMYLI_CONFIG = {
        apiBase: apiBase,
        apiBaseLocal: env.PAWMYLI_API_BASE_LOCAL || "http://127.0.0.1:3000/api",
        barcodeApiUrl: env.PAWMYLI_BARCODE_API_URL || "",
        defaultAvatarUrl:
            env.PAWMYLI_DEFAULT_AVATAR_URL ||
            "../assets/placeholder-pet.svg",
        defaultDoctorAvatarUrl:
            env.PAWMYLI_DEFAULT_DOCTOR_AVATAR_URL ||
            "../assets/placeholder-user.svg",
    };
})(function () {
    function isLoopbackHost(host) {
        const name = String(host || "")
            .trim()
            .toLowerCase()
            .replace(/^\[|\]$/g, "");
        return name === "localhost" || name === "127.0.0.1";
    }

    function isLocalApiUrl(value) {
        const raw = String(value || "").trim();
        if (!raw) return false;
        let url;
        try {
            url = new URL(raw);
        } catch (_) {
            return false;
        }
        if (url.username || url.password) return false;
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        return isLoopbackHost(url.hostname);
    }

    function resolveApiOverride(pageHost, stored) {
        const value = String(stored || "").trim();
        if (!value) return "";
        if (!isLoopbackHost(pageHost)) return "";
        if (!isLocalApiUrl(value)) return "";
        return value;
    }

    function applyStoredApiOverride(storage, pageHost, envBase) {
        let stored = "";
        try {
            stored = (storage && storage.getItem("pawmyliApiBase")) || "";
        } catch (_) {
            stored = "";
        }
        const override = resolveApiOverride(pageHost, stored);
        if (stored && !override) {
            try {
                storage.removeItem("pawmyliApiBase");
            } catch (_) {
                /* ignore */
            }
        }
        return override || envBase || "";
    }

    return {
        isLoopbackHost: isLoopbackHost,
        isLocalApiUrl: isLocalApiUrl,
        resolveApiOverride: resolveApiOverride,
        applyStoredApiOverride: applyStoredApiOverride,
    };
});

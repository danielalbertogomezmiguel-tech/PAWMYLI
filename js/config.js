(function (global) {
    const env = global.PAWMYLI_ENV || {};
    const override = localStorage.getItem("pawmyliApiBase");

    global.PAWMYLI_CONFIG = {
        apiBase: override || env.PAWMYLI_API_BASE || "https://api-production-66b1.up.railway.app/api",
        apiBaseLocal: env.PAWMYLI_API_BASE_LOCAL || "http://127.0.0.1:3000/api",
        barcodeApiUrl: env.PAWMYLI_BARCODE_API_URL || "https://barcode.tec-it.com/barcode.ashx",
        defaultAvatarUrl:
            env.PAWMYLI_DEFAULT_AVATAR_URL ||
            "https://cdn-icons-png.flaticon.com/512/616/616408.png",
        defaultDoctorAvatarUrl:
            env.PAWMYLI_DEFAULT_DOCTOR_AVATAR_URL ||
            "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
    };
})(window);

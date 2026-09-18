(function (global) {
    const env = global.PAWMYLI_ENV || {};
    const override = localStorage.getItem("pawmyliApiBase");

    global.PAWMYLI_CONFIG = {
        apiBase: override || env.PAWMYLI_API_BASE || "https://api-production-66b1.up.railway.app/api",
        apiBaseLocal: env.PAWMYLI_API_BASE_LOCAL || "http://127.0.0.1:3000/api",
        barcodeApiUrl: env.PAWMYLI_BARCODE_API_URL || "",
        defaultAvatarUrl:
            env.PAWMYLI_DEFAULT_AVATAR_URL ||
            "../assets/placeholder-pet.svg",
        defaultDoctorAvatarUrl:
            env.PAWMYLI_DEFAULT_DOCTOR_AVATAR_URL ||
            "../assets/placeholder-user.svg",
    };
})(window);

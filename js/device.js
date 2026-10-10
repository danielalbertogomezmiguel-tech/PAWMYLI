(function (factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
    if (typeof window !== "undefined") {
        window.PawDevice = api;
    }
})(function () {
    /**
     * Teléfono o tablet. No cuenta un portátil ni un PC, aunque tengan
     * cámara o pantalla táctil.
     *
     * Es móvil/tablet solo si se cumplen las dos cosas:
     *  1) Alguna de estas señales de dispositivo:
     *     - navigator.userAgentData.mobile === true
     *     - el user agent contiene Android, iPhone, iPad o iPod
     *     - iPadOS que se presenta como Macintosh y maxTouchPoints > 1
     *  2) El puntero principal es grueso: matchMedia("(pointer: coarse)").
     *
     * Un portátil táctil Windows no cumple (1) y se queda en escritorio.
     * Si el puntero es fino, también es escritorio (aunque el UA parezca móvil).
     */
    function isPhoneOrTablet(nav, matchMedia) {
        const device = nav || {};
        const ua = String(device.userAgent || "");
        const uaData = device.userAgentData;
        const uaDataMobile = !!(uaData && uaData.mobile === true);
        const uaMobile = /Android|iPhone|iPad|iPod/i.test(ua);
        const iPadOs = /Macintosh/i.test(ua) && Number(device.maxTouchPoints) > 1;
        if (!uaDataMobile && !uaMobile && !iPadOs) return false;
        if (typeof matchMedia !== "function") return false;
        const coarse = matchMedia("(pointer: coarse)");
        return !!(coarse && coarse.matches);
    }

    return { isPhoneOrTablet: isPhoneOrTablet };
});

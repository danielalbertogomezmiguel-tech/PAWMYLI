const path = require("path");
const { test, expect, devices } = require("@playwright/test");

const fakeVideo = path
    .resolve(__dirname, "..", "fixtures", "paw-abc123.y4m")
    .replace(/\\/g, "/");

test.use({
    launchOptions: {
        args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            "--use-file-for-fake-video-capture=" + fakeVideo,
        ],
    },
});

const API_HOST = "api-production-66b1.up.railway.app";
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const VET = {
    id: "vet-1",
    name: "Dra. Prueba",
    role: "vet",
    email: "vet@test.local",
};

const SCANNED = {
    id: "pet-scan",
    code: "PAW-ABC123",
    name: "Kira",
    species: "Perro",
    breed: "Mestizo",
    age: "2 años",
    sex: "Hembra",
    ownerName: "Ana",
    linkStatus: "LINKED",
    feeding: { status: "ACTIVE", mealsPerDay: 1, meals: [] },
    medicalRecords: [],
};

async function installApi(page, handler) {
    await page.addInitScript(() => {
        if (sessionStorage.getItem("__pawTestInit") === "1") return;
        sessionStorage.clear();
        ["pawmyliAccessToken", "pawmyliRefreshToken", "usuarioActivo", "recordarSesion", "pacienteID"].forEach(
            (key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            }
        );
        sessionStorage.setItem("pawmyliAccessToken", "access-1");
        sessionStorage.setItem("pawmyliRefreshToken", "refresh-1");
        sessionStorage.setItem(
            "usuarioActivo",
            JSON.stringify({
                id: "vet-1",
                name: "Dra. Prueba",
                role: "vet",
                email: "vet@test.local",
            })
        );
        sessionStorage.setItem("__pawTestInit", "1");
    });

    await page.route("**/*", async (route) => {
        const request = route.request();
        const reqUrl = request.url();
        let host = "";
        let path = "";
        try {
            const parsed = new URL(reqUrl);
            host = parsed.hostname;
            path = parsed.pathname;
        } catch (_) {
            host = "";
        }
        if (host === "127.0.0.1" || host === "localhost" || host === "cdnjs.cloudflare.com") {
            await route.continue();
            return;
        }
        if (host !== API_HOST) {
            await route.abort();
            return;
        }
        if (request.method() === "OPTIONS") {
            await route.fulfill({ status: 204, headers: CORS, body: "" });
            return;
        }
        const result = await handler({ path: path, method: request.method() });
        const payload = !result || result.body === undefined ? {} : result.body;
        await route.fulfill({
            status: (result && result.status) || 200,
            contentType: "application/json",
            headers: CORS,
            body: typeof payload === "string" ? payload : JSON.stringify(payload),
        });
    });
}

function apiForScan(codes) {
    return async ({ path }) => {
        if (path.includes("/patients/code/")) {
            codes.push(path);
            return { body: SCANNED };
        }
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.includes("/patients")) return { body: { data: [], meta: { total: 0 } } };
        if (path.includes("/link-requests")) return { body: [] };
        if (path.includes("/appointments")) return { body: { data: [] } };
        if (path.includes("/inbox")) return { body: { data: [] } };
        if (path.includes("/feeding")) return { body: [] };
        if (path.includes("/config")) return { body: { clinicName: "Clínica Luna" } };
        return { body: {} };
    };
}

test.describe("escritorio", () => {
    test.use({
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    test("el botón abre el modal de texto y no pide la cámara", async ({ page }) => {
        await page.addInitScript(() => {
            window.__gum = 0;
            const media = navigator.mediaDevices;
            if (!media || !media.getUserMedia) return;
            const orig = media.getUserMedia.bind(media);
            media.getUserMedia = function () {
                window.__gum += 1;
                return orig.apply(this, arguments);
            };
        });
        await installApi(page, apiForScan([]));
        await page.goto("/pacientes/paciente.html");
        await expect(page.locator(".qr")).toBeVisible();
        await page.locator(".qr").click();
        await expect(page.locator("#pawModalCodigo")).toBeVisible();
        await expect(page.locator("#pawModalCamara")).toHaveCount(0);
        await expect(page.locator("script[src*='zxing']")).toHaveCount(0);
        expect(await page.evaluate(() => window.__gum || 0)).toBe(0);
        await page.locator("#pawModalCodigo [data-paw-code-cancel]").first().click();
        await expect(page.locator("#pawModalCodigo")).toBeHidden();
    });
});

test.describe("móvil", () => {
    const pixel = devices["Pixel 7"];
    test.use({
        viewport: pixel.viewport,
        userAgent: pixel.userAgent,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: pixel.deviceScaleFactor,
    });

    test("la cámara lee PAW-ABC123 y abre ese paciente", async ({ page }) => {
        const codes = [];
        await page.addInitScript(() => {
            const orig = MediaStreamTrack.prototype.stop;
            MediaStreamTrack.prototype.stop = function () {
                localStorage.setItem(
                    "__trackStops",
                    String(Number(localStorage.getItem("__trackStops") || 0) + 1)
                );
                return orig.apply(this, arguments);
            };
        });
        await installApi(page, apiForScan(codes));
        await page.goto("/pacientes/paciente.html");
        const detected = await page.evaluate(() =>
            PawDevice.isPhoneOrTablet(navigator, (query) => matchMedia(query))
        );
        expect(detected).toBe(true);
        await page.locator(".qr").click();
        await expect(page.locator("#pawModalCamara")).toBeVisible();
        await expect(page).toHaveURL(/perfil\/perfil\.html/, { timeout: 20000 });
        expect(codes.some((path) => path.endsWith("/patients/code/PAW-ABC123"))).toBe(true);
        const id = await page.evaluate(
            () => sessionStorage.getItem("pacienteID") || localStorage.getItem("pacienteID")
        );
        expect(id).toBe("pet-scan");
        const stops = await page.evaluate(() => Number(localStorage.getItem("__trackStops") || 0));
        expect(stops).toBeGreaterThan(0);
    });

    test("si se niega la cámara se puede escribir el código", async ({ page }) => {
        const codes = [];
        await page.addInitScript(() => {
            const media = navigator.mediaDevices;
            media.getUserMedia = function () {
                return Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
            };
        });
        await installApi(page, apiForScan(codes));
        await page.goto("/pacientes/paciente.html");

        for (const viewport of [
            { width: 360, height: 740 },
            { width: 768, height: 1024 },
        ]) {
            await page.setViewportSize(viewport);
            await page.locator(".qr").click();
            const modal = page.locator("#pawModalCamara");
            await expect(modal).toBeVisible();
            await expect(modal.locator("[data-cam-error]")).toContainText("permiso");
            const close = modal.locator("[data-cam-close]");
            const box = await close.boundingBox();
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
            const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
            expect(scroll).toBeLessThanOrEqual(viewport.width);
            await close.click();
            await expect(modal).toHaveCount(0);
        }

        await page.setViewportSize({ width: 360, height: 740 });
        await page.locator(".qr").click();
        await page.locator("#pawCamaraManual").fill("paw-abc123");
        await page.locator("[data-cam-manual]").click();
        await expect(page).toHaveURL(/perfil\/perfil\.html/);
        expect(codes.some((path) => path.endsWith("/patients/code/PAW-ABC123"))).toBe(true);
        const id = await page.evaluate(() => sessionStorage.getItem("pacienteID"));
        expect(id).toBe("pet-scan");
    });
});

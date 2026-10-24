const { test, expect } = require("@playwright/test");

const API_HOST = "api-production-66b1.up.railway.app";
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const RED_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
);
const BLUE_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==",
    "base64"
);

const VET = {
    id: "vet-1",
    name: "Dra. Prueba",
    role: "vet",
    email: "vet@test.local",
    photo: "https://cdn.example/avatar.png?sig=expira",
};

const PATIENT = {
    id: "pet-1",
    code: "PAW-000001",
    name: "Luna",
    species: "Perro",
    breed: "Mestizo",
    age: "3 años",
    sex: "Hembra",
    ownerName: "Ana",
    ownerPhone: "5550001111",
    ownerEmail: "ana@test.local",
    color: "Blanco",
    photo: "https://cdn.example/luna.png?X-Amz-Signature=firmada",
    photoUrl: "https://cdn.example/luna.png?X-Amz-Signature=firmada",
    linkStatus: "LINKED",
    feeding: { status: "ACTIVE", mealsPerDay: 1, meals: [] },
    medicalRecords: [],
};

const VIEWPORTS = [
    { name: "escritorio", width: 1280, height: 800, touch: false },
    { name: "movil", width: 360, height: 740, touch: true },
];

function vetSession() {
    return {
        token: "access-1",
        refresh: "refresh-1",
        user: VET,
        pacienteId: "pet-1",
    };
}

async function installApi(page, handler) {
    await page.addInitScript((sess) => {
        if (sessionStorage.getItem("__pawTestInit") === "1") return;
        sessionStorage.clear();
        ["pawmyliAccessToken", "pawmyliRefreshToken", "usuarioActivo", "recordarSesion", "pacienteID"].forEach(
            (key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            }
        );
        sessionStorage.setItem("pawmyliAccessToken", sess.token);
        sessionStorage.setItem("pawmyliRefreshToken", sess.refresh);
        sessionStorage.setItem("usuarioActivo", JSON.stringify(sess.user));
        sessionStorage.setItem("pacienteID", sess.pacienteId);
        sessionStorage.setItem("__pawTestInit", "1");
    }, vetSession());

    await page.route("**/*", async (route) => {
        const request = route.request();
        let host = "";
        let path = "";
        try {
            const parsed = new URL(request.url());
            host = parsed.hostname;
            path = parsed.pathname;
        } catch (_) {
            host = "";
        }
        if (host === "127.0.0.1" || host === "localhost") {
            await route.continue();
            return;
        }
        if (host === "fonts.googleapis.com" || host === "fonts.gstatic.com" || host === "cdnjs.cloudflare.com") {
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
        const result = await handler({
            path,
            method: request.method(),
            request,
        });
        const payload = !result || result.body === undefined ? {} : result.body;
        await route.fulfill({
            status: (result && result.status) || 200,
            contentType: "application/json",
            headers: CORS,
            body: typeof payload === "string" ? payload : JSON.stringify(payload),
        });
    });
}

async function assertGuardarVisible(page) {
    const button = page.locator("#formEditar .modal-pie .guardar");
    await expect(button).toBeVisible();
    const viewport = page.viewportSize();
    if (viewport.width > 900) await button.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await button.evaluate((el) => el.blur());
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.height).toBeGreaterThan(30);
    if (viewport.width <= 900) expect(box.height).toBeGreaterThanOrEqual(44);
    await expect.poll(() => button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(44, 95, 90)");
    await button.click({ trial: true });
    await page.mouse.move(0, 0);
    await button.evaluate((el) => el.blur());
}

for (const viewport of VIEWPORTS) {
    test.describe("foto " + viewport.name + " " + viewport.width + "x" + viewport.height, () => {
        test.use({
            viewport: { width: viewport.width, height: viewport.height },
            hasTouch: viewport.touch,
            isMobile: viewport.touch,
        });

        test("reemplazar la foto al editar envía data URL y sin archivo no envía photo", async ({ page }) => {
            const puts = [];
            await installApi(page, async ({ path, method, request }) => {
                if (path.endsWith("/auth/profile") && method === "GET") return { body: VET };
                if (path.endsWith("/feeding/logs")) return { body: [] };
                if (path.endsWith("/feeding/summary")) return { body: { plan: null } };
                if (/\/patients\/[^/]+$/.test(path) && method === "PUT") {
                    puts.push(request.postDataJSON());
                    return { body: PATIENT };
                }
                if (/\/patients\/[^/]+$/.test(path)) return { body: PATIENT };
                return { body: {} };
            });

            await page.goto("/perfil/perfil.html");
            await expect(page.locator("#nombrePaciente")).toHaveText("Luna");
            await page.locator("button.editar").click();
            await expect(page.locator("#modalEditar.activo")).toBeVisible();
            await expect(page.locator("#editFotoActual")).toBeVisible();
            await expect(page.locator("#editFotoActual")).toHaveAttribute("src", /luna\.png/);
            await expect(page.locator("#editFotoNuevaWrap")).toBeHidden();
            await assertGuardarVisible(page);

            await page.locator("#editFoto").setInputFiles({
                name: "luna-nueva.png",
                mimeType: "image/png",
                buffer: RED_PNG,
            });
            await expect(page.locator("#editFotoNuevaWrap")).toBeVisible();
            await expect(page.locator("#editFotoNueva")).toHaveAttribute("src", /^blob:/);
            await assertGuardarVisible(page);

            await page.locator("#formEditar .modal-pie .guardar").click();
            await expect.poll(() => puts.length).toBe(1);
            expect(puts[0].photo).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
            expect(puts[0].name).toBe("Luna");
            await expect(page.locator("#fotoPaciente")).toHaveAttribute("src", /^data:image\/(jpeg|png|webp);base64,/);
            await expect(page.locator("#modalEditar")).not.toHaveClass(/activo/);
            await expect(page.locator("#editFoto")).toHaveValue("");

            await page.locator("button.editar").click();
            await expect(page.locator("#editFotoNuevaWrap")).toBeHidden();
            await expect(page.locator("#editFoto")).toHaveValue("");
            await page.locator("#formEditar .modal-pie .guardar").click();
            await expect.poll(() => puts.length).toBe(2);
            expect(Object.prototype.hasOwnProperty.call(puts[1], "photo")).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(puts[1], "photoUrl")).toBe(false);
            expect(Object.prototype.hasOwnProperty.call(puts[1], "foto")).toBe(false);
        });

        test("reemplazar la foto del veterinario dos veces muestra la nueva", async ({ page }) => {
            const puts = [];
            await installApi(page, async ({ path, method, request }) => {
                if (path.endsWith("/auth/profile") && method === "GET") return { body: VET };
                if (path.endsWith("/auth/profile") && method === "PUT") {
                    puts.push(request.postDataJSON());
                    return { body: VET };
                }
                if (path.includes("/media/upload-url")) return { body: {} };
                if (path.endsWith("/config")) return { body: { clinicName: "Clínica Luna" } };
                return { body: {} };
            });

            await page.goto("/configuracion/configuracion.html");
            const foto = page.locator("#fotoUsuario");
            await expect(foto).toHaveAttribute("src", /avatar\.png/);
            await expect(page.locator(".cambiarFoto")).toBeVisible();
            const box = await foto.boundingBox();
            const viewportSize = page.viewportSize();
            expect(box).toBeTruthy();
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeLessThan(viewportSize.height);

            await page.locator("#foto").setInputFiles({
                name: "perfil-a.png",
                mimeType: "image/png",
                buffer: RED_PNG,
            });
            await expect.poll(() => puts.length).toBe(1);
            expect(puts[0].photo).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
            await expect(page.locator("#foto")).toHaveValue("");
            const first = await foto.getAttribute("src");
            expect(first).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
            expect(first).not.toContain("avatar.png");

            await page.locator("#foto").setInputFiles({
                name: "perfil-b.png",
                mimeType: "image/png",
                buffer: BLUE_PNG,
            });
            await expect.poll(() => puts.length).toBe(2);
            expect(puts[1].photo).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
            expect(puts[1].photo).not.toBe(puts[0].photo);
            await expect(page.locator("#foto")).toHaveValue("");
            const second = await foto.getAttribute("src");
            expect(second).toMatch(/^data:image\/(jpeg|png|webp);base64,/);
            expect(second).not.toBe(first);
        });
    });
}

const { test, expect } = require("@playwright/test");

const API_HOST = "api-production-66b1.up.railway.app";
const XSS = '<img src=x onerror="window.__xss=1">';
const NORMAL = "Lúa ñandú 🐶";
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

function patientFrom(fields) {
    return Object.assign(
        {
            id: "pet-1",
            code: "PAW-000001",
            barcodePayload: "PAW-000001",
            name: "Luna",
            species: "Perro",
            breed: "Mestizo",
            age: "3 años",
            sex: "Hembra",
            weight: "12 kg",
            color: "Café",
            microchip: "No",
            ownerName: "Ana",
            photo: "javascript:alert(1)",
            linkStatus: "LINKED",
            feeding: {
                status: "ACTIVE",
                mealsPerDay: 1,
                weightKg: 12,
                allowedFoods: "pollo",
                forbiddenFoods: "chocolate",
                meals: [{ label: "Desayuno", time: "08:00", amount: "60 g", food: "croquetas" }],
            },
            medicalRecords: [
                {
                    id: "rec-1",
                    date: "2026-01-02",
                    reason: "Control",
                    vetName: "Dra. Prueba",
                    status: "Finalizada",
                    type: "GENERAL",
                    consultationNumber: "1",
                },
            ],
        },
        fields
    );
}

async function openWithApi(page, options) {
    const fixtures = options.fixtures;
    const tecit = [];
    const missed = [];
    await page.addInitScript((pacienteId) => {
        sessionStorage.setItem("pawmyliAccessToken", "test-token");
        sessionStorage.setItem(
            "usuarioActivo",
            JSON.stringify({
                id: "vet-1",
                name: "Dra. Prueba",
                role: "vet",
                email: "vet@test.local",
            })
        );
        if (pacienteId) sessionStorage.setItem("pacienteID", pacienteId);
    }, options.pacienteId || "");

    await page.route("**/*", async (route) => {
        const request = route.request();
        const reqUrl = request.url();
        let host = "";
        try {
            host = new URL(reqUrl).hostname;
        } catch (_) {
            host = "";
        }
        if (reqUrl.includes("barcode.tec-it.com") || host === "barcode.tec-it.com") {
            tecit.push(reqUrl);
            await route.abort();
            return;
        }
        if (host === "127.0.0.1" || host === "localhost") {
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
        const body = mockApi(reqUrl, fixtures);
        if (body === undefined) {
            missed.push(reqUrl);
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                headers: CORS,
                body: JSON.stringify({ message: "unmocked" }),
            });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: CORS,
            body: JSON.stringify(body),
        });
    });

    await page.goto(options.path);
    return { tecit, missed };
}

function mockApi(url, fixtures) {
    const path = new URL(url).pathname;
    if (path.endsWith("/auth/profile")) return fixtures.profile;
    if (path.endsWith("/link-requests/pending")) return fixtures.pending;
    if (path.endsWith("/feeding/logs")) return fixtures.logs;
    if (path.endsWith("/feeding/summary")) return fixtures.summary;
    if (/\/patients\/[^/]+$/.test(path)) return fixtures.patient;
    if (path.endsWith("/patients")) return { data: fixtures.list, meta: { total: fixtures.list.length } };
    return undefined;
}

function xssFixtures() {
    const patient = patientFrom({
        name: XSS,
        breed: XSS,
        weight: XSS,
        color: XSS,
        ownerName: XSS,
        photo: "javascript:alert(1)",
        feeding: {
            status: "ACTIVE",
            mealsPerDay: 1,
            weightKg: 12,
            allowedFoods: XSS,
            forbiddenFoods: XSS,
            meals: [{ label: XSS, time: "08:00", amount: XSS, food: "croquetas" }],
        },
        medicalRecords: [
            {
                id: "rec-1",
                date: "2026-01-02",
                reason: XSS,
                vetName: XSS,
                status: "Finalizada",
                type: "GENERAL",
                consultationNumber: "1",
            },
        ],
    });
    return {
        profile: { id: "vet-1", name: "Dra. Prueba", role: "vet", email: "vet@test.local" },
        pending: [
            {
                id: "req-1",
                patientName: XSS,
                patientCode: "PAW-000001",
                requesterName: XSS,
                requestedRole: "OWNER",
                createdAt: "2026-01-15T12:00:00.000Z",
            },
        ],
        logs: [
            {
                meal: { label: XSS, time: "08:00" },
                scheduledDate: "2026-01-02",
                status: "EATEN",
                notes: XSS,
            },
        ],
        summary: { plan: null },
        patient: patient,
        list: [patient],
    };
}

async function expectNoXss(page) {
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
}

test("pacientes escapa vinculaciones, ficha y foto", async ({ page }) => {
    const { tecit, missed } = await openWithApi(page, {
        path: "/pacientes/paciente.html",
        fixtures: xssFixtures(),
    });

    const cards = page.locator("#contenedorPacientes");
    await expect(cards).toContainText(XSS);
    const cardText = await cards.innerText();
    expect(cardText.split(XSS).length - 1).toBeGreaterThanOrEqual(5);
    const src = await cards.locator("img.foto").first().getAttribute("src");
    expect(src || "").not.toMatch(/javascript:/i);
    expect(src).toContain("placeholder-pet");
    await expect(cards.locator("img")).toHaveCount(1);

    await page.locator("#vincularCodigo").click();
    const links = page.locator("#contenedorVinculaciones");
    await expect(links).toContainText(XSS);
    const linkText = await links.innerText();
    expect(linkText.split(XSS).length - 1).toBeGreaterThanOrEqual(2);
    await expectNoXss(page);
    expect(tecit).toEqual([]);
    expect(missed).toEqual([]);
});

test("perfil escapa alimentación, editor, historial y alimentos", async ({ page }) => {
    const { tecit, missed } = await openWithApi(page, {
        path: "/perfil/perfil.html",
        pacienteId: "pet-1",
        fixtures: xssFixtures(),
    });

    await expect(page.locator("#listaFeedingLogs")).toContainText(XSS);
    await expect(page.locator("#listaComidas")).toContainText(XSS);
    await expect(page.locator("#listaAlimentacion")).toContainText("Permitidos:");
    await expect(page.locator("#listaAlimentacion")).toContainText("Prohibidos:");
    await expect(page.locator("#listaAlimentacion")).toContainText(XSS);
    await expect(page.locator("#editorComidas .meal-label")).toHaveValue(XSS);
    await expect(page.locator("#editorComidas .meal-amount")).toHaveValue(XSS);
    await expect(page.locator("#dietaPermitidos")).toHaveValue(XSS);
    await expect(page.locator("#dietaProhibidos")).toHaveValue(XSS);
    await expect(page.locator("#historial")).toContainText(XSS);
    await expect(page.locator("#codigoPaciente")).toHaveText("PAW-000001");
    await expect(page.locator(".barcode-fallback")).toHaveText("PAW-000001");

    const photo = await page.locator("#fotoPaciente").getAttribute("src");
    expect(photo || "").not.toMatch(/javascript:/i);
    expect(photo).toContain("placeholder-pet");
    await expect(page.locator("#listaFeedingLogs img, #listaComidas img, #historial img, #listaAlimentacion img")).toHaveCount(0);
    await expectNoXss(page);
    expect(tecit).toEqual([]);
    expect(missed).toEqual([]);
});

test("datos normales con acentos y emoji se ven igual", async ({ page }) => {
    const patient = patientFrom({
        name: NORMAL,
        breed: NORMAL,
        color: NORMAL,
        ownerName: NORMAL,
        photo: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    });
    const { tecit, missed } = await openWithApi(page, {
        path: "/pacientes/paciente.html",
        fixtures: {
            profile: { id: "vet-1", name: "Dra. Prueba", role: "vet", email: "vet@test.local" },
            pending: [],
            logs: [],
            summary: { plan: null },
            patient: patient,
            list: [patient],
        },
    });

    await expect(page.locator("#contenedorPacientes")).toContainText(NORMAL);
    const src = await page.locator("#contenedorPacientes img.foto").getAttribute("src");
    expect(src).toContain("data:image/png");
    await expectNoXss(page);
    expect(tecit).toEqual([]);
    expect(missed).toEqual([]);
});

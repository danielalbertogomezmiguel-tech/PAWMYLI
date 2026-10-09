const { test, expect } = require("@playwright/test");

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
    linkStatus: "LINKED",
    feeding: { status: "ACTIVE", mealsPerDay: 2, meals: [] },
    medicalRecords: [],
};

const APPT = {
    id: "appt-1",
    petName: "Luna",
    ownerName: "Ana",
    date: "2026-06-15",
    time: "10:00",
    status: "Programada",
    notes: "Control",
    patientId: "pet-1",
};

const MESSAGE = {
    id: "msg-1",
    title: "Aviso de control",
    body: "Luna tiene control el 15 de junio.",
    readAt: "2026-06-14T12:00:00.000Z",
    createdAt: "2026-06-14T12:00:00.000Z",
    payload: {},
};

const VIEWPORTS = [
    { width: 360, height: 740 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
];

const PAGES = [
    {
        name: "landing",
        path: "/index.html",
        auth: false,
        menu: "header.topbar a.brand",
        primary: "a.btn-primary",
        ready: "header.topbar",
    },
    {
        name: "login",
        path: "/auth/login.html",
        auth: false,
        menu: "a[href='registro.html']",
        primary: "#loginForm .btn-auth",
        ready: "#loginForm",
    },
    {
        name: "registro",
        path: "/auth/registro.html",
        auth: false,
        menu: "a[href='login.html']",
        primary: "#registroForm .btn-auth, form .btn-auth",
        ready: "form",
    },
    {
        name: "reset",
        path: "/auth/reset.html",
        auth: false,
        menu: "a[href='login.html']",
        primary: "#resetRequestForm .btn-auth",
        ready: "#resetRequestForm",
    },
    {
        name: "verify",
        path: "/auth/verify.html",
        auth: false,
        menu: "a[href='login.html']",
        primary: "a[href='login.html']",
        ready: "#msg",
    },
    {
        name: "dashboard",
        path: "/dashboard/index.html",
        auth: true,
        menu: ".sidebar nav a",
        primary: "a.panel-link",
        ready: "#listaConsultas",
        readyText: "Luna",
    },
    {
        name: "pacientes",
        path: "/pacientes/paciente.html",
        auth: true,
        menu: ".sidebar nav a",
        primary: "#nuevoPaciente",
        extra: ".qr",
        ready: "#nuevoPaciente",
        readyText: "Luna",
    },
    {
        name: "agenda",
        path: "/agenda/agenda.html",
        auth: true,
        menu: ".sidebar nav a",
        primary: "#formCita .guardar",
        ready: "#diasCalendario",
        agenda: true,
    },
    {
        name: "correo",
        path: "/correo/index.html",
        auth: true,
        menu: ".sidebar nav a",
        primary: "#btnMarcarLeidos",
        ready: "#listaCorreoCompleta",
        readyText: "Aviso de control",
    },
    {
        name: "configuracion",
        path: "/configuracion/configuracion.html",
        auth: true,
        menu: ".sidebar nav a",
        primary: "#guardarPerfil",
        ready: "#guardarPerfil",
    },
    {
        name: "perfil",
        path: "/perfil/perfil.html",
        auth: true,
        paciente: true,
        menu: ".sidebar nav a",
        primary: "#btnNuevaConsulta",
        ready: "#btnNuevaConsulta",
        readyText: "Luna",
    },
];

function mockBody(path) {
    if (path.includes("/auth/profile")) return VET;
    if (path.includes("/auth/refresh")) {
        return { accessToken: "access-1", refreshToken: "refresh-1", user: VET };
    }
    if (path.includes("/patients/link-requests/pending")) return [];
    if (path.includes("/feeding/logs")) return [];
    if (path.includes("/feeding")) return PATIENT.feeding;
    if (path.includes("/medical-records")) return [];
    if (path.includes("/reminders")) return [];
    if (path.includes("/members")) return [];
    if (path.includes("/appointments/month")) return [APPT];
    if (path.includes("/appointments")) return { data: [APPT] };
    if (path.includes("/inbox")) return { data: [MESSAGE] };
    if (path.includes("/config")) return { clinicName: "Clinica Luna", clinicAddress: "Calle 1" };
    if (/\/patients\/[^/?]+$/.test(path)) return PATIENT;
    if (path.includes("/patients")) return { data: [PATIENT] };
    return {};
}

async function installApi(page, session) {
    await page.addInitScript((sess) => {
        sessionStorage.clear();
        ["pawmyliAccessToken", "pawmyliRefreshToken", "usuarioActivo", "recordarSesion", "pacienteID"].forEach(
            (key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            }
        );
        if (sess) {
            if (sess.token) sessionStorage.setItem("pawmyliAccessToken", sess.token);
            if (sess.refresh) sessionStorage.setItem("pawmyliRefreshToken", sess.refresh);
            if (sess.user) sessionStorage.setItem("usuarioActivo", JSON.stringify(sess.user));
            if (sess.pacienteId) sessionStorage.setItem("pacienteID", sess.pacienteId);
        }
    }, session || null);

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
        if (host === "127.0.0.1" || host === "localhost") {
            await route.continue();
            return;
        }
        if (
            host === "fonts.googleapis.com" ||
            host === "fonts.gstatic.com" ||
            host === "cdnjs.cloudflare.com"
        ) {
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
        const payload = mockBody(path);
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: CORS,
            body: JSON.stringify(payload),
        });
    });
}

async function noHorizontalScroll(page) {
    const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        return {
            scrollWidth: Math.max(doc.scrollWidth, body ? body.scrollWidth : 0),
            innerWidth: window.innerWidth,
        };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
}

async function assertTappable(locator, viewportWidth) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x).toBeLessThan(viewportWidth);
    if (viewportWidth <= 900) {
        expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await locator.click({ trial: true });
}

test.describe("responsive layouts", () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install({ time: new Date(2026, 5, 15, 12, 0, 0) });
    });

    for (const viewport of VIEWPORTS) {
        for (const screen of PAGES) {
            test(`${screen.name} ${viewport.width}x${viewport.height}`, async ({ page }) => {
                test.setTimeout(45000);
                await page.setViewportSize(viewport);
                const session = screen.auth
                    ? {
                          token: "access-1",
                          refresh: "refresh-1",
                          user: VET,
                          pacienteId: screen.paciente ? "pet-1" : "",
                      }
                    : null;
                await installApi(page, session);
                await page.goto(screen.path);
                await expect(page.locator(screen.ready).first()).toBeVisible();
                if (screen.readyText) {
                    await expect(page.getByText(screen.readyText).first()).toBeVisible();
                }
                if (screen.name === "configuracion") {
                    await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
                }
                if (screen.auth) {
                    await expect(page.locator(".sidebar")).toBeVisible();
                }
                await page.evaluate(async () => {
                    if (document.fonts && document.fonts.ready) await document.fonts.ready;
                });

                if (screen.agenda) {
                    const day = page.locator("#diasCalendario .dia[data-dia='15']");
                    await expect(day).toBeVisible();
                    await day.click();
                    await expect(page.locator(".listaCitas .cita").first()).toContainText("Luna");
                }

                await noHorizontalScroll(page);

                const menu = page.locator(screen.menu).first();
                const primary = page.locator(screen.primary).first();
                await assertTappable(menu, viewport.width);
                if (screen.primary !== screen.menu) {
                    await assertTappable(primary, viewport.width);
                }
                if (screen.extra) {
                    await assertTappable(page.locator(screen.extra).first(), viewport.width);
                }

                await noHorizontalScroll(page);

                if (viewport.width === 1280) {
                    if (screen.name === "perfil") {
                        await expect(page.getByRole("button", { name: "Guardar plan" })).toBeVisible();
                        await expect(page.getByText("Sin historial médico")).toBeVisible();
                    }
                    await page.evaluate(() => {
                        window.scrollTo(0, 0);
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                        document.querySelectorAll("main, .lista, .listaCitas").forEach((el) => {
                            el.scrollTop = 0;
                        });
                    });
                    await expect(page).toHaveScreenshot(`${screen.name}-1280.png`, {
                        animations: "disabled",
                        caret: "hide",
                        maxDiffPixelRatio: 0.01,
                    });
                }
            });
        }
    }
});

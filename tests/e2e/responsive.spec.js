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

const SAMPLE_RECORD = {
    id: "rec-1",
    consultationNumber: 12,
    date: "2026-06-01",
    type: "GENERAL",
    reason: "Control general de la mascota",
    vetName: "Dra. Prueba",
    status: "Finalizada",
};

function mockBody(path, withRecords) {
    const patient = withRecords
        ? Object.assign({}, PATIENT, { medicalRecords: [SAMPLE_RECORD] })
        : PATIENT;
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
    if (/\/patients\/[^/?]+$/.test(path)) return patient;
    if (path.includes("/patients")) return { data: [patient] };
    return {};
}

async function installApi(page, session, options) {
    const withRecords = !!(options && options.withRecords);
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
        const payload = mockBody(path, withRecords);
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
                await installApi(page, session, {
                    withRecords: screen.name === "perfil" && viewport.width === 360,
                });
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

                if (viewport.width === 360 && screen.auth) {
                    const vetName = page.locator(".sidebar .perfilDoctor h2, .sidebar .perfil h2").first();
                    await expect(vetName).toBeVisible();
                    await expect(vetName).toHaveText("Dra. Prueba");
                    const nameStyle = await vetName.evaluate((el) => {
                        const style = getComputedStyle(el);
                        return {
                            textOverflow: style.textOverflow,
                            whiteSpace: style.whiteSpace,
                            overflowX: style.overflowX,
                        };
                    });
                    expect(nameStyle.textOverflow).toBe("ellipsis");
                    expect(nameStyle.whiteSpace).toBe("nowrap");
                    expect(nameStyle.overflowX).toBe("hidden");
                }

                if (screen.agenda && viewport.width <= 900) {
                    const dot = await page.locator(".filtro-punto.verde").evaluate((el) => {
                        const box = el.getBoundingClientRect();
                        const hit = getComputedStyle(el, "::after");
                        return {
                            visual: Math.max(box.width, box.height),
                            touchW: parseFloat(hit.width),
                            touchH: parseFloat(hit.height),
                        };
                    });
                    expect(dot.visual).toBeLessThanOrEqual(18);
                    expect(dot.touchW).toBeGreaterThanOrEqual(44);
                    expect(dot.touchH).toBeGreaterThanOrEqual(44);
                }

                if (screen.name === "perfil" && viewport.width === 360) {
                    const row = page.locator("#historial tr.historial-fila");
                    await expect(row).toHaveCount(1);
                    const card = await row.evaluate((tr) => {
                        const cells = Array.from(tr.querySelectorAll("td"));
                        return {
                            display: getComputedStyle(tr).display,
                            labels: cells.map((td) => ({
                                data: td.getAttribute("data-label"),
                                before: getComputedStyle(td, "::before").content,
                            })),
                        };
                    });
                    expect(card.display).toBe("block");
                    expect(card.labels.map((item) => item.data)).toEqual([
                        "Nº",
                        "Fecha",
                        "Tipo",
                        "Motivo",
                        "Veterinario",
                        "Estado",
                    ]);
                    for (const item of card.labels) {
                        expect(item.before).toContain(item.data);
                    }
                    await expect(page.getByText("Control general de la mascota")).toBeVisible();
                }

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

function touchTarget(el) {
    const rect = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    const width = parseFloat(after.width);
    const height = parseFloat(after.height);
    const icon = el.querySelector("i");
    const iconBox = icon ? icon.getBoundingClientRect() : null;
    return {
        hitW: Math.max(rect.width, Number.isFinite(width) ? width : 0),
        hitH: Math.max(rect.height, Number.isFinite(height) ? height : 0),
        visualW: rect.width,
        visualH: rect.height,
        icon: iconBox ? Math.max(iconBox.width, iconBox.height) : 0,
    };
}

test("áreas táctiles de al menos 44px a 360", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.clock.install({ time: new Date(2026, 5, 15, 12, 0, 0) });

    await page.goto("/auth/login.html");
    await expect(page.locator("#loginForm")).toBeVisible();
    const forgot = await page.locator(".extras a").evaluate(touchTarget);
    expect(forgot.hitW).toBeGreaterThanOrEqual(44);
    expect(forgot.hitH).toBeGreaterThanOrEqual(44);
    expect(forgot.visualH).toBeLessThan(30);

    const session = {
        token: "access-1",
        refresh: "refresh-1",
        user: VET,
        pacienteId: "pet-1",
    };
    await installApi(page, session);

    await page.goto("/agenda/agenda.html");
    await expect(page.locator("#diasCalendario")).toBeVisible();
    for (const id of ["#anterior", "#siguiente"]) {
        const hit = await page.locator(id).evaluate(touchTarget);
        expect(hit.hitW).toBeGreaterThanOrEqual(44);
        expect(hit.hitH).toBeGreaterThanOrEqual(44);
        expect(hit.visualW).toBeLessThan(44);
        expect(hit.icon).toBeLessThan(40);
    }

    await page.goto("/perfil/perfil.html");
    await expect(page.locator(".volver")).toBeVisible();
    const back = await page.locator(".volver").evaluate(touchTarget);
    expect(back.hitW).toBeGreaterThanOrEqual(44);
    expect(back.hitH).toBeGreaterThanOrEqual(44);
    expect(back.visualW).toBeLessThan(44);
    expect(back.icon).toBeLessThan(40);

    await page.locator("#modalConsulta").evaluate((el) => el.classList.add("activo"));
    const consultaClose = await page.locator(".cerrarModalConsulta").evaluate(touchTarget);
    expect(consultaClose.hitW).toBeGreaterThanOrEqual(44);
    expect(consultaClose.hitH).toBeGreaterThanOrEqual(44);
    expect(consultaClose.visualW).toBeLessThan(44);
    expect(consultaClose.icon).toBeLessThan(40);

    await page.evaluate(() => {
        window.PawUi.confirm("¿Guardar el plan de alimentación?", { title: "Guardar plan" });
        window.PawToast.show({ type: "info", message: "Aviso", duration: 0 });
    });
    const pawClose = await page.locator("#pawUiDialog .cerrarModal").evaluate(touchTarget);
    expect(pawClose.hitW).toBeGreaterThanOrEqual(44);
    expect(pawClose.hitH).toBeGreaterThanOrEqual(44);
    expect(pawClose.visualW).toBeLessThan(44);
    expect(pawClose.icon).toBeLessThan(40);
    const toastClose = await page.locator(".paw-toast-close").evaluate(touchTarget);
    expect(toastClose.hitW).toBeGreaterThanOrEqual(44);
    expect(toastClose.hitH).toBeGreaterThanOrEqual(44);
    expect(toastClose.visualW).toBeLessThan(44);
    expect(toastClose.visualH).toBeLessThan(44);
    expect(toastClose.icon).toBeLessThan(40);

    await page.goto("/pacientes/paciente.html");
    await expect(page.locator("#nuevoPaciente")).toBeVisible();
    await page.locator("#nuevoPaciente").click();
    const modalClose = await page.locator("#modal.activo .cerrarModal").evaluate(touchTarget);
    expect(modalClose.hitW).toBeGreaterThanOrEqual(44);
    expect(modalClose.hitH).toBeGreaterThanOrEqual(44);
    expect(modalClose.visualW).toBeLessThan(44);
    expect(modalClose.icon).toBeLessThan(40);

    await page.locator("#modal").evaluate((el) => el.classList.remove("activo"));
    await page.locator("#panelVinculaciones").evaluate((el) => {
        el.hidden = false;
    });
    const panelClose = await page.locator("#cerrarPanelVinculaciones").evaluate(touchTarget);
    expect(panelClose.hitW).toBeGreaterThanOrEqual(44);
    expect(panelClose.hitH).toBeGreaterThanOrEqual(44);
    expect(panelClose.visualW).toBeLessThan(44);
    expect(panelClose.icon).toBeLessThan(40);

    await page.evaluate(() => {
        window.PawUi.confirm("¿Guardar el perfil?", { title: "Guardar perfil" });
    });
    const settingsLike = await page.locator("#pawUiDialog .cerrarModal").evaluate(touchTarget);
    expect(settingsLike.hitW).toBeGreaterThanOrEqual(44);
    expect(settingsLike.hitH).toBeGreaterThanOrEqual(44);
    expect(settingsLike.icon).toBeLessThan(40);
});

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
    photo: "https://cdn.example/avatar.png?sig=expira",
};

function patientBase(extra) {
    return Object.assign(
        {
            id: "pet-1",
            code: "PAW-000001",
            name: "Luna",
            species: "Perro",
            breed: "Mestizo",
            age: "3 años",
            sex: "Hembra",
            ownerName: "Ana",
            photo: "https://cdn.example/luna.png",
            linkStatus: "LINKED",
            feeding: { status: "ACTIVE", mealsPerDay: 1, meals: [] },
            medicalRecords: [],
        },
        extra || {}
    );
}

async function installApi(page, handler, session) {
    await page.addInitScript((sess) => {
        if (sessionStorage.getItem("__pawTestInit") === "1") return;
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
        sessionStorage.setItem("__pawTestInit", "1");
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
        if (!result) {
            await route.fulfill({
                status: 500,
                contentType: "application/json",
                headers: CORS,
                body: JSON.stringify({ message: "unmocked " + path }),
            });
            return;
        }
        const payload = result.body === undefined ? {} : result.body;
        await route.fulfill({
            status: result.status || 200,
            contentType: "application/json",
            headers: CORS,
            body: typeof payload === "string" ? payload : JSON.stringify(payload),
        });
    });
}

function vetSession(extra) {
    return Object.assign({ token: "access-1", refresh: "refresh-1", user: VET }, extra || {});
}

async function storedSession(page) {
    return page.evaluate(() => ({
        access:
            sessionStorage.getItem("pawmyliAccessToken") ||
            localStorage.getItem("pawmyliAccessToken"),
        refresh:
            sessionStorage.getItem("pawmyliRefreshToken") ||
            localStorage.getItem("pawmyliRefreshToken"),
        user: sessionStorage.getItem("usuarioActivo") || localStorage.getItem("usuarioActivo"),
    }));
}

async function fillPrompt(page, value) {
    const input = page.locator("#pawUiPromptInput");
    await expect(input).toBeVisible();
    await input.fill(value);
    await page.locator("#pawUiDialog [data-paw-ui-confirm]").click();
}

test("configuración: nueva contraseña sin la actual no se envía", async ({ page }) => {
    const puts = [];
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile") && method === "GET") return { body: VET };
        if (path.endsWith("/auth/profile") && method === "PUT") {
            puts.push(request.postDataJSON());
            return { body: VET };
        }
        if (path.endsWith("/config")) return { body: { clinicName: "Clínica Luna" } };
        return null;
    }, vetSession());

    await page.goto("/configuracion/configuracion.html");
    await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
    await expect(page.locator("#passwordActual")).toBeVisible();
    await page.locator("#password").fill("nueva-clave");
    await page.locator("#guardarPerfil").click();
    await expect(page.locator("#pawToastContainer")).toContainText("contraseña actual");
    expect(puts).toEqual([]);
});

test("configuración: con la actual el body lleva currentPassword", async ({ page }) => {
    const puts = [];
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile") && method === "GET") return { body: VET };
        if (path.endsWith("/auth/profile") && method === "PUT") {
            puts.push(request.postDataJSON());
            return { body: VET };
        }
        if (path.endsWith("/config")) return { body: { clinicName: "Clínica Luna" } };
        return null;
    }, vetSession());

    await page.goto("/configuracion/configuracion.html");
    await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
    await page.locator("#passwordActual").fill("clave-actual");
    await page.locator("#password").fill("nueva-clave");
    await page.locator("#guardarPerfil").click();
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0].password).toBe("nueva-clave");
    expect(puts[0].currentPassword).toBe("clave-actual");
});

test("configuración: guardar el perfil sin cambiar la foto no envía photo", async ({ page }) => {
    const puts = [];
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile") && method === "GET") return { body: VET };
        if (path.endsWith("/auth/profile") && method === "PUT") {
            puts.push(request.postDataJSON());
            return { body: VET };
        }
        if (path.endsWith("/config")) return { body: { clinicName: "Clínica Luna" } };
        return null;
    }, vetSession());

    await page.goto("/configuracion/configuracion.html");
    await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
    await page.locator("#guardarPerfil").click();
    await expect.poll(() => puts.length).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(puts[0], "photo")).toBe(false);
});

test("refresh 401 con otro token guardado reintenta y no cierra la sesión", async ({ page }) => {
    const refreshCalls = [];
    let configHits = 0;
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile") && method === "GET") return { body: VET };
        if (path.endsWith("/auth/refresh") && method === "POST") {
            const body = request.postDataJSON();
            refreshCalls.push(body.refreshToken);
            if (body.refreshToken === "refresh-old") {
                return { status: 401, body: { message: "Token ya usado" } };
            }
            return {
                body: {
                    accessToken: "access-2",
                    refreshToken: "refresh-newer",
                    user: VET,
                },
            };
        }
        if (path.endsWith("/config")) {
            configHits += 1;
            if (configHits === 1) return { status: 401, body: { message: "Sesión expirada" } };
            return { body: { clinicName: "Clínica Luna" } };
        }
        return null;
    }, vetSession({ refresh: "refresh-old" }));

    await page.addInitScript(() => {
        const orig = window.fetch.bind(window);
        window.fetch = function (input, init) {
            const url = typeof input === "string" ? input : (input && input.url) || "";
            if (String(url).includes("/auth/refresh") && init && init.body) {
                try {
                    const body = JSON.parse(init.body);
                    if (body.refreshToken === "refresh-old") {
                        sessionStorage.setItem("pawmyliRefreshToken", "refresh-new");
                    }
                } catch (_) {
                    /* ignore */
                }
            }
            return orig(input, init);
        };
    });

    await page.goto("/configuracion/configuracion.html");
    await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
    await expect(page).not.toHaveURL(/login\.html/);
    expect(refreshCalls).toEqual(["refresh-old", "refresh-new"]);
    const session = await storedSession(page);
    expect(session.access).toBe("access-2");
    expect(session.user).toContain("vet");
});

test("registro: archivo de 2 MB avisa y no llama a la API", async ({ page }) => {
    const calls = [];
    await installApi(page, async ({ path, method }) => {
        if (path.endsWith("/auth/register") && method === "POST") {
            calls.push(true);
            return { body: {} };
        }
        return null;
    });

    await page.goto("/auth/registro.html");
    await page.locator("#nombre").fill("Dra. Ana");
    await page.locator("#clinica").fill("Clínica");
    await page.locator("#correo").fill("ana@clinica.test");
    await page.locator("#direccion").fill("Calle 1");
    await page.locator("#licencia").fill("LIC-1");
    await page.locator("#password").fill("secreto");
    await page.locator("#confirmar").fill("secreto");
    await page.locator("#documento").setInputFiles({
        name: "licencia.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(2 * 1024 * 1024),
    });
    await page.locator("#registroForm button[type='submit']").click();
    await expect(page.locator("#pawToastContainer")).toContainText("1.4 MB");
    expect(calls).toEqual([]);
});

test("registro: respuesta 413 muestra que el archivo es demasiado grande", async ({ page }) => {
    await installApi(page, async ({ path, method }) => {
        if (path.endsWith("/auth/register") && method === "POST") {
            return { status: 413, body: { message: "Payload Too Large" } };
        }
        return null;
    });

    await page.goto("/auth/registro.html");
    await page.locator("#nombre").fill("Dra. Ana");
    await page.locator("#clinica").fill("Clínica");
    await page.locator("#correo").fill("ana@clinica.test");
    await page.locator("#direccion").fill("Calle 1");
    await page.locator("#licencia").fill("LIC-1");
    await page.locator("#password").fill("secreto");
    await page.locator("#confirmar").fill("secreto");
    await page.locator("#documento").setInputFiles({
        name: "licencia.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
    });
    await page.locator("#registroForm button[type='submit']").click();
    await expect(page.locator("#pawToastContainer")).toContainText("El archivo es demasiado grande");
});

test("login con role owner avisa y no guarda tokens", async ({ page }) => {
    await installApi(page, async ({ path, method }) => {
        if (path.endsWith("/auth/login") && method === "POST") {
            return {
                body: {
                    accessToken: "owner-access",
                    refreshToken: "owner-refresh",
                    user: { id: "owner-1", name: "Ana", role: "owner", email: "ana@test.local" },
                },
            };
        }
        return null;
    });

    await page.goto("/auth/login.html");
    await page.locator("#correo").fill("ana@test.local");
    await page.locator("#password").fill("secreto");
    await page.locator("#loginForm button[type='submit']").click();
    await expect(page.locator("#pawToastContainer")).toContainText(
        "Esta web es para clínicas; usa la app PawMily"
    );
    await expect(page).toHaveURL(/login\.html/);
    const session = await storedSession(page);
    expect(session.access).toBeNull();
    expect(session.refresh).toBeNull();
    expect(session.user).toBeNull();
});

test("login con role vet entra al panel", async ({ page }) => {
    await installApi(page, async ({ path, method }) => {
        if (path.endsWith("/auth/login") && method === "POST") {
            return {
                body: {
                    accessToken: "vet-access",
                    refreshToken: "vet-refresh",
                    user: VET,
                },
            };
        }
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/appointments")) return { body: { data: [] } };
        if (path.endsWith("/patients")) return { body: { data: [], meta: { total: 0 } } };
        if (path.endsWith("/link-requests/pending")) return { body: [] };
        if (path.endsWith("/inbox")) return { body: { data: [] } };
        return { body: {} };
    });

    await page.goto("/auth/login.html");
    await page.locator("#correo").fill("vet@test.local");
    await page.locator("#password").fill("secreto");
    await page.locator("#loginForm button[type='submit']").click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator("#listaConsultas")).toContainText("No hay consultas");
    const session = await storedSession(page);
    expect(session.access).toBe("vet-access");
});

function dashboardApis(path) {
    if (path.endsWith("/appointments")) return { body: { data: [] } };
    if (path.endsWith("/patients")) return { body: { data: [], meta: { total: 0 } } };
    if (path.endsWith("/link-requests/pending")) return { body: [] };
    if (path.endsWith("/inbox")) return { body: { data: [] } };
    return null;
}

test("access token vencido: /auth/profile renueva una vez y la página sigue abierta", async ({ page }) => {
    const refreshCalls = [];
    const profileAuth = [];
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile") && method === "GET") {
            const auth = request.headers().authorization || "";
            profileAuth.push(auth);
            if (auth.indexOf("access-expired") !== -1) {
                return { status: 401, body: { message: "Sesión expirada" } };
            }
            return { body: VET };
        }
        if (path.endsWith("/auth/refresh") && method === "POST") {
            refreshCalls.push(request.postDataJSON().refreshToken);
            return {
                body: {
                    accessToken: "access-2",
                    refreshToken: "refresh-2",
                    user: VET,
                },
            };
        }
        return dashboardApis(path) || { body: {} };
    }, vetSession({ token: "access-expired", refresh: "refresh-valid" }));

    await page.goto("/dashboard/index.html");
    await expect(page).not.toHaveURL(/login\.html/);
    await expect(page.locator("#listaConsultas")).toContainText("No hay consultas");
    expect(refreshCalls).toEqual(["refresh-valid"]);
    expect(profileAuth.filter((value) => value.indexOf("access-expired") !== -1).length).toBe(1);
    expect(profileAuth.some((value) => value.indexOf("access-2") !== -1)).toBe(true);
    const session = await storedSession(page);
    expect(session.access).toBe("access-2");
});

test("si /auth/refresh responde 401 se cierra la sesión y va al login", async ({ page }) => {
    await installApi(page, async ({ path, method }) => {
        if (path.endsWith("/auth/profile") && method === "GET") {
            return { status: 401, body: { message: "Sesión expirada" } };
        }
        if (path.endsWith("/auth/refresh") && method === "POST") {
            return { status: 401, body: { message: "Token inválido" } };
        }
        return dashboardApis(path) || { body: {} };
    }, vetSession({ token: "access-expired", refresh: "refresh-invalid" }));

    await page.goto("/dashboard/index.html");
    await expect(page).toHaveURL(/login\.html/);
    const session = await storedSession(page);
    expect(session.access).toBeNull();
    expect(session.refresh).toBeNull();
    expect(session.user).toBeNull();
});

function inboxFixture() {
    return {
        data: [
            {
                id: "msg-1",
                type: "appointment_request",
                title: "Solicitud de cita",
                body: "Control",
                createdAt: "2026-10-07T12:00:00.000Z",
                readAt: null,
                payload: {
                    appointmentId: "appt-1",
                    petName: "Luna",
                    ownerName: "Ana",
                    date: "2026-10-20",
                    time: "09:00",
                    reason: "Control",
                },
            },
        ],
    };
}

async function openCorreo(page, suggests) {
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/inbox") && method === "GET") return { body: inboxFixture() };
        if (path.endsWith("/suggest") && method === "POST") {
            suggests.push(request.postDataJSON());
            return { body: {} };
        }
        if (path.includes("/inbox/") && method === "POST") return { body: {} };
        return null;
    }, vetSession());
    await page.goto("/correo/index.html");
    await expect(page.locator(".btn-sugerir")).toBeVisible();
}

test("sugerir fecha pasada o hora inválida no envía", async ({ page }) => {
    const suggests = [];
    await openCorreo(page, suggests);
    await page.locator(".btn-sugerir").click();
    await fillPrompt(page, "2020-01-01");
    await expect(page.locator("#pawToastContainer")).toContainText("no sea pasada");
    expect(suggests).toEqual([]);

    await page.locator(".btn-sugerir").click();
    await fillPrompt(page, "2026-12-01");
    await fillPrompt(page, "99:99");
    await expect(page.locator("#pawToastContainer")).toContainText("HH:MM");
    expect(suggests).toEqual([]);
});

test("sugerir fecha válida envía date y time", async ({ page }) => {
    const suggests = [];
    await openCorreo(page, suggests);
    await page.locator(".btn-sugerir").click();
    await fillPrompt(page, "2026-12-01");
    await fillPrompt(page, "14:30");
    await expect.poll(() => suggests.length).toBe(1);
    expect(suggests[0]).toEqual({ date: "2026-12-01", time: "14:30" });
});

test("estados En Proceso y en proceso comparten el mismo filtro", async ({ page }) => {
    const patient = patientBase({
        medicalRecords: [
            {
                id: "rec-1",
                date: "2026-10-01",
                reason: "Control A",
                status: "En Proceso",
                type: "GENERAL",
                vetName: "Dra. Prueba",
            },
            {
                id: "rec-2",
                date: "2026-10-02",
                reason: "Control B",
                status: "en proceso",
                type: "GENERAL",
                vetName: "Dra. Prueba",
            },
        ],
    });
    await installApi(page, async ({ path }) => {
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/feeding/logs")) return { body: [] };
        if (path.endsWith("/feeding/summary")) return { body: { plan: null } };
        if (/\/patients\/[^/]+$/.test(path)) return { body: patient };
        return null;
    }, vetSession({ pacienteId: "pet-1" }));

    await page.goto("/perfil/perfil.html");
    const estados = page.locator("#historial .estado");
    await expect(estados).toHaveCount(2);
    await expect(estados.nth(0)).toHaveClass(/proceso/);
    await expect(estados.nth(1)).toHaveClass(/proceso/);
    await expect(estados.nth(0)).not.toHaveClass(/cancelada/);
    await expect(estados.nth(1)).not.toHaveClass(/cancelada/);
    await expect(page.locator("#historial")).toContainText("En Proceso");
    await expect(page.locator("#historial")).toContainText("en proceso");
    await expect(page.locator("#consultaEstado option").first()).toHaveText("En Proceso");
});

async function openConsultaConReceta(page, typePayload) {
    const schedules = [];
    const patient = patientBase({
        medicalRecords: [
            {
                id: "rec-1",
                date: "2026-10-01",
                reason: "Infección",
                status: "Finalizada",
                type: "GENERAL",
                vetName: "Dra. Prueba",
                medication: "Amoxicilina",
                typePayload: Object.assign({ medication: "Amoxicilina" }, typePayload),
            },
        ],
    });
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/feeding/logs")) return { body: [] };
        if (path.endsWith("/feeding/summary")) return { body: { plan: null } };
        if (path.endsWith("/schedule-medication") && method === "POST") {
            schedules.push(request.postDataJSON());
            return { body: { created: 3, medication: "Amoxicilina" } };
        }
        if (/\/patients\/[^/]+$/.test(path)) return { body: patient };
        return null;
    }, vetSession({ pacienteId: "pet-1" }));
    await page.goto("/perfil/perfil.html");
    await page.locator("tr.historial-fila").click();
    await expect(page.locator("#btnProgramarMedicamento")).toBeVisible();
    return schedules;
}

test("medicina: cada 8 horas por 5 días propone 8 y 5", async ({ page }) => {
    const schedules = await openConsultaConReceta(page, {
        medFrequency: "cada 8 horas",
        duration: "por 5 días",
    });
    await page.locator("#btnProgramarMedicamento").click();
    await fillPrompt(page, "2026-12-01");
    await fillPrompt(page, "09:00");
    await expect(page.locator("#pawUiPromptInput")).toHaveValue("8");
    await page.locator("#pawUiDialog [data-paw-ui-confirm]").click();
    await expect(page.locator("#pawUiPromptInput")).toHaveValue("5");
    await page.locator("#pawUiDialog [data-paw-ui-confirm]").click();
    await expect.poll(() => schedules.length).toBe(1);
    expect(schedules[0]).toEqual({
        firstDoseDate: "2026-12-01",
        firstDoseTime: "09:00",
        intervalHours: 8,
        durationDays: 5,
    });
});

test("medicina: 3 veces al día propone 8 horas", async ({ page }) => {
    await openConsultaConReceta(page, {
        medFrequency: "3 veces al día",
        duration: "por 5 días",
    });
    await page.locator("#btnProgramarMedicamento").click();
    await fillPrompt(page, "2026-12-01");
    await fillPrompt(page, "09:00");
    await expect(page.locator("#pawUiPromptInput")).toHaveValue("8");
    await page.locator("#pawUiDialog [data-paw-ui-cancel].btn-secundario").click();
});

test("medicina: según indicación deja los campos vacíos y obligatorios", async ({ page }) => {
    const schedules = await openConsultaConReceta(page, {
        medFrequency: "según indicación",
        duration: "según indicación",
    });
    await page.locator("#btnProgramarMedicamento").click();
    await fillPrompt(page, "2026-12-01");
    await fillPrompt(page, "09:00");
    await expect(page.locator("#pawUiPromptInput")).toHaveValue("");
    await page.locator("#pawUiDialog [data-paw-ui-confirm]").click();
    await expect(page.locator("#pawToastContainer")).toContainText("horas entre tomas");
    expect(schedules).toEqual([]);

    await page.locator("#btnProgramarMedicamento").click();
    await fillPrompt(page, "2026-12-01");
    await fillPrompt(page, "09:00");
    await page.locator("#pawUiPromptInput").fill("8");
    await page.locator("#pawUiDialog [data-paw-ui-confirm]").click();
    await expect(page.locator("#pawUiPromptInput")).toHaveValue("");
    await page.locator("#pawUiDialog [data-paw-ui-confirm]").click();
    await expect(page.locator("#pawToastContainer")).toContainText("días de tratamiento");
    expect(schedules).toEqual([]);
});

test("medicina: la primera toma no puede quedar en el pasado", async ({ page }) => {
    const schedules = await openConsultaConReceta(page, {
        medFrequency: "cada 8 horas",
        duration: "por 5 días",
    });
    await page.locator("#btnProgramarMedicamento").click();
    await fillPrompt(page, "2020-01-01");
    await fillPrompt(page, "09:00");
    await expect(page.locator("#pawToastContainer")).toContainText("pasado");
    expect(schedules).toEqual([]);
});

test("alimentación: percent null muestra Sin datos aún y 50 muestra 50%", async ({ page }) => {
    const patient = patientBase();
    async function openWithPercent(percent) {
        await installApi(page, async ({ path }) => {
            if (path.endsWith("/auth/profile")) return { body: VET };
            if (path.endsWith("/feeding/logs")) return { body: [] };
            if (path.endsWith("/feeding/summary")) {
                return {
                    body: {
                        plan: { status: "ACTIVE" },
                        compliance: {
                            percent: percent,
                            scheduled: 4,
                            eaten: 2,
                            partial: 0,
                            unlogged: 2,
                        },
                        week: { days: [], meals: [] },
                    },
                };
            }
            if (/\/patients\/[^/]+$/.test(path)) return { body: patient };
            return null;
        }, vetSession({ pacienteId: "pet-1" }));
        await page.goto("/perfil/perfil.html");
        return page.locator("#feedingSummaryCards .card-mini").first();
    }

    const vacio = await openWithPercent(null);
    await expect(vacio).toContainText("Sin datos aún");
    await expect(vacio).not.toContainText("%");

    const mitad = await openWithPercent(50);
    await expect(mitad).toContainText("50%");
});

test("alimentación: al guardar el plan las comidas existentes llevan su id", async ({ page }) => {
    const puts = [];
    const patient = patientBase({
        feeding: {
            status: "ACTIVE",
            mealsPerDay: 2,
            meals: [
                { id: "meal-1", label: "Desayuno", time: "08:00", amount: "60 g" },
                { id: "meal-2", label: "Cena", time: "20:00", amount: "40 g" },
            ],
        },
    });
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/feeding/logs")) return { body: [] };
        if (path.endsWith("/feeding/summary")) return { body: { plan: null } };
        if (path.endsWith("/feeding") && method === "PUT") {
            puts.push(request.postDataJSON());
            return { body: patient.feeding };
        }
        if (/\/patients\/[^/]+$/.test(path)) return { body: patient };
        return null;
    }, vetSession({ pacienteId: "pet-1" }));

    await page.goto("/perfil/perfil.html");
    await expect(page.locator("#editorComidas .comida-row")).toHaveCount(2);
    await page.locator("#btnAddComida").click();
    await expect(page.locator("#editorComidas .comida-row")).toHaveCount(3);
    await page.locator("#dietaPeso").fill("12");
    await page.locator("#btnGuardarDietaManual").click();
    await expect.poll(() => puts.length).toBe(1);
    const meals = puts[0].meals;
    expect(meals.find((m) => m.label === "Desayuno").id).toBe("meal-1");
    expect(meals.find((m) => m.label === "Cena").id).toBe("meal-2");
    const nueva = meals.find((m) => m.label === "Comida");
    expect(nueva).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(nueva, "id")).toBe(false);
});

test("alimentación: si el paciente no trae meals, se usan las de getFeeding", async ({ page }) => {
    const puts = [];
    const meals = [
        { id: "meal-1", label: "Desayuno", time: "08:00", amount: "60 g" },
        { id: "meal-2", label: "Cena", time: "19:00", amount: "40 g" },
    ];
    const patient = patientBase({
        feeding: { status: "ACTIVE", mealsPerDay: 2 },
    });
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/feeding/logs")) return { body: [] };
        if (path.endsWith("/feeding/summary")) return { body: { plan: null } };
        if (path.endsWith("/feeding") && method === "GET") return { body: { meals: meals } };
        if (path.endsWith("/feeding") && method === "PUT") {
            puts.push(request.postDataJSON());
            return { body: { meals: meals } };
        }
        if (/\/patients\/[^/]+$/.test(path)) return { body: patient };
        return null;
    }, vetSession({ pacienteId: "pet-1" }));

    await page.goto("/perfil/perfil.html");
    await expect(page.locator("#listaComidas")).toContainText("Desayuno");
    await expect(page.locator("#listaComidas")).toContainText("Cena");
    await expect(page.locator("#listaComidas")).not.toContainText("Sin comidas programadas");
    await expect(page.locator("#editorComidas .meal-label").nth(0)).toHaveValue("Desayuno");
    await expect(page.locator("#editorComidas .meal-time").nth(0)).toHaveValue("08:00");
    await expect(page.locator("#editorComidas .meal-label").nth(1)).toHaveValue("Cena");
    await expect(page.locator("#editorComidas .meal-time").nth(1)).toHaveValue("19:00");
    await expect(page.locator("#editorComidas")).not.toContainText("1° comida");
    await page.locator("#dietaPeso").fill("12");
    await page.locator("#btnGuardarDietaManual").click();
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0].meals.find((m) => m.label === "Desayuno").id).toBe("meal-1");
    expect(puts[0].meals.find((m) => m.label === "Cena").id).toBe("meal-2");
});

test("alimentación: horas 12 h antiguas se muestran y se guardan en HH:MM", async ({ page }) => {
    const puts = [];
    const patient = patientBase({
        feeding: {
            status: "ACTIVE",
            mealsPerDay: 2,
            meals: [
                { id: "meal-am", label: "Desayuno", time: "7:00 a. m.", amount: "60 g" },
                { id: "meal-pm", label: "Cena", time: "8 pm", amount: "40 g" },
            ],
        },
    });
    await installApi(page, async ({ path, method, request }) => {
        if (path.endsWith("/auth/profile")) return { body: VET };
        if (path.endsWith("/feeding/logs")) return { body: [] };
        if (path.endsWith("/feeding/summary")) return { body: { plan: null } };
        if (path.endsWith("/feeding") && method === "PUT") {
            puts.push(request.postDataJSON());
            return { body: patient.feeding };
        }
        if (/\/patients\/[^/]+$/.test(path)) return { body: patient };
        return null;
    }, vetSession({ pacienteId: "pet-1" }));

    await page.goto("/perfil/perfil.html");
    await expect(page.locator("#editorComidas .meal-time").nth(0)).toHaveValue("07:00");
    await expect(page.locator("#editorComidas .meal-time").nth(1)).toHaveValue("20:00");
    await page.locator("#dietaPeso").fill("12");
    await page.locator("#btnGuardarDietaManual").click();
    await expect.poll(() => puts.length).toBe(1);
    const meals = puts[0].meals;
    expect(meals).toHaveLength(2);
    const desayuno = meals.find((m) => m.id === "meal-am");
    const cena = meals.find((m) => m.id === "meal-pm");
    expect(desayuno.time).toBe("07:00");
    expect(cena.time).toBe("20:00");
});

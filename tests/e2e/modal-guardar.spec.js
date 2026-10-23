const { test, expect } = require("@playwright/test");

const API_HOST = "api-production-66b1.up.railway.app";
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const TEAL = "rgb(44, 95, 90)";
const WHITE = "rgb(255, 255, 255)";
const SECONDARY = "rgb(247, 250, 251)";
const KEYBOARD_HEIGHT = 400;

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

const MOBILE_VIEWPORTS = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
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
    if (path.includes("/inbox")) return { data: [] };
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
        if (sess.token) sessionStorage.setItem("pawmyliAccessToken", sess.token);
        if (sess.refresh) sessionStorage.setItem("pawmyliRefreshToken", sess.refresh);
        if (sess.user) sessionStorage.setItem("usuarioActivo", JSON.stringify(sess.user));
        if (sess.pacienteId) sessionStorage.setItem("pacienteID", sess.pacienteId);
    }, session);

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
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: CORS,
            body: JSON.stringify(mockBody(path)),
        });
    });
}

async function boot(page, pacienteId) {
    await page.clock.install({ time: new Date(2026, 5, 15, 12, 0, 0) });
    await installApi(page, {
        token: "access-1",
        refresh: "refresh-1",
        user: VET,
        pacienteId: pacienteId || "",
    });
}

async function paint(locator) {
    return locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            position: style.position,
            hover: el.matches(":hover"),
            focus: el.matches(":focus"),
        };
    });
}

async function assertTeal(button) {
    const style = await paint(button);
    expect(style.hover).toBe(false);
    expect(style.focus).toBe(false);
    expect(style.backgroundColor).not.toBe(WHITE);
    expect(style.backgroundColor).toBe(TEAL);
    expect(style.color).toBe(WHITE);
    return style;
}

async function assertTappable(page, button) {
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    const viewport = page.viewportSize();
    expect(box).toBeTruthy();
    expect(box.height).toBeGreaterThan(30);
    expect(box.width).toBeGreaterThan(40);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x).toBeLessThan(viewport.width);
    if (viewport.width <= 900) expect(box.height).toBeGreaterThanOrEqual(44);
    await button.click({ trial: true });
    await page.mouse.move(0, 0);
    await button.evaluate((el) => el.blur());
}

async function releasePointer(page, button) {
    await page.mouse.move(0, 0);
    await button.evaluate((el) => el.blur());
}

async function assertViewportMeta(page) {
    const content = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(content).toContain("interactive-widget=resizes-content");
}

async function assertVentanaHeight(page, selector) {
    const fit = await page.locator(selector).evaluate((el) => {
        const style = getComputedStyle(el);
        return {
            max: parseFloat(style.maxHeight),
            inner: window.innerHeight,
            overflow: style.overflowY,
        };
    });
    expect(fit.max).toBeGreaterThan(fit.inner - 2);
    expect(fit.max).toBeLessThanOrEqual(fit.inner + 1);
    expect(fit.overflow).toBe("auto");
}

async function installScrollSpy(page) {
    await page.evaluate(() => {
        window.__pawScrolls = [];
        const orig = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (arg) {
            window.__pawScrolls.push({
                id: this.id || "",
                block: arg && arg.block,
            });
            return orig.apply(this, arguments);
        };
    });
}

async function assertMobileFooter(page, button, pie) {
    const buttonStyle = await assertTeal(button);
    expect(buttonStyle.position).not.toBe("sticky");
    if (pie) {
        const pieStyle = await paint(pie);
        expect(pieStyle.position).toBe("sticky");
        expect(pieStyle.backgroundColor).toBe(WHITE);
    }
    await assertTappable(page, button);
    await releasePointer(page, button);
}

async function assertKeyboard(page, field, button, ventana) {
    const size = page.viewportSize();
    await page.setViewportSize({ width: size.width, height: KEYBOARD_HEIGHT });
    await installScrollSpy(page);
    await field.focus();
    await page.evaluate(() => {
        window.__pawScrolls = [];
    });
    await expect
        .poll(async () => page.evaluate(() => (window.__pawScrolls || []).some((item) => item.block === "center")))
        .toBe(true);
    const fieldDomId = await field.evaluate((el) => el.id);
    const scrolls = await page.evaluate(() => window.__pawScrolls);
    expect(scrolls.some((item) => item.id === fieldDomId && item.block === "center")).toBe(true);
    const fieldBox = await field.boundingBox();
    expect(fieldBox).toBeTruthy();
    expect(fieldBox.y).toBeGreaterThanOrEqual(-1);
    expect(fieldBox.y).toBeLessThan(KEYBOARD_HEIGHT);
    await assertTeal(button);
    await assertVentanaHeight(page, ventana);
    await assertTappable(page, button);
}

async function assertDesktopButton(page, button, pie) {
    const style = await assertTeal(button);
    expect(style.position).not.toBe("sticky");
    if (pie) {
        const pieStyle = await paint(pie);
        expect(pieStyle.position).toBe("static");
        expect(pieStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    }
    await assertTappable(page, button);
    await releasePointer(page, button);
}

async function assertNoModalScroll(page, field) {
    await installScrollSpy(page);
    await field.focus();
    await page.waitForTimeout(450);
    const scrolls = await page.evaluate(() => window.__pawScrolls || []);
    expect(scrolls.filter((item) => item.block === "center")).toEqual([]);
}

async function fillMascota(page) {
    await page.locator("#nombre").fill("Luna");
    await page.locator("#especie").selectOption("Perro");
    await page.locator("#raza").fill("Mestizo");
    await page.locator("#anioNacimiento").fill("2022");
    await page.locator("#mesNacimiento").selectOption("6");
    await page.locator("#propietario").fill("Ana");
    await page.locator("#peso").fill("12.5");
    await page.locator("#color").fill("Blanco");
}

for (const viewport of MOBILE_VIEWPORTS) {
    test.describe(`guardar visible en móvil ${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport, isMobile: true, hasTouch: true });

        test("registrar mascota", async ({ page }) => {
            test.setTimeout(60000);
            await boot(page);
            await page.goto("/pacientes/paciente.html");
            await assertViewportMeta(page);
            await expect(page.locator("#nuevoPaciente")).toBeVisible();
            await expect(page.getByText("Luna").first()).toBeVisible();
            await page.locator("#nuevoPaciente").click();
            await expect(page.locator("#modal.activo")).toBeVisible();
            await fillMascota(page);
            await page.locator("#color").blur();
            const button = page.locator("#formMascota .modal-pie .guardar");
            const pie = page.locator("#formMascota .modal-pie");
            await assertMobileFooter(page, button, pie);
            await assertVentanaHeight(page, "#modal .ventana");
            await assertKeyboard(page, page.locator("#nombre"), button, "#modal .ventana");

            await page.setViewportSize(viewport);
            await page.locator("#modal").evaluate((el) => el.classList.remove("activo"));
            await page.setViewportSize(viewport);
            await page.locator("#modalExito").evaluate((el) => el.classList.add("activo"));
            const exito = page.locator("#btnVerExpediente");
            await assertMobileFooter(page, exito, page.locator("#modalExito .modal-pie"));
        });

        test("el teclado no tapa el campo ya enfocado", async ({ page }) => {
            test.setTimeout(60000);
            await boot(page);
            await page.goto("/pacientes/paciente.html");
            await expect(page.locator("#nuevoPaciente")).toBeVisible();
            await page.locator("#nuevoPaciente").click();
            await expect(page.locator("#modal.activo")).toBeVisible();
            await fillMascota(page);
            const color = page.locator("#color");
            await expect(color).toBeFocused();
            await page.waitForTimeout(400);
            await installScrollSpy(page);
            await page.evaluate(() => {
                window.__pawScrolls = [];
            });
            const openHeight = viewport.width === 360 ? 407 : 464;
            await page.setViewportSize({ width: viewport.width, height: openHeight });
            await expect
                .poll(async () =>
                    page.evaluate(() =>
                        (window.__pawScrolls || []).some((item) => item.id === "color" && item.block === "center")
                    )
                )
                .toBe(true);
            const fieldBox = await color.boundingBox();
            const pieBox = await page.locator("#formMascota .modal-pie").boundingBox();
            expect(fieldBox).toBeTruthy();
            expect(pieBox).toBeTruthy();
            expect(fieldBox.height).toBeGreaterThan(20);
            expect(fieldBox.y).toBeGreaterThanOrEqual(-1);
            expect(fieldBox.y).toBeLessThan(openHeight);
            expect(fieldBox.y + fieldBox.height).toBeLessThanOrEqual(pieBox.y + 1);
            const padding = await page.locator("#modal .ventana").evaluate((el) => getComputedStyle(el).scrollPaddingBottom);
            const pieHeight = Math.ceil(pieBox.height);
            expect(parseFloat(padding)).toBeGreaterThanOrEqual(pieHeight - 1);
        });

        test("editar paciente y consulta", async ({ page }) => {
            test.setTimeout(60000);
            await boot(page, "pet-1");
            await page.goto("/perfil/perfil.html");
            await assertViewportMeta(page);
            await expect(page.getByText("Luna").first()).toBeVisible();
            await page.locator(".editar").click();
            await expect(page.locator("#modalEditar.activo")).toBeVisible();
            await expect(page.locator("#editNombre")).toHaveValue("Luna");
            await page.locator("#editColor").fill("Negro");
            await page.locator("#editColor").blur();
            const editBtn = page.locator("#formEditar .modal-pie .guardar");
            await assertMobileFooter(page, editBtn, page.locator("#formEditar .modal-pie"));
            await assertKeyboard(page, page.locator("#editNombre"), editBtn, "#modalEditar .ventana");

            await page.setViewportSize(viewport);
            await page.locator("#modalEditar").evaluate((el) => el.classList.remove("activo"));
            await page.locator("#btnNuevaConsulta").click();
            await expect(page.locator("#modalConsulta.activo")).toBeVisible();
            await page.locator("#consultaMotivo").fill("Control general");
            await page.locator("#consultaObservaciones").fill("Come bien");
            await page.locator("#consultaObservaciones").blur();
            const consultaBtn = page.locator("#formConsulta .modal-pie .guardar");
            await assertMobileFooter(page, consultaBtn, page.locator("#formConsulta .modal-pie"));
            await assertKeyboard(
                page,
                page.locator("#consultaMotivo"),
                consultaBtn,
                "#modalConsulta .ventana"
            );
        });

        test("cita, perfil de usuario y diálogos", async ({ page }) => {
            test.setTimeout(60000);
            await boot(page);
            await page.goto("/agenda/agenda.html");
            await assertViewportMeta(page);
            await expect(page.locator("#diasCalendario")).toBeVisible();
            await page.locator("#nombreMascota").fill("Luna");
            await page.locator("#fecha").fill("2026-06-20");
            await page.locator("#dueno").fill("Ana");
            await page.locator("#hora").fill("10:30");
            await page.locator("#nota").fill("Control de vacunas");
            await page.locator("#nota").blur();
            const cita = page.locator("#formCita .guardar");
            await assertTeal(cita);
            expect((await paint(cita)).position).not.toBe("sticky");
            await assertTappable(page, cita);
            await page.setViewportSize({ width: viewport.width, height: KEYBOARD_HEIGHT });
            await assertNoModalScroll(page, page.locator("#nombreMascota"));
            await assertTeal(cita);
            await assertTappable(page, cita);

            await page.setViewportSize(viewport);
            await page.goto("/configuracion/configuracion.html");
            await assertViewportMeta(page);
            await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
            await page.locator("#telefono").fill("5551112222");
            for (const id of ["#guardarPerfil", "#guardarClinica", "#guardarPrefs"]) {
                const button = page.locator(id);
                await assertTeal(button);
                expect((await paint(button)).position).not.toBe("sticky");
                await assertTappable(page, button);
                await releasePointer(page, button);
            }
            await page.setViewportSize({ width: viewport.width, height: KEYBOARD_HEIGHT });
            await assertNoModalScroll(page, page.locator("#nombre"));
            await assertTeal(page.locator("#guardarPerfil"));

            await page.setViewportSize(viewport);
            await page.goto("/pacientes/paciente.html");
            await expect(page.locator("#nuevoPaciente")).toBeVisible();
            await page.evaluate(() => {
                window.PawUi.confirm("¿Guardar la mascota?", { title: "Confirmar", confirmLabel: "Guardar" });
            });
            const confirm = page.locator("#pawUiDialog .guardar");
            const cancel = page.locator("#pawUiDialog .btn-secundario");
            await expect(confirm).toBeFocused();
            await confirm.blur();
            await assertTeal(confirm);
            expect((await paint(confirm)).position).not.toBe("sticky");
            const acciones = await paint(page.locator("#pawUiDialog .modal-acciones"));
            expect(acciones.position).toBe("sticky");
            expect(acciones.backgroundColor).toBe(WHITE);
            const cancelStyle = await paint(cancel);
            expect(cancelStyle.backgroundColor).not.toBe(WHITE);
            expect(cancelStyle.backgroundColor).toBe(SECONDARY);
            expect(cancelStyle.color).toBe(TEAL);
            await assertTappable(page, confirm);

            await page.locator("#pawUiDialog [data-paw-ui-cancel].btn-secundario").click();
            await page.evaluate(() => {
                window.PawCodeModal.ask({ title: "Código", message: "Escribe el código" });
            });
            const continuar = page.locator("#pawModalCodigo .guardar");
            await expect(continuar).toBeVisible();
            await continuar.evaluate((el) => el.blur());
            await page.locator("#pawInputCodigo").fill("PAW-000001");
            await page.locator("#pawInputCodigo").blur();
            await assertTeal(continuar);
            expect((await paint(page.locator("#pawModalCodigo .modal-acciones"))).backgroundColor).toBe(WHITE);
            const secundario = await paint(page.locator("#pawModalCodigo .btn-secundario"));
            expect(secundario.backgroundColor).toBe(SECONDARY);
            expect(secundario.color).toBe(TEAL);
            await assertTappable(page, continuar);
            await page.setViewportSize({ width: viewport.width, height: KEYBOARD_HEIGHT });
            await assertKeyboard(page, page.locator("#pawInputCodigo"), continuar, "#pawModalCodigo .ventana");
        });
    });
}

test.describe("guardar en escritorio 1280 sin cambio", () => {
    test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

    test("modales y formularios conservan el estilo de escritorio", async ({ page }) => {
        test.setTimeout(60000);
        await boot(page, "pet-1");

        await page.goto("/pacientes/paciente.html");
        await expect(page.locator("#nuevoPaciente")).toBeVisible();
        await page.locator("#nuevoPaciente").click();
        await fillMascota(page);
        await page.locator("#color").blur();
        const mascota = page.locator("#formMascota .modal-pie .guardar");
        await assertDesktopButton(page, mascota, page.locator("#formMascota .modal-pie"));
        const desktopVentana = await page.locator("#modal .ventana").evaluate((el) => {
            const style = getComputedStyle(el);
            return { maxHeight: style.maxHeight, scrollPaddingBottom: style.scrollPaddingBottom };
        });
        expect(desktopVentana.maxHeight).toBe("720px");
        expect(["auto", "0px"]).toContain(desktopVentana.scrollPaddingBottom);
        await installScrollSpy(page);
        await page.locator("#nombre").focus();
        await page.waitForTimeout(450);
        expect(await page.evaluate(() => window.__pawScrolls)).toEqual([]);
        await page.evaluate(() => {
            window.__pawScrolls = [];
        });
        await page.setViewportSize({ width: 1280, height: 700 });
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => window.__pawScrolls)).toEqual([]);
        await page.setViewportSize({ width: 1280, height: 800 });

        await page.locator("#modal").evaluate((el) => el.classList.remove("activo"));
        await page.locator("#modalExito").evaluate((el) => el.classList.add("activo"));
        await assertDesktopButton(page, page.locator("#btnVerExpediente"), page.locator("#modalExito .modal-pie"));

        await page.goto("/perfil/perfil.html");
        await expect(page.getByText("Luna").first()).toBeVisible();
        await page.locator(".editar").click();
        await expect(page.locator("#editNombre")).toHaveValue("Luna");
        await page.locator("#editColor").fill("Negro");
        await assertDesktopButton(page, page.locator("#formEditar .modal-pie .guardar"), page.locator("#formEditar .modal-pie"));
        await page.locator("#modalEditar").evaluate((el) => el.classList.remove("activo"));
        await page.locator("#btnNuevaConsulta").click();
        await page.locator("#consultaMotivo").fill("Control general");
        await assertDesktopButton(
            page,
            page.locator("#formConsulta .modal-pie .guardar"),
            page.locator("#formConsulta .modal-pie")
        );
        await installScrollSpy(page);
        await page.locator("#consultaMotivo").focus();
        await page.waitForTimeout(450);
        expect(await page.evaluate(() => window.__pawScrolls)).toEqual([]);

        await page.goto("/agenda/agenda.html");
        await expect(page.locator("#diasCalendario")).toBeVisible();
        await page.locator("#nombreMascota").fill("Luna");
        await page.locator("#fecha").fill("2026-06-20");
        await page.locator("#dueno").fill("Ana");
        await page.locator("#hora").fill("10:30");
        const cita = page.locator("#formCita .guardar");
        await assertDesktopButton(page, cita, null);
        const citaWidths = await page.evaluate(() => {
            const button = document.querySelector("#formCita .guardar").getBoundingClientRect();
            const form = document.querySelector("#formCita").getBoundingClientRect();
            return { button: button.width, form: form.width };
        });
        expect(citaWidths.button).toBeLessThan(citaWidths.form - 40);

        await page.goto("/configuracion/configuracion.html");
        await expect(page.locator("#nombre")).toHaveValue("Dra. Prueba");
        for (const id of ["#guardarPerfil", "#guardarClinica", "#guardarPrefs"]) {
            await assertDesktopButton(page, page.locator(id), null);
        }

        await page.evaluate(() => {
            window.PawUi.confirm("¿Guardar?", { title: "Confirmar", confirmLabel: "Guardar" });
        });
        await expect(page.locator("#pawUiDialog .guardar")).toBeFocused();
        await page.locator("#pawUiDialog .guardar").blur();
        await assertDesktopButton(page, page.locator("#pawUiDialog .guardar"), null);
        const dialogPie = await paint(page.locator("#pawUiDialog .modal-acciones"));
        expect(dialogPie.position).not.toBe("sticky");
        expect(dialogPie.backgroundColor).not.toBe(WHITE);
        const cancel = await paint(page.locator("#pawUiDialog .btn-secundario"));
        expect(cancel.backgroundColor).toBe(SECONDARY);
        expect(cancel.color).toBe(TEAL);
    });
});

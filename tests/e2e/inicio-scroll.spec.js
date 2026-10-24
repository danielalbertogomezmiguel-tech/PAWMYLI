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

const LISTAS = [
    { id: "listaConsultas", link: "Ir a Agenda" },
    { id: "listaRecordatorios", link: null },
    { id: "listaSolicitudes", link: "Revisar en Agenda" },
    { id: "listaCorreo", link: "Abrir correo", correo: true },
    { id: "listaPacientesRecientes", link: "Ver pacientes" },
];

const VIEWPORTS = [
    { name: "escritorio 1280x800", width: 1280, height: 800, touch: false },
    { name: "tablet 820x1180", width: 820, height: 1180, touch: false },
    { name: "telefono 360x740", width: 360, height: 740, touch: true },
];

function filas(total, build) {
    const rows = [];
    for (let i = 0; i < total; i++) rows.push(build(i));
    return rows;
}

function mockDashboard(total, path, request) {
    if (path.endsWith("/auth/profile")) return { body: VET };
    if (path.endsWith("/patients/link-requests/pending")) return { body: [] };
    if (path.endsWith("/appointments")) {
        const date = new URL(request.url()).searchParams.get("date");
        if (date) {
            return {
                body: {
                    data: filas(total, (i) => ({
                        id: "hoy-" + i,
                        petName: "Hoy " + (i + 1),
                        ownerName: "Ana",
                        date,
                        time: String(8 + (i % 10)).padStart(2, "0") + ":00",
                        status: "Programada",
                        notes: "",
                    })),
                },
            };
        }
        return {
            body: {
                data: filas(total, (i) => ({
                    id: "sol-" + i,
                    petName: "Sol " + (i + 1),
                    ownerName: "Luis",
                    date: "2099-03-15",
                    time: "11:30",
                    status: "solicitada",
                    notes: "[Propuesta owner]",
                })),
            },
        };
    }
    if (path.endsWith("/inbox")) {
        return {
            body: {
                data: filas(total, (i) => ({
                    id: "msg-" + i,
                    title: "Nota " + (i + 1),
                    body: "Recordatorio de control para la mascota. Traer la cartilla de vacunas.",
                    readAt: null,
                    createdAt: "2026-10-23T12:00:00.000Z",
                    payload: {},
                })),
            },
        };
    }
    if (path.endsWith("/patients")) {
        return {
            body: {
                data: filas(total, (i) => ({
                    id: "pet-" + i,
                    name: "Paco " + (i + 1),
                    code: "PAW-00000" + (i + 1),
                    species: "Perro",
                })),
                meta: { total },
            },
        };
    }
    return { body: {} };
}

async function installApi(page, totalRef) {
    await page.addInitScript((sess) => {
        sessionStorage.clear();
        ["pawmyliAccessToken", "pawmyliRefreshToken", "usuarioActivo", "recordarSesion", "pacienteID", "pawmyliApiBase"].forEach(
            (key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            }
        );
        sessionStorage.setItem("pawmyliAccessToken", sess.token);
        sessionStorage.setItem("pawmyliRefreshToken", sess.refresh);
        sessionStorage.setItem("usuarioActivo", JSON.stringify(sess.user));
    }, { token: "access-1", refresh: "refresh-1", user: VET });

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
        const result = mockDashboard(totalRef.count, path, request);
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: CORS,
            body: JSON.stringify(result.body === undefined ? {} : result.body),
        });
    });
}

async function abrirInicio(page) {
    await page.clock.install({ time: new Date(2026, 9, 23, 12, 0, 0) });
    await page.goto("/dashboard/index.html");
    await expect(page.locator("#listaConsultas li").first()).toBeVisible();
    await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}

async function medidaLista(page, id) {
    return page.locator("#" + id).evaluate((ul) => {
        const box = ul.getBoundingClientRect();
        const tol = 2;
        const items = Array.from(ul.querySelectorAll(":scope > li"));
        const fully = items.map((li) => {
            const rect = li.getBoundingClientRect();
            return rect.height > 0 && rect.top >= box.top - tol && rect.bottom <= box.bottom + tol;
        });
        const style = getComputedStyle(ul);
        const contenido = ul.parentElement;
        const title = contenido.querySelector("h2").getBoundingClientRect();
        const link = contenido.querySelector("a.panel-link");
        const linkBox = link ? link.getBoundingClientRect() : null;
        const span = ul.querySelector("li span");
        let correoDosLineas = null;
        if (span) {
            const strong = span.parentElement.querySelector("strong");
            correoDosLineas = span.getBoundingClientRect().top >= strong.getBoundingClientRect().bottom - 1;
        }
        return {
            count: items.length,
            fully,
            scrollHeight: ul.scrollHeight,
            clientHeight: ul.clientHeight,
            maxHeight: ul.style.maxHeight,
            overflowY: style.overflowY,
            overscroll: style.overscrollBehaviorY,
            scrollbarWidth: style.scrollbarWidth,
            titleAbove: title.bottom <= box.top + tol,
            linkBelow: linkBox ? linkBox.top >= box.bottom - tol : null,
            linkInside: !!ul.querySelector("a.panel-link"),
            correoDosLineas,
        };
    });
}

async function esperarMedida(page, id, pred) {
    let last = null;
    await expect.poll(async () => {
        last = await medidaLista(page, id);
        return pred(last);
    }).toBe(true);
    return last;
}

for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
        test.use({
            viewport: { width: vp.width, height: vp.height },
            hasTouch: vp.touch,
            isMobile: vp.touch,
        });

        test("siete elementos muestran tres completos y el pie queda fuera", async ({ page }) => {
            const total = { count: 7 };
            await installApi(page, total);
            await abrirInicio(page);
            const overscroll = vp.width >= 901 ? "contain" : "auto";

            for (const lista of LISTAS) {
                await expect(page.locator("#" + lista.id + " li")).toHaveCount(7);
                const medida = await esperarMedida(page, lista.id, (row) => {
                    return (
                        row.count === 7 &&
                        row.fully[0] === true &&
                        row.fully[1] === true &&
                        row.fully[2] === true &&
                        row.fully.slice(3).every((flag) => flag === false) &&
                        row.scrollHeight > row.clientHeight &&
                        row.maxHeight !== "" &&
                        row.overflowY === "auto" &&
                        row.scrollbarWidth === "thin" &&
                        row.overscroll === overscroll &&
                        row.titleAbove === true &&
                        row.linkInside === false &&
                        (lista.link ? row.linkBelow === true : row.linkBelow === null)
                    );
                });
                expect(medida.fully.filter(Boolean)).toHaveLength(3);
                if (lista.correo) expect(medida.correoDosLineas).toBe(true);
                if (lista.link) {
                    const link = page.getByRole("link", { name: lista.link, exact: true });
                    await expect(link).toBeVisible();
                    const antes = await link.boundingBox();
                    await page.locator("#" + lista.id).evaluate((ul) => {
                        ul.scrollTop = ul.scrollHeight;
                    });
                    const despues = await link.boundingBox();
                    expect(Math.abs(despues.y - antes.y)).toBeLessThanOrEqual(1);
                    const alFinal = await medidaLista(page, lista.id);
                    expect(alFinal.fully[0]).toBe(false);
                    expect(alFinal.fully[alFinal.fully.length - 1]).toBe(true);
                    expect(alFinal.linkBelow).toBe(true);
                    await page.locator("#" + lista.id).evaluate((ul) => {
                        ul.scrollTop = 0;
                    });
                }
            }

            if (vp.width === 1280) {
                await page.setViewportSize({ width: 1100, height: 760 });
                for (const lista of LISTAS) {
                    await esperarMedida(page, lista.id, (row) => {
                        return (
                            row.fully[0] === true &&
                            row.fully[1] === true &&
                            row.fully[2] === true &&
                            row.fully.slice(3).every((flag) => flag === false) &&
                            row.scrollHeight > row.clientHeight
                        );
                    });
                }
            }
        });

        test("dos o tres elementos no hacen scroll", async ({ page }) => {
            const total = { count: 2 };
            await installApi(page, total);
            await abrirInicio(page);

            for (const count of [2, 3]) {
                total.count = count;
                if (count === 3) {
                    await page.reload();
                    await expect(page.locator("#listaConsultas li")).toHaveCount(3);
                    await page.evaluate(async () => {
                        if (document.fonts && document.fonts.ready) await document.fonts.ready;
                        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    });
                }
                for (const lista of LISTAS) {
                    await expect(page.locator("#" + lista.id + " li")).toHaveCount(count);
                    const medida = await esperarMedida(page, lista.id, (row) => {
                        return (
                            row.count === count &&
                            row.fully.every(Boolean) &&
                            row.scrollHeight <= row.clientHeight &&
                            row.maxHeight === "" &&
                            row.overflowY === "visible" &&
                            row.titleAbove === true &&
                            row.linkInside === false &&
                            (lista.link ? row.linkBelow === true : true)
                        );
                    });
                    if (lista.correo) expect(medida.correoDosLineas).toBe(true);
                    if (lista.link) {
                        await expect(page.getByRole("link", { name: lista.link, exact: true })).toBeVisible();
                    }
                }
            }
        });
    });
}

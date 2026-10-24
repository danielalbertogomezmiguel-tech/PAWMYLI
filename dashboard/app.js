if (!PawApi.requireAuth()) {
    // redirected to login — do not throw (Live Server / Chromium crash risk)
} else {
(function () {

function pintarSidebar() {
    PawApi.applySidebar();
}

function hoyISO() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function esCitaActiva(a) {
    return !/cancelad|eliminad/i.test(String(a && a.status || ""));
}

/** Vet accepts only owner proposals; web-created wait for the owner. */
function puedeVetAceptar(cita) {
    if (String(cita && cita.status || "").toLowerCase() !== "solicitada") return false;
    const notes = String((cita && cita.notes) || "");
    const tags = [...notes.matchAll(/\[Propuesta (vet|owner)\]/gi)];
    if (!tags.length) return true;
    return /owner/i.test(tags[tags.length - 1][1]);
}

function semanaRango() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

const LISTAS_INICIO = [
    "listaConsultas",
    "listaRecordatorios",
    "listaSolicitudes",
    "listaCorreo",
    "listaPacientesRecientes",
];
const FILAS_VISIBLES = 3;
let observadorListas = null;
let topePendiente = 0;
const listasObservadas = new WeakSet();

function listasInicio() {
    const listas = [];
    LISTAS_INICIO.forEach((id) => {
        const ul = document.getElementById(id);
        if (ul) listas.push(ul);
    });
    return listas;
}

function altoDeTresFilas(ul, items) {
    const siguiente = items[FILAS_VISIBLES];
    const tercera = items[FILAS_VISIBLES - 1];
    const ancla = siguiente || tercera;
    if (!ancla || ancla.offsetParent !== ul || !tercera.offsetHeight) return 0;
    const caja = getComputedStyle(ul);
    const padBottom = parseFloat(caja.paddingBottom) || 0;
    const bordes =
        (parseFloat(caja.borderTopWidth) || 0) + (parseFloat(caja.borderBottomWidth) || 0);
    let hasta;
    if (siguiente) {
        hasta = siguiente.offsetTop;
    } else {
        const gap = parseFloat(getComputedStyle(tercera).marginBottom) || 0;
        hasta = tercera.offsetTop + tercera.offsetHeight + gap;
    }
    return Math.ceil(hasta + padBottom + bordes);
}

function aplicarTopeLista(ul) {
    const items = [];
    for (let i = 0; i < ul.children.length; i++) {
        if (ul.children[i].tagName === "LI") items.push(ul.children[i]);
    }
    if (items.length <= FILAS_VISIBLES) {
        ul.style.maxHeight = "";
        ul.classList.remove("panel-list--more");
        return;
    }
    ul.classList.add("panel-list--more");
    let alto = 0;
    for (let pass = 0; pass < 3; pass++) {
        const next = altoDeTresFilas(ul, items);
        if (!next) return;
        if (next === alto) break;
        alto = next;
        ul.style.maxHeight = alto + "px";
    }
}

function observarListas() {
    if (typeof ResizeObserver === "undefined") return;
    if (!observadorListas) {
        observadorListas = new ResizeObserver(() => programarTopesListas());
    }
    listasInicio().forEach((ul) => {
        if (!listasObservadas.has(ul)) {
            listasObservadas.add(ul);
            observadorListas.observe(ul);
        }
        for (let i = 0; i < ul.children.length; i++) {
            const li = ul.children[i];
            if (li.tagName !== "LI" || listasObservadas.has(li)) continue;
            listasObservadas.add(li);
            observadorListas.observe(li);
        }
    });
}

function aplicarTopesListas() {
    listasInicio().forEach(aplicarTopeLista);
    observarListas();
}

function programarTopesListas() {
    if (topePendiente) return;
    topePendiente = requestAnimationFrame(() => {
        topePendiente = 0;
        aplicarTopesListas();
    });
}

function limpiarTopesListas() {
    listasInicio().forEach((ul) => {
        ul.style.maxHeight = "";
        ul.classList.remove("panel-list--more");
    });
}

async function aceptarSolicitudDesdeDashboard(id) {
    const ok = await PawUi.confirm("¿Aceptar esta solicitud y programar la cita?", {
        title: "Aceptar solicitud",
    });
    if (!ok) return;
    try {
        await PawApi.api.acceptAppointment(id, {});
        await cargarDashboard();
    } catch (err) {
        PawToast.error("Solicitud", (err && err.message) || "No se pudo aceptar la solicitud");
    }
}

async function cargarDashboard() {
    const lista = document.getElementById("listaConsultas");
    const lista2 = document.getElementById("listaRecordatorios");
    const listaSolicitudes = document.getElementById("listaSolicitudes");
    const listaCorreo = document.getElementById("listaCorreo");
    const listaPacientes = document.getElementById("listaPacientesRecientes");
    const cards = document.querySelectorAll(".stats .card .circulo");

    lista.innerHTML = "<li>Cargando...</li>";
    lista2.innerHTML = "<li>Cargando...</li>";
    if (listaSolicitudes) listaSolicitudes.innerHTML = "<li>Cargando...</li>";
    if (listaCorreo) listaCorreo.innerHTML = "<li>Cargando...</li>";
    if (listaPacientes) listaPacientes.innerHTML = "<li>Cargando...</li>";
    limpiarTopesListas();

    const today = hoyISO();
    const [appointmentsRes, upcomingRes, patientsRes, pendingRes, inboxRes] = await Promise.all([
        PawApi.api.listAppointments({ date: today, limit: 100 }),
        PawApi.api.listAppointments({ limit: 100 }),
        PawApi.api.listPatients({ limit: 8 }),
        PawApi.api.pendingLinkRequests ? PawApi.api.pendingLinkRequests().catch(() => []) : Promise.resolve([]),
        PawApi.api.listInbox ? PawApi.api.listInbox({ limit: 8 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]);

    const allToday = (appointmentsRes.data || []).filter(esCitaActiva);
    const allUpcoming = (upcomingRes.data || []).filter(esCitaActiva);
    const citasHoy = allToday.slice().sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

    lista.innerHTML = "";
    if (!citasHoy.length) {
        lista.innerHTML = "<li>No hay consultas programadas hoy</li>";
    } else {
        citasHoy.forEach((c) => {
            const estado = c.status ? ` · ${c.status}` : "";
            lista.innerHTML += `<li><strong>${escapeHtml(c.petName)}</strong> — ${escapeHtml(c.ownerName)} · ${escapeHtml(c.time || "—")}${escapeHtml(estado)}</li>`;
        });
    }

    const proximas = allUpcoming
        .filter((a) => a.date && a.date >= today)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

    lista2.innerHTML = "";
    if (!proximas.length) {
        lista2.innerHTML = "<li>Sin citas próximas</li>";
    } else {
        proximas.forEach((a) => {
            lista2.innerHTML += `<li><strong>${escapeHtml(a.petName)}</strong> — ${escapeHtml(a.date)}${a.time ? " " + escapeHtml(a.time) : ""}${a.status ? " (" + escapeHtml(a.status) + ")" : ""}</li>`;
        });
    }

    const solicitudes = allUpcoming.filter((a) => String(a.status || "").toLowerCase() === "solicitada");
    if (listaSolicitudes) {
        listaSolicitudes.innerHTML = "";
        if (!solicitudes.length) {
            listaSolicitudes.innerHTML = "<li>No hay solicitudes pendientes</li>";
        } else {
            solicitudes.forEach((a) => {
                const li = document.createElement("li");
                const aceptarBtn = puedeVetAceptar(a)
                    ? ` <button type="button" class="btn-aceptar-dash" data-id="${escapeHtml(a.id)}">Aceptar</button>`
                    : ` <span style="opacity:.75;font-size:13px;">Esperando al dueño</span>`;
                li.innerHTML =
                    `<strong>${escapeHtml(a.petName)}</strong> — ${escapeHtml(a.date)} ${escapeHtml(a.time || "")}` +
                    ` · ${escapeHtml(a.ownerName || "")}` +
                    aceptarBtn;
                listaSolicitudes.appendChild(li);
            });
            listaSolicitudes.querySelectorAll(".btn-aceptar-dash").forEach((btn) => {
                btn.addEventListener("click", () => aceptarSolicitudDesdeDashboard(btn.getAttribute("data-id")));
            });
        }
    }

    if (listaCorreo) {
        const messages = (inboxRes && inboxRes.data) || [];
        listaCorreo.innerHTML = "";
        if (!messages.length) {
            listaCorreo.innerHTML = "<li>Sin mensajes nuevos</li>";
        } else {
            messages.forEach((m) => {
                const unread = m.readAt ? "" : " · sin leer";
                listaCorreo.innerHTML += `<li><strong>${escapeHtml(m.title)}</strong>${unread}<span>${escapeHtml(m.body)}</span></li>`;
            });
        }
    }

    const pacientes = patientsRes.data || [];
    if (listaPacientes) {
        listaPacientes.innerHTML = "";
        if (!pacientes.length) {
            listaPacientes.innerHTML = "<li>Aún no hay pacientes registrados</li>";
        } else {
            pacientes.forEach((p) => {
                const code = p.code || p.barcodePayload || "";
                listaPacientes.innerHTML += `<li><strong>${escapeHtml(p.name)}</strong>${code ? " · " + escapeHtml(code) : ""}${p.species ? " · " + escapeHtml(p.species) : ""}</li>`;
            });
        }
    }

    const { start, end } = semanaRango();
    const weekCount = allUpcoming.filter((a) => {
        if (!a.date) return false;
        const d = new Date(a.date + "T00:00:00");
        return d >= start && d <= end;
    }).length;

    const pendingLinks = Array.isArray(pendingRes) ? pendingRes : pendingRes.data || [];

    if (cards[0]) cards[0].textContent = String(citasHoy.length);
    if (cards[1]) cards[1].textContent = String(weekCount);
    if (cards[2]) cards[2].textContent = String(proximas.length);
    if (cards[3]) cards[3].textContent = String(solicitudes.length);
    if (cards[4]) {
        const total =
            (patientsRes.meta && (patientsRes.meta.total ?? patientsRes.meta.count)) ??
            pacientes.length;
        cards[4].textContent = String(total || 0);
    }
    if (cards[5]) cards[5].textContent = String(pendingLinks.length);
    aplicarTopesListas();
}

pintarSidebar();
if (window.PawToast && PawToast.consume) PawToast.consume();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
window.addEventListener("resize", programarTopesListas);
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(programarTopesListas).catch(() => {});
}
cargarDashboard().catch((err) => {
    const msg = (err && err.message) || "Error al cargar";
    LISTAS_INICIO.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<li>${escapeHtml(msg)}</li>`;
    });
    aplicarTopesListas();
});
})();
}

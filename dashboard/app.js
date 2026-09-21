if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

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

function semanaRango() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function aceptarSolicitudDesdeDashboard(id) {
    if (!confirm("¿Aceptar esta solicitud y programar la cita?")) return;
    try {
        await PawApi.api.acceptAppointment(id, {});
        await cargarDashboard();
    } catch (err) {
        alert((err && err.message) || "No se pudo aceptar la solicitud");
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
        proximas.slice(0, 12).forEach((a) => {
            lista2.innerHTML += `<li><strong>${escapeHtml(a.petName)}</strong> — ${escapeHtml(a.date)}${a.time ? " " + escapeHtml(a.time) : ""}${a.status ? " (" + escapeHtml(a.status) + ")" : ""}</li>`;
        });
    }

    const solicitudes = allUpcoming.filter((a) => String(a.status || "").toLowerCase() === "solicitada");
    if (listaSolicitudes) {
        listaSolicitudes.innerHTML = "";
        if (!solicitudes.length) {
            listaSolicitudes.innerHTML = "<li>No hay solicitudes pendientes</li>";
        } else {
            solicitudes.slice(0, 8).forEach((a) => {
                const li = document.createElement("li");
                li.innerHTML =
                    `<strong>${escapeHtml(a.petName)}</strong> — ${escapeHtml(a.date)} ${escapeHtml(a.time || "")}` +
                    ` · ${escapeHtml(a.ownerName || "")}` +
                    ` <button type="button" class="btn-aceptar-dash" data-id="${escapeHtml(a.id)}">Aceptar</button>`;
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
            messages.slice(0, 6).forEach((m) => {
                const unread = m.readAt ? "" : " · sin leer";
                listaCorreo.innerHTML += `<li><strong>${escapeHtml(m.title)}</strong>${unread}<br><span style="opacity:.8;font-size:12px;">${escapeHtml(m.body)}</span></li>`;
            });
        }
    }

    const pacientes = patientsRes.data || [];
    if (listaPacientes) {
        listaPacientes.innerHTML = "";
        if (!pacientes.length) {
            listaPacientes.innerHTML = "<li>Aún no hay pacientes registrados</li>";
        } else {
            pacientes.slice(0, 8).forEach((p) => {
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
}

pintarSidebar();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
cargarDashboard().catch((err) => {
    const msg = (err && err.message) || "Error al cargar";
    ["listaConsultas", "listaRecordatorios", "listaSolicitudes", "listaCorreo", "listaPacientesRecientes"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<li>${msg}</li>`;
    });
});

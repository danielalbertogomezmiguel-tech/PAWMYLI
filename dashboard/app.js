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

async function cargarDashboard() {
    const lista = document.getElementById("listaConsultas");
    const lista2 = document.getElementById("listaRecordatorios");
    const listaSolicitudes = document.getElementById("listaSolicitudes");
    const listaPacientes = document.getElementById("listaPacientesRecientes");
    const cards = document.querySelectorAll(".stats .card .circulo");

    lista.innerHTML = "<li>Cargando...</li>";
    lista2.innerHTML = "<li>Cargando...</li>";
    if (listaSolicitudes) listaSolicitudes.innerHTML = "<li>Cargando...</li>";
    if (listaPacientes) listaPacientes.innerHTML = "<li>Cargando...</li>";

    const today = hoyISO();
    const [appointmentsRes, upcomingRes, patientsRes, pendingRes] = await Promise.all([
        PawApi.api.listAppointments({ date: today, limit: 100 }),
        PawApi.api.listAppointments({ limit: 100 }),
        PawApi.api.listPatients({ limit: 8 }),
        PawApi.api.pendingLinkRequests ? PawApi.api.pendingLinkRequests().catch(() => []) : Promise.resolve([]),
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
            lista.innerHTML += `<li><strong>${c.petName}</strong> — ${c.ownerName} · ${c.time || "—"}${estado}</li>`;
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
            lista2.innerHTML += `<li><strong>${a.petName}</strong> — ${a.date}${a.time ? " " + a.time : ""}${a.status ? " (" + a.status + ")" : ""}</li>`;
        });
    }

    const solicitudes = allUpcoming.filter((a) => String(a.status || "").toLowerCase() === "solicitada");
    if (listaSolicitudes) {
        listaSolicitudes.innerHTML = "";
        if (!solicitudes.length) {
            listaSolicitudes.innerHTML = "<li>No hay solicitudes pendientes</li>";
        } else {
            solicitudes.slice(0, 8).forEach((a) => {
                listaSolicitudes.innerHTML += `<li><strong>${a.petName}</strong> — ${a.date} ${a.time || ""} · revisar en Agenda</li>`;
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
                listaPacientes.innerHTML += `<li><strong>${p.name}</strong>${code ? " · " + code : ""}${p.species ? " · " + p.species : ""}</li>`;
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
    if (cards[4]) cards[4].textContent = String(pacientes.length || (patientsRes.meta && patientsRes.meta.total) || 0);
    if (cards[5]) cards[5].textContent = String(pendingLinks.length);
}

pintarSidebar();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
cargarDashboard().catch((err) => {
    const msg = (err && err.message) || "Error al cargar";
    ["listaConsultas", "listaRecordatorios", "listaSolicitudes", "listaPacientesRecientes"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<li>${msg}</li>`;
    });
});

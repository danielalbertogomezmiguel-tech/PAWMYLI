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

async function cargarDashboard() {
    const lista = document.getElementById("listaConsultas");
    const lista2 = document.getElementById("listaRecordatorios");
    const cards = document.querySelectorAll(".stats .card .circulo");

    lista.innerHTML = "<li>Cargando...</li>";
    lista2.innerHTML = "<li>Cargando...</li>";

    const today = hoyISO();
    const [appointmentsRes, patientsRes] = await Promise.all([
        PawApi.api.listAppointments({ date: today, limit: 50 }),
        PawApi.api.listPatients({ limit: 100 }),
    ]);

    const citasHoy = appointmentsRes.data || [];
    const pacientes = patientsRes.data || [];

    lista.innerHTML = "";
    if (!citasHoy.length) {
        lista.innerHTML = "<li>No hay consultas programadas hoy</li>";
    } else {
        citasHoy
            .slice()
            .sort((a, b) => a.time.localeCompare(b.time))
            .forEach((c) => {
                lista.innerHTML += `<li>${c.petName} - ${c.ownerName} ${c.time}</li>`;
            });
    }

    const reminderLists = await Promise.all(
        pacientes.slice(0, 30).map((p) =>
            PawApi.api.listReminders(p.id).catch(() => [])
        )
    );
    const reminders = reminderLists.flat();
    const citasReminder = reminders
        .filter((r) => r.type === "cita" && r.date && r.date >= today)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    const vencidos = reminders.filter((r) => r.date && r.date <= today && r.type !== "cita");
    const destacados = [...citasReminder.slice(0, 8), ...vencidos.slice(0, 8)];

    lista2.innerHTML = "";
    if (!destacados.length) {
        lista2.innerHTML = "<li>Sin recordatorios pendientes</li>";
    } else {
        destacados.forEach((r) => {
            const tag = r.type === "cita" ? "[Cita] " : "";
            lista2.innerHTML += `<li>${tag}${r.title}${r.date ? " - " + r.date : ""}${r.time ? " " + r.time : ""}</li>`;
        });
    }

    if (cards[0]) cards[0].textContent = String(citasHoy.length);
    if (cards[1]) {
        const week = await PawApi.api.listAppointments({ limit: 100 });
        const start = new Date();
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const count = (week.data || []).filter((a) => {
            const d = new Date(a.date + "T00:00:00");
            return d >= start && d <= end;
        }).length;
        cards[1].textContent = String(count);
    }
    if (cards[2]) cards[2].textContent = String(citasReminder.length + vencidos.length);
}

pintarSidebar();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
cargarDashboard().catch((err) => {
    document.getElementById("listaConsultas").innerHTML = `<li>${err.message}</li>`;
    document.getElementById("listaRecordatorios").innerHTML = `<li>${err.message}</li>`;
});

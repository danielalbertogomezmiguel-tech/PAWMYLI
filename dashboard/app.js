if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

function pintarSidebar() {
    const user = PawApi.getUser();
    const title = document.querySelector(".perfilDoctor h2");
    if (user && title) title.textContent = user.name;
    if (user?.photo) {
        const img = document.querySelector(".perfilDoctor img");
        if (img) img.src = user.photo;
    }
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
    const vencidos = reminders.filter((r) => r.date && r.date <= today);

    lista2.innerHTML = "";
    if (!vencidos.length) {
        lista2.innerHTML = "<li>Sin recordatorios pendientes</li>";
    } else {
        vencidos.forEach((r) => {
            lista2.innerHTML += `<li>${r.title}${r.date ? " - " + r.date : ""}${r.time ? " " + r.time : ""}</li>`;
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
    if (cards[2]) cards[2].textContent = String(vencidos.length);
}

document.querySelector(".scan").addEventListener("click", () => {
    const code = prompt("Ingresa el código del paciente (PAW-XXXXXX):");
    if (!code) return;
    PawApi.api
        .get("/patients/code/" + encodeURIComponent(code.trim()))
        .then((patient) => {
            localStorage.setItem("pacienteID", patient.id);
            window.location.href = "../perfil/perfil.html";
        })
        .catch((err) => alert(err.message || "Paciente no encontrado."));
});

function cerrarSesion() {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
}

pintarSidebar();
cargarDashboard().catch((err) => {
    document.getElementById("listaConsultas").innerHTML = `<li>${err.message}</li>`;
    document.getElementById("listaRecordatorios").innerHTML = `<li>${err.message}</li>`;
});

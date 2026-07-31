if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

let fecha = new Date();
let mes = fecha.getMonth();
let anio = fecha.getFullYear();
let diaSeleccionado = fecha.getDate();
let citas = [];
let pacientesLista = [];

const calendario = document.getElementById("diasCalendario");
const tituloMes = document.getElementById("mesActual");
const lista = document.getElementById("listaCitas");
const numeroDia = document.getElementById("numeroDia");
const btnAnterior = document.getElementById("anterior");
const btnSiguiente = document.getElementById("siguiente");
const pacienteSelect = document.getElementById("pacienteSelect");

function pintarSidebar() {
    const user = PawApi.getUser();
    const title = document.querySelector(".perfilDoctor h2, .perfil h2");
    if (user && title) title.textContent = user.name;
}

function formatoFecha(dia) {
    const dd = String(dia).padStart(2, "0");
    const mm = String(mes + 1).padStart(2, "0");
    return `${anio}-${mm}-${dd}`;
}

function generarCalendario() {
    calendario.innerHTML = "";
    tituloMes.textContent = `${meses[mes]} ${anio}`;
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);
    let inicio = primerDia.getDay();
    if (inicio === 0) inicio = 7;

    for (let i = 1; i < inicio; i++) {
        calendario.innerHTML += `<div class="vacio"></div>`;
    }

    for (let d = 1; d <= ultimoDia.getDate(); d++) {
        let clases = "dia";
        const hoy = new Date();
        if (d === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()) {
            clases += " hoy";
        }
        if (d === diaSeleccionado) clases += " seleccionado";
        const fechaTexto = formatoFecha(d);
        if (citas.some((c) => c.date === fechaTexto)) clases += " citaCalendario";
        calendario.innerHTML += `<div class="${clases}" data-dia="${d}">${d}</div>`;
    }

    calendario.querySelectorAll(".dia").forEach((el) => {
        el.addEventListener("click", () => seleccionarDia(Number(el.dataset.dia)));
    });
}

function seleccionarDia(dia) {
    diaSeleccionado = dia;
    numeroDia.textContent = dia;
    generarCalendario();
    mostrarCitas();
}

function mostrarCitas() {
    lista.innerHTML = "";
    const fechaBuscar = formatoFecha(diaSeleccionado);
    const resultado = citas.filter((c) => c.date === fechaBuscar).sort((a, b) => a.time.localeCompare(b.time));

    if (!resultado.length) {
        lista.innerHTML = `
        <div class="cita">
            <h3>No hay citas</h3>
            <p>Este día está disponible.</p>
        </div>`;
        return;
    }

    resultado.forEach((cita) => {
        const item = document.createElement("div");
        item.className = "cita";
        item.innerHTML = `
            <h3>${cita.time}</h3>
            <p><strong>Mascota:</strong> ${cita.petName}</p>
            <p><strong>Dueño:</strong> ${cita.ownerName}</p>
            <p>${cita.notes || ""}</p>
            ${cita.patientId ? "<p><em>Vinculada a expediente</em></p>" : ""}
            <button class="eliminar">Eliminar</button>`;
        item.querySelector(".eliminar").addEventListener("click", () => eliminarCita(cita.id));
        lista.appendChild(item);
    });
}

async function cargarPacientesSelect() {
    try {
        const result = await PawApi.api.listPatients({ limit: 100 });
        pacientesLista = result.data || [];
        pacienteSelect.innerHTML =
            '<option value="">— Sin vincular a expediente —</option>' +
            pacientesLista
                .map(
                    (p) =>
                        `<option value="${p.id}">${p.name} (${p.code}) — ${p.ownerName}</option>`
                )
                .join("");
    } catch {
        /* selector opcional */
    }
}

pacienteSelect.addEventListener("change", () => {
    const p = pacientesLista.find((x) => x.id === pacienteSelect.value);
    if (!p) return;
    document.getElementById("nombreMascota").value = p.name;
    document.getElementById("dueno").value = p.ownerName;
});

async function cargarMes() {
    citas = await PawApi.api.listAppointmentsByMonth(anio, mes + 1);
    generarCalendario();
    mostrarCitas();
}

async function eliminarCita(id) {
    if (!confirm("¿Eliminar esta cita?")) return;
    try {
        await PawApi.api.deleteAppointment(id);
        await cargarMes();
    } catch (err) {
        alert(err.message || "No se pudo eliminar la cita.");
    }
}

btnAnterior.onclick = async () => {
    mes--;
    if (mes < 0) {
        mes = 11;
        anio--;
    }
    await cargarMes();
};

btnSiguiente.onclick = async () => {
    mes++;
    if (mes > 11) {
        mes = 0;
        anio++;
    }
    await cargarMes();
};

document.getElementById("formCita").addEventListener("submit", async (e) => {
    e.preventDefault();
    const patientId = pacienteSelect.value || undefined;
    const body = {
        petName: document.getElementById("nombreMascota").value.trim(),
        date: document.getElementById("fecha").value,
        ownerName: document.getElementById("dueno").value.trim(),
        time: document.getElementById("hora").value,
        notes: document.getElementById("nota").value.trim() || undefined,
        patientId,
    };

    try {
        await PawApi.api.createAppointment(body);
        alert(
            patientId
                ? "Cita registrada y recordatorio de tipo cita creado."
                : "Cita registrada correctamente."
        );
        e.target.reset();
        pacienteSelect.value = "";
        const [y, m, d] = body.date.split("-").map(Number);
        anio = y;
        mes = m - 1;
        diaSeleccionado = d;
        numeroDia.textContent = d;
        await cargarMes();
    } catch (err) {
        alert(err.message || "No se pudo registrar la cita.");
    }
});

document.querySelector(".cerrar").onclick = () => {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
};

pintarSidebar();
numeroDia.textContent = diaSeleccionado;
Promise.all([cargarMes(), cargarPacientesSelect()]).catch((err) => {
    lista.innerHTML = `<div class="cita"><h3>Error</h3><p>${err.message}</p></div>`;
});

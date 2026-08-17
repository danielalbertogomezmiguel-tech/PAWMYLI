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
    PawApi.applySidebar();
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
        if (citas.some((c) => c.date === fechaTexto && !esEliminada(c))) clases += " citaCalendario";
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

function esEliminada(cita) {
    return String(cita.status || "").toLowerCase() === "eliminada";
}

function mostrarCitas() {
    lista.innerHTML = "";
    const fechaBuscar = formatoFecha(diaSeleccionado);
    const delDia = citas.filter((c) => c.date === fechaBuscar);
    const activas = delDia.filter((c) => !esEliminada(c)).sort((a, b) => a.time.localeCompare(b.time));
    const eliminadas = citas
        .filter((c) => esEliminada(c))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

    if (!activas.length) {
        lista.innerHTML = `
        <div class="cita">
            <h3>No hay citas</h3>
            <p>Este día está disponible.</p>
        </div>`;
    } else {
        activas.forEach((cita) => {
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

    const listaElim = document.getElementById("listaEliminadas");
    if (listaElim) {
        listaElim.innerHTML = "";
        if (!eliminadas.length) {
            listaElim.innerHTML = `<div class="cita cita-eliminada"><p>Sin citas eliminadas este mes.</p></div>`;
        } else {
            eliminadas.slice(0, 30).forEach((cita) => {
                const item = document.createElement("div");
                item.className = "cita cita-eliminada";
                item.innerHTML = `
                    <h3>${cita.date} · ${cita.time}</h3>
                    <p><strong>Mascota:</strong> ${cita.petName}</p>
                    <p><strong>Dueño:</strong> ${cita.ownerName}</p>
                    <p><span class="badge-eliminada">Eliminada</span></p>`;
                listaElim.appendChild(item);
            });
        }
    }
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
    if (!confirm("¿Eliminar esta cita? Quedará registrada como eliminada.")) return;
    try {
        const removed = await PawApi.api.deleteAppointment(id);
        alert(
            `Cita eliminada: ${removed.petName || ""} (${removed.date || ""} ${removed.time || ""}).\n` +
                "Aparece en el registro de citas eliminadas."
        );
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

let creatingCita = false;

document.getElementById("formCita").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (creatingCita) return;
    const patientId = pacienteSelect.value || undefined;
    const body = {
        petName: document.getElementById("nombreMascota").value.trim(),
        date: document.getElementById("fecha").value,
        ownerName: document.getElementById("dueno").value.trim(),
        time: document.getElementById("hora").value,
        notes: document.getElementById("nota").value.trim() || undefined,
        patientId,
    };

    const submitBtn = e.target.querySelector("button[type='submit'], button.guardar");
    const originalLabel = submitBtn ? submitBtn.textContent : "";
    creatingCita = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";
    }
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
    } finally {
        creatingCita = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel || "Confirmar cita";
        }
    }
});

pintarSidebar();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
numeroDia.textContent = diaSeleccionado;
Promise.all([cargarMes(), cargarPacientesSelect()]).catch((err) => {
    lista.innerHTML = `<div class="cita"><h3>Error</h3><p>${err.message}</p></div>`;
});

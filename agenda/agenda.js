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

/** Grey = all three buckets. Individual colors can be combined when grey is off. */
let filtros = {
    all: true,
    completed: false,
    pending: false,
    cancelled: false,
};

const calendario = document.getElementById("diasCalendario");
const tituloMes = document.getElementById("mesActual");
const lista = document.getElementById("listaCitas");
const numeroDia = document.getElementById("numeroDia");
const btnAnterior = document.getElementById("anterior");
const btnSiguiente = document.getElementById("siguiente");
const pacienteSelect = document.getElementById("pacienteSelect");
const formCita = document.getElementById("formCita");
const crearCitaBox = document.querySelector(".crearCita");
const avisoFechaPasada = document.getElementById("avisoFechaPasada");

function pintarSidebar() {
    PawApi.applySidebar();
}

function hoyISO() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatoFecha(dia) {
    const dd = String(dia).padStart(2, "0");
    const mm = String(mes + 1).padStart(2, "0");
    return `${anio}-${mm}-${dd}`;
}

function esFechaPasada(isoDate) {
    return String(isoDate || "") < hoyISO();
}

function esEliminada(cita) {
    return /eliminad|cancelad/i.test(String(cita.status || ""));
}

/** Map API status → filter bucket: pending | completed | cancelled */
function bucketEstado(cita) {
    const status = String(cita.status || "");
    const attendance = String(cita.attendanceStatus || "");
    if (/eliminad|cancelad/i.test(status)) return "cancelled";
    if (/completad/i.test(status) || /completad|atendid/i.test(attendance)) return "completed";
    return "pending";
}

function pasaFiltro(cita) {
    if (filtros.all) return true;
    const bucket = bucketEstado(cita);
    if (bucket === "completed") return filtros.completed;
    if (bucket === "pending") return filtros.pending;
    if (bucket === "cancelled") return filtros.cancelled;
    return false;
}

function setModoAll() {
    filtros = { all: true, completed: false, pending: false, cancelled: false };
}

function syncFiltroUI() {
    document.querySelectorAll(".filtro-punto").forEach((btn) => {
        const key = btn.getAttribute("data-filtro");
        const on =
            key === "all"
                ? filtros.all
                : !filtros.all && Boolean(filtros[key]);
        btn.classList.toggle("activo", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
}

function onFiltroClick(key) {
    if (key === "all") {
        setModoAll();
    } else {
        if (filtros.all) {
            filtros = {
                all: false,
                completed: key === "completed",
                pending: key === "pending",
                cancelled: key === "cancelled",
            };
        } else {
            filtros[key] = !filtros[key];
            const activos =
                Number(filtros.completed) + Number(filtros.pending) + Number(filtros.cancelled);
            if (activos === 0) {
                setModoAll();
            } else if (activos === 3) {
                setModoAll();
            }
        }
    }
    syncFiltroUI();
    generarCalendario();
    mostrarCitas();
}

function colorClaseDia(fechaTexto) {
    const delDia = citas.filter((c) => c.date === fechaTexto && pasaFiltro(c));
    if (!delDia.length) return "";
    const buckets = new Set(delDia.map(bucketEstado));
    if (buckets.size > 1) return "citaCalendario cita-mixed";
    if (buckets.has("cancelled")) return "citaCalendario cita-cancelled";
    if (buckets.has("completed")) return "citaCalendario cita-completed";
    return "citaCalendario cita-pending";
}

function actualizarFormularioFecha() {
    const iso = formatoFecha(diaSeleccionado);
    const fechaInput = document.getElementById("fecha");
    const past = esFechaPasada(iso);
    if (fechaInput) {
        fechaInput.min = hoyISO();
        fechaInput.value = iso;
    }
    if (avisoFechaPasada) avisoFechaPasada.hidden = !past;
    if (crearCitaBox) crearCitaBox.classList.toggle("solo-vista", past);
    if (formCita) {
        formCita.querySelectorAll("input, select, textarea, button").forEach((el) => {
            el.disabled = past;
        });
    }
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
        const color = colorClaseDia(fechaTexto);
        if (color) clases += " " + color;
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
    actualizarFormularioFecha();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function mostrarCitas() {
    lista.innerHTML = "";
    const fechaBuscar = formatoFecha(diaSeleccionado);
    const delDia = citas
        .filter((c) => c.date === fechaBuscar && pasaFiltro(c))
        .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

    const eliminadas = citas
        .filter((c) => esEliminada(c))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

    if (!delDia.length) {
        lista.innerHTML = `
        <div class="cita">
            <h3>No hay citas</h3>
            <p>No hay citas con los filtros seleccionados para este día.</p>
        </div>`;
    } else {
        delDia.forEach((cita) => {
            const item = document.createElement("div");
            const bucket = bucketEstado(cita);
            item.className = "cita" + (bucket === "cancelled" ? " cita-cancelada-dia" : "");
            const status = cita.status || "Programada";
            const esSolicitada = String(status).toLowerCase() === "solicitada";
            const puedeEliminar = bucket !== "cancelled";
            item.innerHTML = `
                <h3>${escapeHtml(cita.time)}</h3>
                <p><strong>Mascota:</strong> ${escapeHtml(cita.petName)}</p>
                <p><strong>Dueño:</strong> ${escapeHtml(cita.ownerName)}</p>
                <p><strong>Estado:</strong> ${escapeHtml(status)}
                    <span class="badge-estado ${bucket}">${
                        bucket === "cancelled"
                            ? "Cancelado"
                            : bucket === "completed"
                              ? "Completado"
                              : "Pendiente"
                    }</span>
                </p>
                <p>${escapeHtml(cita.notes || "")}</p>
                ${cita.patientId ? "<p><em>Vinculada a expediente</em></p>" : ""}
                ${esSolicitada && bucket !== "cancelled" ? '<button class="aceptar" type="button">Aceptar solicitud</button>' : ""}
                ${puedeEliminar ? '<button class="eliminar" type="button">Eliminar</button>' : ""}`;
            const btnAceptar = item.querySelector(".aceptar");
            if (btnAceptar) {
                btnAceptar.addEventListener("click", () => aceptarSolicitud(cita.id));
            }
            const btnEliminar = item.querySelector(".eliminar");
            if (btnEliminar) {
                btnEliminar.addEventListener("click", () => eliminarCita(cita.id));
            }
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
                    <h3>${escapeHtml(cita.date)} · ${escapeHtml(cita.time)}</h3>
                    <p><strong>Mascota:</strong> ${escapeHtml(cita.petName)}</p>
                    <p><strong>Dueño:</strong> ${escapeHtml(cita.ownerName)}</p>
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
                        `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.code)}) — ${escapeHtml(p.ownerName)}</option>`
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
    if (!Array.isArray(citas)) {
        citas = Array.isArray(citas && citas.data) ? citas.data : [];
    }
    generarCalendario();
    mostrarCitas();
    actualizarFormularioFecha();
}

async function aceptarSolicitud(id) {
    if (!confirm("¿Aceptar esta solicitud y programar la cita?")) return;
    try {
        await PawApi.api.acceptAppointment(id, {});
        alert("Solicitud aceptada. La cita queda programada.");
        await cargarMes();
    } catch (err) {
        alert(err.message || "No se pudo aceptar la solicitud.");
    }
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
    const maxDia = new Date(anio, mes + 1, 0).getDate();
    if (diaSeleccionado > maxDia) diaSeleccionado = maxDia;
    numeroDia.textContent = diaSeleccionado;
    await cargarMes();
};

btnSiguiente.onclick = async () => {
    mes++;
    if (mes > 11) {
        mes = 0;
        anio++;
    }
    const maxDia = new Date(anio, mes + 1, 0).getDate();
    if (diaSeleccionado > maxDia) diaSeleccionado = maxDia;
    numeroDia.textContent = diaSeleccionado;
    await cargarMes();
};

document.querySelectorAll(".filtro-punto").forEach((btn) => {
    btn.addEventListener("click", () => onFiltroClick(btn.getAttribute("data-filtro")));
});

let creatingCita = false;

formCita.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (creatingCita) return;

    const dateVal = document.getElementById("fecha").value;
    if (esFechaPasada(dateVal)) {
        alert("No se pueden crear citas en fechas pasadas.");
        return;
    }
    if (esFechaPasada(formatoFecha(diaSeleccionado))) {
        alert("Solo visualización en fechas pasadas.");
        return;
    }

    const patientId = pacienteSelect.value || undefined;
    const body = {
        petName: document.getElementById("nombreMascota").value.trim(),
        date: dateVal,
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
        actualizarFormularioFecha();
    }
});

pintarSidebar();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
numeroDia.textContent = diaSeleccionado;
syncFiltroUI();
actualizarFormularioFecha();
Promise.all([cargarMes(), cargarPacientesSelect()]).catch((err) => {
    lista.innerHTML = `<div class="cita"><h3>Error</h3><p>${escapeHtml(err.message)}</p></div>`;
});

if (!PawApi.requireAuth()) {
    // redirected to login — do not throw (avoids red console / blank flash)
} else {
(function () {

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

function statusDisplay(cita) {
    const raw = String(cita.status || "Programada");
    // Legacy "Eliminada" is shown and filtered as Cancelada.
    if (/eliminad/i.test(raw)) return "Cancelada";
    return raw;
}

/** Vet should only accept owner proposals; web-created ones wait for the owner. */
function puedeVetAceptar(cita) {
    if (String(cita.status || "").toLowerCase() !== "solicitada") return false;
    const notes = String(cita.notes || "");
    const tags = [...notes.matchAll(/\[Propuesta (vet|owner)\]/gi)];
    if (!tags.length) return true; // classic owner request without tag
    return /owner/i.test(tags[tags.length - 1][1]);
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
    const bucket = bucketEstado(cita);
    // Grey ("all"): every status, including Cancelada / legacy Eliminada.
    if (filtros.all) return true;
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

function mostrarCitas() {
    lista.innerHTML = "";
    const fechaBuscar = formatoFecha(diaSeleccionado);
    const delDia = citas
        .filter((c) => c.date === fechaBuscar && pasaFiltro(c))
        .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));

    if (!delDia.length) {
        lista.innerHTML = `
        <div class="cita">
            <h3>No hay citas</h3>
            <p>No hay citas con los filtros seleccionados para este día.</p>
        </div>`;
        return;
    }

    delDia.forEach((cita) => {
        const item = document.createElement("div");
        const bucket = bucketEstado(cita);
        item.className = "cita" + (bucket === "cancelled" ? " cita-cancelada-dia" : "");
        const status = statusDisplay(cita);
        const esSolicitada = String(cita.status || "").toLowerCase() === "solicitada";
        const puedeCancelar = bucket !== "cancelled";
        const mostrarAceptar = puedeVetAceptar(cita) && bucket !== "cancelled";
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
                          : esSolicitada
                            ? "Por aceptar"
                            : "Pendiente"
                }</span>
            </p>
            <p>${escapeHtml(cita.notes || "")}</p>
            ${cita.patientId ? "<p><em>Vinculada a expediente</em></p>" : ""}
            ${
                mostrarAceptar
                    ? '<button class="aceptar" type="button">Aceptar solicitud</button>'
                    : ""
            }
            ${puedeCancelar ? '<button class="eliminar" type="button">Cancelar</button>' : ""}`;
        const btnAceptar = item.querySelector(".aceptar");
        if (btnAceptar) {
            btnAceptar.addEventListener("click", () => aceptarSolicitud(cita.id));
        }
        const btnEliminar = item.querySelector(".eliminar");
        if (btnEliminar) {
            btnEliminar.addEventListener("click", () => cancelarCita(cita.id));
        }
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
                        `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.code)}) — ${escapeHtml(p.ownerName)}</option>`
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

async function uiConfirm(message, title) {
    if (window.PawUi && PawUi.confirm) {
        return PawUi.confirm(message, { title: title || "Confirmar" });
    }
    return window.confirm(message);
}

function uiAlert(message, title) {
    if (window.PawToast) {
        const label = title || "Aviso";
        const type = /error/i.test(label)
            ? "error"
            : /inválid|lectura/i.test(label)
              ? "warning"
              : "success";
        PawToast.show({ type, title: label, message: message || "" });
        return;
    }
    if (window.PawUi && PawUi.alert) {
        return PawUi.alert(message, { title: title || "Aviso" });
    }
}

async function aceptarSolicitud(id) {
    const ok = await uiConfirm(
        "¿Aceptar esta solicitud y programar la cita?",
        "Aceptar solicitud"
    );
    if (!ok) return;
    try {
        await PawApi.api.acceptAppointment(id, {});
        await uiAlert("Solicitud aceptada. La cita queda programada.", "Listo");
        await cargarMes();
    } catch (err) {
        await uiAlert(err.message || "No se pudo aceptar la solicitud.", "Error");
    }
}

async function cancelarCita(id) {
    const ok = await uiConfirm(
        "¿Cancelar esta cita? Quedará en el registro de citas canceladas.",
        "Cancelar cita"
    );
    if (!ok) return;
    try {
        const removed = await PawApi.api.deleteAppointment(id);
        await uiAlert(
            `Cita cancelada: ${removed.petName || ""} (${removed.date || ""} ${removed.time || ""}).`,
            "Listo"
        );
        await cargarMes();
    } catch (err) {
        await uiAlert(err.message || "No se pudo cancelar la cita.", "Error");
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
        await uiAlert("No se pueden crear citas en fechas pasadas.", "Fecha inválida");
        return;
    }
    if (esFechaPasada(formatoFecha(diaSeleccionado))) {
        await uiAlert("Solo visualización en fechas pasadas.", "Solo lectura");
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
        await uiAlert(
            patientId
                ? "Propuesta enviada al dueño. Aparecerá como Programada cuando acepte en Correo."
                : "Cita registrada correctamente.",
            "Listo"
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
        await uiAlert(err.message || "No se pudo registrar la cita.", "Error");
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
})();
}
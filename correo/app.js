if (!PawApi.requireAuth()) {
    // requireAuth already redirects to login — avoid throwing (breaks Live Server / console).
} else {
(function () {


function formatWhen(iso) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleString("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return iso;
    }
}

function hoyISO() {
    const d = new Date();
    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}

function esFechaIsoReal(value) {
    const text = String(value || "").trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function fechaSugeridaValida(value) {
    const text = String(value || "").trim();
    return esFechaIsoReal(text) && text >= hoyISO();
}

function horaSugeridaValida(value) {
    const text = String(value || "").trim();
    const m = /^(\d{2}):(\d{2})$/.exec(text);
    if (!m) return false;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h <= 23 && min <= 59;
}

function canActOnMessage(m, payload) {
    if (!payload || !payload.appointmentId) return false;
    if (payload.action === "none") return false;
    const outcome = String(payload.outcome || "").toLowerCase();
    if (
        outcome === "accepted" ||
        outcome === "rejected" ||
        outcome === "suggested" ||
        outcome === "owner_confirmed"
    ) {
        return false;
    }
    return m.type === "appointment_request" || m.type === "appointment_update";
}

function estadoLabel(payload) {
    const outcome = String((payload && payload.outcome) || "").toLowerCase();
    if (outcome === "accepted") return "Estado: Aceptada";
    if (outcome === "rejected") return "Estado: Rechazada";
    if (outcome === "suggested") return "Estado: Sugerencia enviada";
    if (outcome === "owner_confirmed") return "Estado: Asistencia confirmada";
    if (payload && payload.action === "none") return "Estado: Resuelta";
    return "";
}

function detalleHtml(payload, body) {
    const pet = payload.petName || "";
    const owner = payload.ownerName || "";
    const date = payload.date || "";
    const time = payload.time || "";
    const reason = payload.reason || "";
    const rows = [];
    if (pet) rows.push(`<div><strong>Paciente:</strong> ${escapeHtml(pet)}</div>`);
    if (owner) rows.push(`<div><strong>Dueño:</strong> ${escapeHtml(owner)}</div>`);
    if (date) rows.push(`<div><strong>Fecha sugerida:</strong> ${escapeHtml(date)}</div>`);
    if (time) rows.push(`<div><strong>Hora:</strong> ${escapeHtml(time)}</div>`);
    if (reason) rows.push(`<div><strong>Motivo:</strong> ${escapeHtml(reason)}</div>`);
    if (!rows.length) {
        return `<p>${escapeHtml(body)}</p>`;
    }
    return `<div class="correo-detalle">${rows.join("")}</div><p style="margin-top:8px;opacity:.85;">${escapeHtml(
        body
    )}</p>`;
}

async function uiConfirm(message, title) {
    if (window.PawUi && PawUi.confirm) {
        return PawUi.confirm(message, { title: title || "Confirmar" });
    }
    return window.confirm(message);
}

async function uiPrompt(message, initial, title, inputLabel) {
    if (window.PawUi && PawUi.prompt) {
        return PawUi.prompt(message, initial, {
            title: title || "Ingresar",
            inputLabel: inputLabel || "Valor",
        });
    }
    return window.prompt(message, initial);
}

function uiAlert(message, title) {
    if (window.PawToast) {
        const label = title || "Aviso";
        const type = /error/i.test(label) ? "error" : "success";
        PawToast.show({ type, title: label, message: message || "" });
        return;
    }
    if (window.PawUi && PawUi.alert) {
        return PawUi.alert(message, { title: title || "Aviso" });
    }
}

async function aceptarSolicitud(appointmentId, messageId) {
    if (!appointmentId) return;
    const ok = await uiConfirm(
        "¿Aceptar esta solicitud y programar la cita como pendiente?",
        "Aceptar cita"
    );
    if (!ok) return;
    try {
        await PawApi.api.acceptAppointment(appointmentId, {});
        if (messageId) {
            try {
                await PawApi.api.markInboxRead(messageId);
            } catch (_) {}
        }
        await cargarCorreo();
        await uiAlert("Solicitud aceptada. La cita quedó programada (Pendiente).", "Listo");
    } catch (err) {
        await uiAlert((err && err.message) || "No se pudo aceptar", "Error");
    }
}

async function rechazarSolicitud(appointmentId, messageId) {
    if (!appointmentId) return;
    const ok = await uiConfirm("¿Rechazar esta solicitud de cita?", "Rechazar cita");
    if (!ok) return;
    const notes = await uiPrompt(
        "Motivo del rechazo (opcional)",
        "",
        "Motivo",
        "Motivo"
    );
    if (notes === null) return;
    try {
        await PawApi.api.rejectAppointment(appointmentId, notes ? { notes } : {});
        if (messageId) {
            try {
                await PawApi.api.markInboxRead(messageId);
            } catch (_) {}
        }
        await cargarCorreo();
        await uiAlert("Solicitud rechazada. Se notificó a la otra parte.", "Listo");
    } catch (err) {
        await uiAlert((err && err.message) || "No se pudo rechazar", "Error");
    }
}

async function sugerirFecha(appointmentId, messageId, currentDate, currentTime) {
    if (!appointmentId) return;
    const date = await uiPrompt(
        "Nueva fecha sugerida (AAAA-MM-DD)",
        currentDate || hoyISO(),
        "Sugerir fecha",
        "Fecha"
    );
    if (date === null) return;
    if (!fechaSugeridaValida(date)) {
        await uiAlert("Indica una fecha real (AAAA-MM-DD) que no sea pasada.", "Error");
        return;
    }
    const time = await uiPrompt(
        "Nueva hora sugerida (HH:MM)",
        currentTime || "09:00",
        "Sugerir hora",
        "Hora"
    );
    if (time === null) return;
    const hora = String(time).trim();
    if (!horaSugeridaValida(hora)) {
        await uiAlert("Indica una hora real (HH:MM).", "Error");
        return;
    }
    try {
        await PawApi.api.suggestAppointment(appointmentId, {
            date: String(date).trim(),
            time: hora,
        });
        if (messageId) {
            try {
                await PawApi.api.markInboxRead(messageId);
            } catch (_) {}
        }
        await cargarCorreo();
        await uiAlert("Sugerencia enviada. La otra parte recibirá un aviso en Correo.", "Listo");
    } catch (err) {
        await uiAlert((err && err.message) || "No se pudo sugerir", "Error");
    }
}

async function cargarCorreo() {
    const lista = document.getElementById("listaCorreoCompleta");
    if (!lista) return;
    lista.innerHTML = "<li class='correo-item'>Cargando...</li>";
    try {
        const res = await PawApi.api.listInbox({ limit: 50 });
        const messages = res.data || [];
        lista.innerHTML = "";
        if (!messages.length) {
            lista.innerHTML = "<li class='correo-item'><p>No hay mensajes todavía.</p></li>";
            return;
        }
        messages.forEach((m) => {
            const li = document.createElement("li");
            const unread = !m.readAt;
            li.className = "correo-item" + (unread ? " unread" : "");
            const payload = m.payload && typeof m.payload === "object" ? m.payload : {};
            const appointmentId = payload.appointmentId || "";
            const showActions = canActOnMessage(m, payload);
            const estado = estadoLabel(payload);

            li.innerHTML =
                `<h3>${escapeHtml(m.title)}</h3>` +
                detalleHtml(payload, m.body) +
                `<div class="correo-meta">${escapeHtml(formatWhen(m.createdAt))}${
                    unread ? " · sin leer" : ""
                }</div>` +
                (showActions
                    ? `<div class="correo-actions">
                        <button type="button" class="btn-aceptar" data-appt="${escapeHtml(
                            appointmentId
                        )}" data-msg="${escapeHtml(m.id)}">Aceptar</button>
                        <button type="button" class="btn-rechazar secondary" data-appt="${escapeHtml(
                            appointmentId
                        )}" data-msg="${escapeHtml(m.id)}">Rechazar</button>
                        <button type="button" class="btn-sugerir secondary" data-appt="${escapeHtml(
                            appointmentId
                        )}" data-msg="${escapeHtml(m.id)}" data-date="${escapeHtml(
                            payload.date || ""
                        )}" data-time="${escapeHtml(payload.time || "")}">Sugerir</button>
                      </div>`
                    : estado
                      ? `<div class="correo-estado">${escapeHtml(estado)}</div>`
                      : "");

            lista.appendChild(li);

            const btnAceptar = li.querySelector(".btn-aceptar");
            const btnRechazar = li.querySelector(".btn-rechazar");
            const btnSugerir = li.querySelector(".btn-sugerir");
            if (btnAceptar) {
                btnAceptar.addEventListener("click", () =>
                    aceptarSolicitud(
                        btnAceptar.getAttribute("data-appt"),
                        btnAceptar.getAttribute("data-msg")
                    )
                );
            }
            if (btnRechazar) {
                btnRechazar.addEventListener("click", () =>
                    rechazarSolicitud(
                        btnRechazar.getAttribute("data-appt"),
                        btnRechazar.getAttribute("data-msg")
                    )
                );
            }
            if (btnSugerir) {
                btnSugerir.addEventListener("click", () =>
                    sugerirFecha(
                        btnSugerir.getAttribute("data-appt"),
                        btnSugerir.getAttribute("data-msg"),
                        btnSugerir.getAttribute("data-date"),
                        btnSugerir.getAttribute("data-time")
                    )
                );
            } else if (unread && !showActions) {
                li.addEventListener("click", async () => {
                    try {
                        await PawApi.api.markInboxRead(m.id);
                        li.classList.remove("unread");
                    } catch (_) {}
                });
            }
        });
    } catch (err) {
        lista.innerHTML = `<li class="correo-item"><p>${escapeHtml(
            (err && err.message) || "Error al cargar correo"
        )}</p></li>`;
    }
}

PawApi.applySidebar();
PawApi.syncProfileToSession().then(() => PawApi.applySidebar()).catch(() => {});

document.getElementById("btnMarcarLeidos")?.addEventListener("click", async () => {
    try {
        await PawApi.api.markAllInboxRead();
        await cargarCorreo();
    } catch (err) {
        await uiAlert((err && err.message) || "No se pudo marcar", "Error");
    }
});

document.getElementById("btnRecargar")?.addEventListener("click", () => cargarCorreo());

cargarCorreo();
})();
}
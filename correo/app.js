if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

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

function canActOnMessage(m, payload) {
    if (!payload || !payload.appointmentId) return false;
    if (payload.action === "none" || payload.outcome === "accepted" || payload.outcome === "rejected") {
        return false;
    }
    return (
        m.type === "appointment_request" ||
        m.type === "appointment_update"
    );
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

async function aceptarSolicitud(appointmentId, messageId) {
    if (!appointmentId) return;
    if (!confirm("¿Aceptar esta solicitud y programar la cita como pendiente?")) return;
    try {
        await PawApi.api.acceptAppointment(appointmentId, {});
        if (messageId) {
            try {
                await PawApi.api.markInboxRead(messageId);
            } catch (_) {}
        }
        await cargarCorreo();
        alert("Solicitud aceptada. La cita quedó programada (Pendiente).");
    } catch (err) {
        alert((err && err.message) || "No se pudo aceptar");
    }
}

async function rechazarSolicitud(appointmentId, messageId) {
    if (!appointmentId) return;
    if (!confirm("¿Rechazar esta solicitud de cita?")) return;
    const notes = prompt("Motivo del rechazo (opcional):", "") || undefined;
    try {
        await PawApi.api.rejectAppointment(appointmentId, notes ? { notes } : {});
        if (messageId) {
            try {
                await PawApi.api.markInboxRead(messageId);
            } catch (_) {}
        }
        await cargarCorreo();
        alert("Solicitud rechazada. Se notificó a la otra parte.");
    } catch (err) {
        alert((err && err.message) || "No se pudo rechazar");
    }
}

async function sugerirFecha(appointmentId, messageId, currentDate, currentTime) {
    if (!appointmentId) return;
    const date = prompt("Nueva fecha sugerida (AAAA-MM-DD):", currentDate || hoyISO());
    if (!date) return;
    const time = prompt("Nueva hora sugerida (HH:MM):", currentTime || "09:00");
    if (!time) return;
    try {
        await PawApi.api.suggestAppointment(appointmentId, {
            date: String(date).trim(),
            time: String(time).trim().slice(0, 5),
        });
        if (messageId) {
            try {
                await PawApi.api.markInboxRead(messageId);
            } catch (_) {}
        }
        await cargarCorreo();
        alert("Sugerencia enviada. La otra parte recibirá un aviso en Correo.");
    } catch (err) {
        alert((err && err.message) || "No se pudo sugerir");
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
        alert((err && err.message) || "No se pudo marcar");
    }
});

document.getElementById("btnRecargar")?.addEventListener("click", () => cargarCorreo());

cargarCorreo();

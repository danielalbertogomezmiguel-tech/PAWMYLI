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

async function aceptarSolicitud(appointmentId) {
    if (!appointmentId) return;
    if (!confirm("¿Aceptar esta solicitud y programar la cita?")) return;
    try {
        await PawApi.api.acceptAppointment(appointmentId, {});
        await cargarCorreo();
        alert("Solicitud aceptada. La cita quedó programada.");
    } catch (err) {
        alert((err && err.message) || "No se pudo aceptar");
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
            const showAccept =
                m.type === "appointment_request" && appointmentId && unread !== undefined;

            li.innerHTML =
                `<h3>${escapeHtml(m.title)}</h3>` +
                `<p>${escapeHtml(m.body)}</p>` +
                `<div class="correo-meta">${escapeHtml(formatWhen(m.createdAt))}${
                    unread ? " · sin leer" : ""
                }</div>` +
                (showAccept
                    ? `<div class="correo-actions"><button type="button" class="btn-aceptar" data-appt="${escapeHtml(
                          appointmentId
                      )}" data-msg="${escapeHtml(m.id)}">Aceptar solicitud</button></div>`
                    : "");

            lista.appendChild(li);

            const btn = li.querySelector(".btn-aceptar");
            if (btn) {
                btn.addEventListener("click", async () => {
                    await aceptarSolicitud(btn.getAttribute("data-appt"));
                    try {
                        await PawApi.api.markInboxRead(btn.getAttribute("data-msg"));
                    } catch (_) {}
                });
            } else if (unread) {
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

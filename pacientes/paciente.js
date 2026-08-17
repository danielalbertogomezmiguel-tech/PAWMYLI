if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

const DEFAULT_FOTO = PawApi.defaultAvatar();
const BARCODE_API =
    (window.PAWMYLI_CONFIG && window.PAWMYLI_CONFIG.barcodeApiUrl) ||
    "https://barcode.tec-it.com/barcode.ashx";
const user = PawApi.getUser();
const isOwner = user && user.role === "owner";
let pacientes = [];
let ultimoCreadoId = null;
let pendingRequests = [];
let panelOpen = false;
let processingIds = new Set();

const contenedor = document.getElementById("contenedorPacientes");
const buscar = document.getElementById("buscar");
const modal = document.getElementById("modal");
const modalExito = document.getElementById("modalExito");
const btnNuevo = document.getElementById("nuevoPaciente");
const btnVincular = document.getElementById("vincularCodigo");
const btnSolicitar = document.getElementById("btnSolicitarVinculo");
const panelVinculaciones = document.getElementById("panelVinculaciones");
const contenedorVinculaciones = document.getElementById("contenedorVinculaciones");
const badgePendientes = document.getElementById("badgePendientes");
const cerrarModal = document.querySelector(".cerrarModal");
const formulario = document.getElementById("formMascota");

function toast(type, title, message) {
    if (window.PawToast) {
        PawToast.show({ type, title, message });
    } else {
        console[type === "error" ? "error" : "log"](title, message || "");
    }
}

function friendlyError(err) {
    const raw = (err && err.message) || "";
    if (
        !raw ||
        /internal|prisma|stack|ECONN|fetch|Cannot GET|Cannot POST|<\s*html|<pre>/i.test(raw)
    ) {
        return "No pudimos completar la operación. Inténtalo nuevamente.";
    }
    if (PawApi.sanitizeApiMessage) {
        const cleaned = PawApi.sanitizeApiMessage(raw);
        if (/^Error de servidor/i.test(cleaned) && /Cannot GET|<\s*html/i.test(raw)) {
            return "No pudimos completar la operación. Inténtalo nuevamente.";
        }
        return cleaned;
    }
    return raw;
}

function pintarSidebar() {
    PawApi.applySidebar();
}

function configurarRol() {
    const btnMigrar = document.getElementById("btnMigrarCodigos");
    if (isOwner) {
        btnNuevo.style.display = "none";
        btnVincular.style.display = "inline-flex";
        document.getElementById("vincularCodigoLabel").textContent = "Vinculaciones";
        if (btnSolicitar) btnSolicitar.style.display = "inline-flex";
        if (btnMigrar) btnMigrar.style.display = "none";
    } else {
        btnNuevo.style.display = "inline-flex";
        btnVincular.style.display = "inline-flex";
        document.getElementById("vincularCodigoLabel").textContent = "Vinculaciones";
        if (btnSolicitar) btnSolicitar.style.display = "none";
        if (btnMigrar) btnMigrar.style.display = "inline-flex";
    }
}

function updateBadge(count) {
    if (!badgePendientes) return;
    if (count > 0) {
        badgePendientes.hidden = false;
        badgePendientes.textContent = String(count);
    } else {
        badgePendientes.hidden = true;
        badgePendientes.textContent = "0";
    }
}

function roleLabel(role) {
    const map = {
        OWNER: "Dueño",
        CO_OWNER: "Co-dueño",
        CAREGIVER: "Cuidador",
    };
    return map[role] || role || "—";
}

function linkStatusLabel(status) {
    const map = {
        LINKED: "Vinculada",
        UNLINKED: "Desvinculada",
        PENDING: "Pendiente",
    };
    return map[status] || status || "—";
}

function linkStatusClass(status) {
    const map = {
        LINKED: "link-linked",
        UNLINKED: "link-unlinked",
        PENDING: "link-pending",
    };
    return map[status] || "link-unlinked";
}

function formatDate(value) {
    if (!value) return "—";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return "—";
    }
}

function mostrarEstadoPacientes(kind, text, sub) {
    const subHtml = sub
        ? `<p class="estado-sub">${sub}</p>`
        : "";
    contenedor.innerHTML =
        `<div class="estado-vacio estado-${kind}">` +
        `<i class="fa-solid ${kind === "loading" ? "fa-spinner fa-spin" : kind === "error" ? "fa-circle-exclamation" : "fa-paw"}"></i>` +
        `<p class="estado-titulo">${text}</p>${subHtml}</div>`;
}

function mostrarPacientes(lista) {
    contenedor.innerHTML = "";
    if (!lista.length) {
        mostrarEstadoPacientes(
            "empty",
            "No hay pacientes para mostrar.",
            "Registra una mascota o espera a que se apruebe una vinculación."
        );
        return;
    }

    lista.forEach((paciente) => {
        const status = paciente.linkStatus || "UNLINKED";
        contenedor.innerHTML += `
        <div class="tarjeta">
            <img
                class="foto"
                src="${paciente.foto || DEFAULT_FOTO}"
                onerror="this.src='${DEFAULT_FOTO}'">
            <div class="info">
                <h2>${paciente.nombre}
                    <span class="badge-link ${linkStatusClass(status)}" title="${status}">
                        ${linkStatusLabel(status)}
                    </span>
                </h2>
                <p style="font-size:14px;color:#8a9aa8;margin-bottom:6px;">Código: ${paciente.codigo}</p>
                <div class="detalles">
                    <p><strong>Especie:</strong> ${paciente.especie}</p>
                    <p><strong>Raza:</strong> ${paciente.raza}</p>
                    <p><strong>Edad:</strong> ${paciente.edad}</p>
                    <p><strong>Sexo:</strong> ${paciente.sexo}</p>
                    <p><strong>Peso:</strong> ${paciente.peso || "—"}</p>
                    <p><strong>Color:</strong> ${paciente.color || "—"}</p>
                    <p><strong>Microchip:</strong> ${paciente.microchip || "No"}</p>
                </div>
                <p class="propietario">
                    <strong>Propietario:</strong>
                    ${paciente.propietario}
                </p>
            </div>
            <button class="expediente" data-id="${paciente.id}">
                <i class="fa-solid fa-file-medical"></i>
            </button>
        </div>`;
    });

    contenedor.querySelectorAll(".expediente").forEach((btn) => {
        btn.addEventListener("click", () => abrirPerfil(btn.dataset.id));
    });
}

async function cargarPacientes(search) {
    mostrarEstadoPacientes("loading", "Cargando pacientes...");
    try {
        const result = isOwner
            ? await PawApi.api.myPatients({ limit: 100 })
            : await PawApi.api.listPatients({ search, limit: 100 });
        const mapped = (result.data || []).map(PawApi.mapPatient);
        pacientes = await Promise.all(
            mapped.map((p) =>
                PawApi.enrichPatientPhoto ? PawApi.enrichPatientPhoto(p) : Promise.resolve(p)
            )
        );
        const filtro = (search || "").toLowerCase();
        let lista =
            isOwner && filtro
                ? pacientes.filter(
                      (p) =>
                          p.nombre.toLowerCase().includes(filtro) ||
                          (p.codigo || "").toLowerCase().includes(filtro)
                  )
                : pacientes.slice();
        // Desvinculadas primero, luego pendientes, luego vinculadas (orden estable dentro).
        const rank = (s) =>
            s === "UNLINKED" ? 0 : s === "PENDING" ? 1 : s === "LINKED" ? 2 : 3;
        lista = lista.slice().sort((a, b) => {
            const ra = rank(a.linkStatus || "UNLINKED");
            const rb = rank(b.linkStatus || "UNLINKED");
            if (ra !== rb) return ra - rb;
            return 0;
        });
        mostrarPacientes(lista);
    } catch (err) {
        mostrarEstadoPacientes(
            "error",
            "No pudimos cargar la información.",
            "Inténtalo nuevamente."
        );
        toast("error", "Error al cargar", friendlyError(err));
        throw err;
    }
}

function abrirPerfil(id) {
    localStorage.setItem("pacienteID", id);
    window.location.href = "../perfil/perfil.html";
}

function mostrarExito(patient) {
    ultimoCreadoId = patient.id;
    document.getElementById("exitoCodigo").textContent = patient.code;
    const img = document.getElementById("exitoBarcode");
    if (window.PawBarcodeLocal) {
        PawBarcodeLocal.render(img, patient.code);
    } else {
        img.src =
            BARCODE_API +
            "?data=" +
            encodeURIComponent(patient.code) +
            "&code=Code128&dpi=96&imagetype=png";
    }
    modalExito.classList.add("activo");
}

function renderVinculaciones() {
    if (!contenedorVinculaciones) return;
    if (!pendingRequests.length) {
        contenedorVinculaciones.innerHTML =
            `<div class="estado-vacio estado-empty">` +
            `<i class="fa-solid fa-link"></i>` +
            `<p class="estado-titulo">No tienes solicitudes pendientes.</p>` +
            `<p class="estado-sub">Cuando alguien solicite vincularse, aparecerá aquí.</p>` +
            `</div>`;
        return;
    }

    contenedorVinculaciones.innerHTML = pendingRequests
        .map((r) => {
            const busy = processingIds.has(r.id);
            return `
            <article class="tarjeta-vinculo" data-id="${r.id}">
                <div class="vinculo-info">
                    <h3><i class="fa-solid fa-paw"></i> ${r.patientName || "Mascota"}</h3>
                    <p class="vinculo-meta">Solicitud de vinculación${r.patientCode ? " · " + r.patientCode : ""}</p>
                    <p><strong>Usuario:</strong> ${r.requesterName || r.requesterEmail || "—"}</p>
                    <p><strong>Tipo de relación:</strong> ${roleLabel(r.requestedRole)}</p>
                    <p><strong>Fecha:</strong> ${formatDate(r.createdAt)}</p>
                </div>
                <div class="vinculo-acciones">
                    <button type="button" class="btn-aceptar" data-action="approve" data-id="${r.id}" ${busy ? "disabled" : ""}>
                        ${busy ? "Procesando..." : "Aceptar"}
                    </button>
                    <button type="button" class="btn-rechazar" data-action="reject" data-id="${r.id}" ${busy ? "disabled" : ""}>
                        Rechazar
                    </button>
                </div>
            </article>`;
        })
        .join("");

    contenedorVinculaciones.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const action = btn.getAttribute("data-action");
            if (action === "approve") decideRequest(id, true);
            else decideRequest(id, false);
        });
    });
}

async function refreshPending(options) {
    const silent = options && options.silent;
    if (panelOpen && !silent) {
        contenedorVinculaciones.innerHTML =
            `<div class="estado-vacio estado-loading">` +
            `<i class="fa-solid fa-spinner fa-spin"></i>` +
            `<p class="estado-titulo">Cargando solicitudes...</p></div>`;
    }
    try {
        if (!PawApi.apiBase || !PawApi.apiBase()) {
            if (PawApi.isApiDebug && PawApi.isApiDebug()) {
                console.warn("[Pacientes] apiBase vacío; no se puede cargar vinculaciones");
            }
            throw new Error("API no configurada. Revisa la URL del servidor.");
        }
        const list = await PawApi.api.pendingLinkRequests();
        pendingRequests = Array.isArray(list) ? list : [];
        if (PawApi.isApiDebug && PawApi.isApiDebug()) {
            console.warn("[Pacientes] pending link-requests", {
                url: PawApi.apiBase() + "/patients/link-requests/pending",
                count: pendingRequests.length,
            });
        }
        updateBadge(pendingRequests.length);
        if (panelOpen) renderVinculaciones();
        return pendingRequests;
    } catch (err) {
        if (PawApi.isApiDebug && PawApi.isApiDebug()) {
            console.warn("[Pacientes] refreshPending falló", {
                url: (PawApi.apiBase && PawApi.apiBase()) + "/patients/link-requests/pending",
                error: err && err.message,
            });
        }
        if (panelOpen) {
            contenedorVinculaciones.innerHTML =
                `<div class="estado-vacio estado-error">` +
                `<i class="fa-solid fa-circle-exclamation"></i>` +
                `<p class="estado-titulo">No pudimos cargar la información.</p>` +
                `<p class="estado-sub">Inténtalo nuevamente.</p></div>`;
        }
        if (!silent) toast("error", "Error", friendlyError(err));
        throw err;
    }
}

function openPanel() {
    panelOpen = true;
    if (panelVinculaciones) panelVinculaciones.hidden = false;
    refreshPending().catch(() => {});
}

function closePanel() {
    panelOpen = false;
    if (panelVinculaciones) panelVinculaciones.hidden = true;
}

async function decideRequest(id, approve) {
    if (processingIds.has(id)) return;
    processingIds.add(id);
    renderVinculaciones();
    try {
        if (approve) {
            await PawApi.api.approveLinkRequest(id);
            toast("success", "Solicitud aceptada correctamente");
        } else {
            await PawApi.api.rejectLinkRequest(id);
            toast("success", "Solicitud rechazada");
        }
        pendingRequests = pendingRequests.filter((r) => r.id !== id);
        updateBadge(pendingRequests.length);
        renderVinculaciones();
        await cargarPacientes(buscar.value.trim()).catch(() => {});
    } catch (err) {
        // Reconcile: backend may have applied access even if the response failed
        await refreshPending({ silent: true }).catch(() => {});
        await cargarPacientes(buscar.value.trim()).catch(() => {});
        const stillPending = pendingRequests.some((r) => r.id === id);
        if (!stillPending && approve) {
            toast("success", "Solicitud aceptada correctamente");
        } else {
            toast("error", "No se pudo procesar la vinculación", friendlyError(err));
        }
        renderVinculaciones();
    } finally {
        processingIds.delete(id);
        renderVinculaciones();
    }
}

async function solicitarVinculacion() {
    const code = await PawCodeModal.ask({
        title: "Solicitar vinculación",
        message: "Ingresa o escanea el código de la mascota (PAW-XXXXXXX).",
    });
    if (!code) return;
    try {
        const req = await PawApi.api.createLinkRequest(code.trim());
        toast(
            "success",
            "Solicitud enviada",
            "Pendiente de aprobación " +
                (req.requestedRole === "OWNER" ? "del veterinario." : "del dueño.") +
                " (" +
                roleLabel(req.requestedRole) +
                ")"
        );
        await refreshPending({ silent: true }).catch(() => {});
    } catch (err) {
        toast("error", "No se pudo solicitar vinculación", friendlyError(err));
    }
}

btnNuevo.addEventListener("click", () => modal.classList.add("activo"));
cerrarModal.addEventListener("click", () => modal.classList.remove("activo"));
document.querySelector(".cerrarModalExito").addEventListener("click", () => {
    modalExito.classList.remove("activo");
});
document.getElementById("btnVerExpediente").addEventListener("click", () => {
    if (ultimoCreadoId) abrirPerfil(ultimoCreadoId);
});

window.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("activo");
    if (e.target === modalExito) modalExito.classList.remove("activo");
});

btnVincular.addEventListener("click", () => {
    if (panelOpen) closePanel();
    else openPanel();
});

document.getElementById("cerrarPanelVinculaciones")?.addEventListener("click", closePanel);

if (btnSolicitar) {
    btnSolicitar.addEventListener("click", () => solicitarVinculacion());
}

async function resolverCodigo(code) {
    const value = (code || "").trim();
    if (!value) return;
    try {
        if (isOwner) {
            const req = await PawApi.api.createLinkRequest(value);
            toast(
                "success",
                "Solicitud enviada",
                "Pendiente de aprobación (" + roleLabel(req.requestedRole) + ")."
            );
            await refreshPending({ silent: true }).catch(() => {});
            return;
        }
        const patient = await PawApi.api.get("/patients/code/" + encodeURIComponent(value));
        abrirPerfil(patient.id);
    } catch (err) {
        toast("error", "No se encontró el paciente", friendlyError(err));
    }
}

async function migrarCodigosSiVet() {
    if (isOwner) return;
    const btn = document.getElementById("btnMigrarCodigos");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        if (!confirm("¿Reimprimir/migrar todos los códigos a formato seguro PAW-XXXXXXX?")) return;
        try {
            const result = await PawApi.api.migratePatientCodes();
            toast(
                "success",
                "Códigos migrados",
                (result.migrated || 0) + " etiquetas para reimprimir."
            );
            await cargarPacientes(buscar.value.trim());
        } catch (err) {
            toast("error", "No se pudo migrar", friendlyError(err));
        }
    });
}
migrarCodigosSiVet();

document.querySelector(".qr")?.addEventListener("click", async () => {
    const code = await PawCodeModal.ask({
        title: "Buscar por código",
        message: "Ingresa o escanea el código del paciente (PAW-XXXXXX).",
    });
    if (code) await resolverCodigo(code);
});

if (window.PawBarcodeHid) {
    PawBarcodeHid.attach((code) => resolverCodigo(code));
    const scanInput = document.getElementById("scanHidInput");
    if (scanInput) {
        scanInput.addEventListener("paw-barcode", (e) => {
            if (e.detail && e.detail.code) resolverCodigo(e.detail.code);
        });
        // Keep wedge target available without stealing focus from search
        setTimeout(() => {
            if (document.activeElement === document.body) scanInput.focus();
        }, 200);
    }
}

let searchTimer;
buscar.addEventListener("keyup", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            await cargarPacientes(buscar.value.trim());
        } catch (_) {
            /* toast already shown */
        }
    }, 300);
});

function readFotoAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
    });
}

function collectCreateMeals() {
    const rows = document.querySelectorAll("#mealRows .meal-row");
    const meals = [];
    rows.forEach((row, index) => {
        if (meals.length >= 3) return;
        const label = (row.querySelector(".meal-label")?.value || "").trim();
        const time = (row.querySelector(".meal-time")?.value || "").trim();
        const amount = (row.querySelector(".meal-amount")?.value || "").trim();
        const food = (row.querySelector(".meal-food")?.value || "").trim();
        if (!label || !time) return;
        meals.push({
            label,
            time,
            amount: amount || undefined,
            food: food || undefined,
            sortOrder: index,
        });
    });
    return meals;
}

formulario.addEventListener("submit", async function (e) {
    e.preventDefault();
    const edadVal = document.getElementById("edad").value;
    const pesoVal = document.getElementById("peso").value.trim();
    const fotoInput = document.getElementById("foto");
    const file = fotoInput && fotoInput.files && fotoInput.files[0];

    const body = {
        name: document.getElementById("nombre").value.trim(),
        species: document.getElementById("especie").value.trim(),
        breed: document.getElementById("raza").value.trim(),
        age: edadVal ? edadVal + " años" : "",
        sex: document.getElementById("sexo").value,
        ownerName: document.getElementById("propietario").value.trim(),
        weight: pesoVal ? pesoVal + " kg" : undefined,
        color: document.getElementById("color").value.trim() || undefined,
        microchip: document.getElementById("microchip").value,
        photo: DEFAULT_FOTO,
    };

    if (!body.name || !body.species || !body.breed || !body.age || !body.ownerName) {
        toast("warning", "Campos incompletos", "Completa los campos obligatorios.");
        return;
    }

    const recommendedAmount = document.getElementById("dietaCantidad").value.trim();
    const mealsPerDay = Number(document.getElementById("dietaComidasDia").value) || 0;
    const allowedFoods = document.getElementById("dietaPermitidos").value.trim();
    const forbiddenFoods = document.getElementById("dietaProhibidos").value.trim();
    const meals = collectCreateMeals();
    if (recommendedAmount && mealsPerDay > 0) {
        body.feeding = {
            recommendedAmount,
            mealsPerDay,
            allowedFoods: allowedFoods || undefined,
            forbiddenFoods: forbiddenFoods || undefined,
            meals: meals.length ? meals : undefined,
        };
    }

    const consultaMotivo = document.getElementById("consultaMotivo").value.trim();
    if (consultaMotivo) {
        body.firstConsultation = {
            type: document.getElementById("consultaTipo").value || "GENERAL",
            reason: consultaMotivo,
            diagnosis: document.getElementById("consultaDiagnostico").value.trim() || undefined,
            treatment: document.getElementById("consultaTratamiento").value.trim() || undefined,
        };
    }

    try {
        if (file) {
            if (file.size > 1.5 * 1024 * 1024) {
                toast("warning", "Foto demasiado grande", "La foto debe pesar menos de 1.5 MB.");
                return;
            }
            body.photo = await readFotoAsDataUrl(file);
        }
        const created = await PawApi.api.createPatient(body);
        formulario.reset();
        modal.classList.remove("activo");
        await cargarPacientes(buscar.value.trim());
        mostrarExito(created);
        toast("success", "Paciente registrado");
    } catch (err) {
        toast("error", "No se pudo registrar", friendlyError(err));
    }
});

pintarSidebar();
configurarRol();
if (!PawApi.apiBase || !PawApi.apiBase()) {
    console.warn("[Pacientes] apiBase vacío — configura PAWMYLI_API_BASE o localStorage.pawmyliApiBase");
    toast("error", "API no configurada", "No se pudo determinar la URL del servidor.");
} else {
    PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
    cargarPacientes().catch(() => {});
    refreshPending({ silent: true }).catch(() => {});
}

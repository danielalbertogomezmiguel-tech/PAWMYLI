if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

const DEFAULT_FOTO = PawApi.defaultAvatar();
const BARCODE_API =
    (window.PAWMYLI_CONFIG && window.PAWMYLI_CONFIG.barcodeApiUrl) ||
    "https://barcode.tec-it.com/barcode.ashx";
const pacienteId = localStorage.getItem("pacienteID");
const user = PawApi.getUser();
const isOwner = user && user.role === "owner";
let paciente = null;

if (!pacienteId) {
    window.location.href = "../pacientes/paciente.html";
}

function pintarSidebar() {
    PawApi.applySidebar();
}

function barcodeUrl(code) {
    return (
        BARCODE_API +
        "?data=" +
        encodeURIComponent(code || "SIN-CODIGO") +
        "&code=Code128&dpi=96&imagetype=png"
    );
}

function linkStatusLabel(status) {
    const map = {
        LINKED: "Vinculado",
        UNLINKED: "Sin vincular",
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

function consultationTypeLabel(type) {
    const map = {
        GENERAL: "General",
        PREVENTIVA: "Preventiva",
        VACUNACION: "Vacunación",
        DESPARASITACION: "Desparasitación",
        ENFERMEDAD: "Enfermedad",
        TRAUMATOLOGIA: "Traumatología",
        REPRODUCTIVA: "Reproductiva",
        SEGUIMIENTO: "Seguimiento",
    };
    return map[type] || type || "—";
}

function pintarComidas(feeding) {
    const box = document.getElementById("listaComidas");
    if (!box) return;
    box.innerHTML = "";
    const meals = feeding && Array.isArray(feeding.meals) ? feeding.meals : [];
    if (!meals.length) {
        if (isOwner) {
            box.innerHTML = "<p style='color:#8a9aa8;font-size:14px;'>Sin comidas programadas</p>";
        }
        return;
    }
    meals.forEach((m) => {
        const parts = [m.time, m.amount, m.food].filter(Boolean).join(" · ");
        box.innerHTML += `<div class="comida-item"><strong>${m.label || "Comida"}</strong>${
            parts ? " — " + parts : ""
        }</div>`;
    });
}

function feedingLogStatusClass(status) {
    if (status === "EATEN") return "eaten";
    if (status === "PENDING") return "pending";
    return "unlogged";
}

function feedingLogStatusLabel(status) {
    if (status === "EATEN") return "Comido";
    if (status === "PENDING") return "Pendiente";
    return "Sin registro";
}

async function cargarFeedingLogs() {
    const lista = document.getElementById("listaFeedingLogs");
    if (!lista || !pacienteId) return;
    lista.innerHTML = "<li>Cargando registros...</li>";
    try {
        const logs = await PawApi.api.listFeedingLogs(pacienteId);
        const items = Array.isArray(logs) ? logs : logs?.data || [];
        if (!items.length) {
            lista.innerHTML = "<li>Sin registros de alimentación</li>";
            return;
        }
        lista.innerHTML = "";
        items.forEach((log) => {
            const mealLabel = (log.meal && (log.meal.label || log.meal.time)) || log.mealId || "Comida";
            const date = log.scheduledDate || "—";
            const status = log.status || "UNLOGGED";
            lista.innerHTML += `<li>
                <span><strong>${date}</strong> · ${mealLabel}</span>
                <span class="log-status ${feedingLogStatusClass(status)}">${feedingLogStatusLabel(status)}</span>
            </li>`;
        });
    } catch (_) {
        lista.innerHTML = "<li>No se pudieron cargar los registros</li>";
    }
}

function cargarPerfil() {
    if (!paciente) {
        document.querySelector(".perfilMascota").innerHTML =
            "<p style='text-align:center;padding:40px;font-size:24px;color:#999;'>Paciente no encontrado</p>";
        return;
    }

    document.getElementById("fotoPaciente").src = paciente.foto || DEFAULT_FOTO;
    document.getElementById("nombrePaciente").textContent = paciente.nombre || "";
    const badge = document.getElementById("badgeLinkStatus");
    if (badge) {
        const status = paciente.linkStatus || "UNLINKED";
        badge.hidden = false;
        badge.textContent = linkStatusLabel(status);
        badge.className = "badge-link " + linkStatusClass(status);
        badge.title = status;
    }
    document.getElementById("especie").textContent = paciente.especie;
    document.getElementById("raza").textContent = paciente.raza;
    document.getElementById("edad").textContent = paciente.edad;
    document.getElementById("sexo").textContent = paciente.sexo;
    document.getElementById("peso").textContent = paciente.peso || "—";
    document.getElementById("color").textContent = paciente.color || "—";
    document.getElementById("microchip").textContent = paciente.microchip || "No";
    document.getElementById("propietario").textContent = paciente.propietario;
    document.getElementById("telefono").textContent = paciente.telefono || "—";
    document.getElementById("correo").textContent = paciente.correo || "—";
    document.getElementById("codigoPaciente").textContent = paciente.codigo || "—";
    const bc = document.getElementById("barcodeImg");
    const codeForBc = paciente.barcodePayload || paciente.codigo;
    if (window.PawBarcodeLocal) {
        PawBarcodeLocal.render(bc, codeForBc);
    } else {
        bc.src = barcodeUrl(codeForBc);
    }

    const listaAlim = document.getElementById("listaAlimentacion");
    listaAlim.innerHTML = "";
    const feeding = paciente.feeding;
    if (isOwner && feeding) {
        const ownerLines = [
            feeding.recommendedAmount ? "Cantidad: " + feeding.recommendedAmount : null,
            feeding.mealsPerDay != null ? "Comidas/día: " + feeding.mealsPerDay : null,
            feeding.allowedFoods ? "Permitidos: " + feeding.allowedFoods : null,
            feeding.forbiddenFoods ? "Prohibidos: " + feeding.forbiddenFoods : null,
            feeding.vetNotes || feeding.specialInstructions
                ? "Notas: " + (feeding.vetNotes || feeding.specialInstructions)
                : null,
        ].filter(Boolean);
        if (ownerLines.length) {
            ownerLines.forEach((item) => {
                listaAlim.innerHTML += `<li>${item}</li>`;
            });
        } else {
            listaAlim.innerHTML = "<li>Sin información</li>";
        }
    } else if (paciente.alimentacion && paciente.alimentacion.length) {
        paciente.alimentacion.forEach((item) => {
            listaAlim.innerHTML += `<li>${item}</li>`;
        });
    } else {
        listaAlim.innerHTML = "<li>Sin información</li>";
    }
    pintarComidas(feeding);

    if (feeding) {
        document.getElementById("dietaPeso").value = feeding.weightKg ?? "";
        document.getElementById("dietaComidas").value = feeding.mealsPerDay ?? 2;
        document.getElementById("dietaNotas").value = feeding.vetNotes || feeding.specialInstructions || "";
        document.getElementById("dietaResultado").value = feeding.recommendedAmount || "";
        document.getElementById("dietaKcal").value =
            feeding.caloriesPerDay != null ? String(feeding.caloriesPerDay) : "";
    }

    const tabla = document.getElementById("historial");
    tabla.innerHTML = "";
    if (paciente.historial && paciente.historial.length) {
        paciente.historial.forEach((item) => {
            let clase = "";
            switch (item.estado) {
                case "Finalizada":
                    clase = "finalizada";
                    break;
                case "En proceso":
                    clase = "proceso";
                    break;
                default:
                    clase = "cancelada";
            }
            const num = item.consultationNumber || "—";
            const tipo = consultationTypeLabel(item.type);
            tabla.innerHTML += `
            <tr>
                <td>${num}</td>
                <td>${item.fecha}</td>
                <td>${tipo}</td>
                <td>${item.motivo || "—"}</td>
                <td>${item.veterinario || "—"}</td>
                <td><span class="estado ${clase}">${item.estado}</span></td>
            </tr>`;
        });
    } else {
        tabla.innerHTML = `<tr><td colspan="6">Sin historial médico</td></tr>`;
    }

    if (isOwner) {
        const editarBtn = document.querySelector(".editar");
        const consultaBtn = document.getElementById("btnNuevaConsulta");
        if (editarBtn) editarBtn.style.display = "none";
        if (consultaBtn) consultaBtn.style.display = "none";
        const formDieta = document.getElementById("formDieta");
        if (formDieta) {
            formDieta.querySelectorAll("input, textarea, button").forEach((el) => {
                if (el.id === "dietaResultado" || el.id === "dietaKcal") return;
                el.disabled = true;
            });
        }
    }
}

async function refrescarPaciente() {
    const data = await PawApi.api.getPatient(pacienteId);
    paciente = PawApi.mapPatient(data);
    if (PawApi.enrichPatientPhoto) {
        paciente = await PawApi.enrichPatientPhoto(paciente);
    }
    cargarPerfil();
    cargarFeedingLogs().catch(() => {});
}

document.querySelector(".volver").addEventListener("click", () => {
    window.location.href = "../pacientes/paciente.html";
});

document.getElementById("btnDescargarBarcode").addEventListener("click", () => {
    const img = document.getElementById("barcodeImg");
    const a = document.createElement("a");
    a.href = img.src;
    a.download = (paciente?.codigo || "barcode") + ".png";
    a.target = "_blank";
    a.click();
});

document.getElementById("btnImprimirBarcode").addEventListener("click", () => {
    const code = paciente?.codigo || "";
    const src = document.getElementById("barcodeImg").src;
    const w = window.open("", "_blank");
    w.document.write(
        `<html><head><title>${code}</title></head><body style="text-align:center;font-family:sans-serif;">` +
            `<h2>${code}</h2><img src="${src}" style="max-width:90%;"><script>window.onload=()=>window.print()<\\/script></body></html>`
    );
    w.document.close();
});

const modal = document.getElementById("modalEditar");

document.querySelector(".editar").addEventListener("click", () => {
    if (isOwner) return;
    document.getElementById("editNombre").value = paciente.nombre;
    document.getElementById("editEspecie").value = paciente.especie;
    document.getElementById("editRaza").value = paciente.raza;
    document.getElementById("editEdad").value = paciente.edad ? String(paciente.edad).replace(" años", "") : "";
    document.getElementById("editSexo").value = paciente.sexo;
    document.getElementById("editPeso").value = paciente.peso ? String(paciente.peso).replace(" kg", "") : "";
    document.getElementById("editColor").value = paciente.color || "";
    document.getElementById("editMicrochip").value = paciente.microchip || "No";
    document.getElementById("editPropietario").value = paciente.propietario;
    modal.classList.add("activo");
});

document.querySelector(".cerrarModal").addEventListener("click", () => modal.classList.remove("activo"));
window.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("activo");
});

document.getElementById("formEditar").addEventListener("submit", async function (e) {
    e.preventDefault();
    const body = {
        name: document.getElementById("editNombre").value.trim(),
        species: document.getElementById("editEspecie").value.trim(),
        breed: document.getElementById("editRaza").value.trim(),
        age: document.getElementById("editEdad").value + " años",
        sex: document.getElementById("editSexo").value,
        weight: document.getElementById("editPeso").value
            ? document.getElementById("editPeso").value + " kg"
            : undefined,
        color: document.getElementById("editColor").value.trim() || undefined,
        microchip: document.getElementById("editMicrochip").value,
        ownerName: document.getElementById("editPropietario").value.trim(),
        ownerPhone: paciente.telefono || undefined,
        ownerEmail: paciente.correo || undefined,
        photo: paciente.foto,
    };

    try {
        await PawApi.api.updatePatient(pacienteId, body);
        await refrescarPaciente();
        modal.classList.remove("activo");
        alert("Paciente actualizado correctamente.");
    } catch (err) {
        alert(err.message || "No se pudo actualizar.");
    }
});

const modalConsulta = document.getElementById("modalConsulta");

document.getElementById("btnNuevaConsulta").addEventListener("click", () => {
    if (isOwner) return;
    document.getElementById("consultaFecha").value = new Date().toISOString().split("T")[0];
    if (user?.name) document.getElementById("consultaVet").value = user.name;
    const numEl = document.getElementById("consultaNumero");
    if (numEl) numEl.value = "";
    modalConsulta.classList.add("activo");
});

document.querySelector(".cerrarModalConsulta").addEventListener("click", () => {
    modalConsulta.classList.remove("activo");
});

window.addEventListener("click", (e) => {
    if (e.target === modalConsulta) modalConsulta.classList.remove("activo");
});

document.getElementById("formConsulta").addEventListener("submit", async function (e) {
    e.preventDefault();
    const body = {
        date: document.getElementById("consultaFecha").value,
        type: document.getElementById("consultaTipo").value || "GENERAL",
        reason: document.getElementById("consultaMotivo").value.trim(),
        vetName: document.getElementById("consultaVet").value.trim(),
        status: document.getElementById("consultaEstado").value,
        weightAtVisit: document.getElementById("consultaPeso").value.trim() || undefined,
        temperature: document.getElementById("consultaTemp").value.trim() || undefined,
        heartRate: document.getElementById("consultaFC").value.trim() || undefined,
        respiratoryRate: document.getElementById("consultaFR").value.trim() || undefined,
        physicalExam: document.getElementById("consultaExamen").value.trim() || undefined,
        diagnosis: document.getElementById("consultaDiagnostico").value.trim() || undefined,
        treatment: document.getElementById("consultaTratamiento").value.trim() || undefined,
        prescriptions: document.getElementById("consultaReceta").value.trim() || undefined,
        notes: document.getElementById("consultaNotas").value.trim() || undefined,
        followUpDate: document.getElementById("consultaSeguimiento").value || undefined,
    };

    try {
        const created = await PawApi.api.addMedicalRecord(pacienteId, body);
        if (created && created.consultationNumber) {
            document.getElementById("consultaNumero").value = created.consultationNumber;
        }
        await refrescarPaciente();
        this.reset();
        modalConsulta.classList.remove("activo");
        alert(
            created && created.consultationNumber
                ? "Consulta registrada: " + created.consultationNumber
                : "Consulta registrada correctamente."
        );
    } catch (err) {
        alert(err.message || "No se pudo registrar la consulta.");
    }
});

document.getElementById("formDieta").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (isOwner) return;
    const weightKg = Number(document.getElementById("dietaPeso").value);
    const mealsPerDay = Number(document.getElementById("dietaComidas").value) || 2;
    const vetNotes = document.getElementById("dietaNotas").value.trim() || undefined;

    try {
        const feeding = await PawApi.api.generateDiet(pacienteId, {
            weightKg,
            mealsPerDay,
            vetNotes,
            species: paciente.especie,
        });
        document.getElementById("dietaResultado").value = feeding.recommendedAmount || "";
        document.getElementById("dietaKcal").value =
            feeding.caloriesPerDay != null ? String(feeding.caloriesPerDay) : "";
        await refrescarPaciente();
        alert("Dieta generada y guardada.");
    } catch (err) {
        alert(err.message || "No se pudo generar la dieta.");
    }
});

document.getElementById("btnGuardarDietaManual").addEventListener("click", async () => {
    if (isOwner) return;
    const recommendedAmount = document.getElementById("dietaResultado").value.trim();
    const mealsPerDay = Number(document.getElementById("dietaComidas").value) || 2;
    const vetNotes = document.getElementById("dietaNotas").value.trim() || undefined;
    const weightKg = Number(document.getElementById("dietaPeso").value) || undefined;
    const caloriesPerDay = Number(document.getElementById("dietaKcal").value) || undefined;

    if (!recommendedAmount) {
        alert("Genera la dieta o escribe una cantidad recomendada.");
        return;
    }

    try {
        await PawApi.api.updateFeeding(pacienteId, {
            recommendedAmount,
            mealsPerDay,
            vetNotes,
            specialInstructions: vetNotes,
            weightKg,
            caloriesPerDay,
        });
        await refrescarPaciente();
        alert("Dieta actualizada.");
    } catch (err) {
        alert(err.message || "No se pudo guardar la dieta.");
    }
});

pintarSidebar();
PawApi.syncProfileToSession().then(() => {
    pintarSidebar();
    if (PawApi.getUser()?.name) {
        const vetInput = document.getElementById("consultaVet");
        if (vetInput && !vetInput.value.trim()) vetInput.value = PawApi.getUser().name;
    }
}).catch(() => {});
refrescarPaciente().catch((err) => {
    document.querySelector(".perfilMascota").innerHTML =
        `<p style='text-align:center;padding:40px;color:#e8556d;'>${err.message}</p>`;
});

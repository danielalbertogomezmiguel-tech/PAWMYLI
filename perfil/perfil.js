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

const TYPE_PAYLOAD_LABELS = {
    anamnesis: "Anamnesis",
    hydration: "Hidratación",
    mucousMembranes: "Mucosas",
    bodyCondition: "Condición corporal",
    physicalExam: "Examen físico",
    findings: "Hallazgos",
    diagnosis: "Diagnóstico",
    treatment: "Tratamiento",
    medication: "Medicamento",
    dose: "Dosis",
    medFrequency: "Frecuencia",
    duration: "Duración",
    indications: "Indicaciones",
    nextControl: "Próximo control",
    vaccinesReviewed: "Vacunas revisadas",
    dewormingReviewed: "Desparasitación revisada",
    parasitePrevention: "Prevención de parásitos",
    recommendations: "Recomendaciones",
    feedingNotes: "Notas de alimentación",
    hygiene: "Higiene",
    activity: "Actividad",
    assessment: "Valoración",
    vaccine: "Vacuna",
    diseasePrevented: "Enfermedad prevenida",
    manufacturer: "Fabricante",
    lot: "Lote",
    applicationDate: "Fecha de aplicación",
    expiryDate: "Fecha de caducidad",
    route: "Vía",
    site: "Sitio de aplicación",
    priorReactions: "Reacciones previas",
    postReactions: "Reacciones posteriores",
    nextDose: "Próxima dosis",
    vaccineNotes: "Notas de vacuna",
    parasiteType: "Tipo de parásito",
    product: "Producto",
    activeIngredient: "Principio activo",
    frequency: "Frecuencia",
    weightForDose: "Peso para dosis",
    nextDeworming: "Próxima desparasitación",
    notes: "Notas",
    symptoms: "Síntomas",
    symptomOnset: "Inicio de síntomas",
    evolution: "Evolución",
    relevantHistory: "Antecedentes relevantes",
    clinicalSigns: "Signos clínicos",
    testsDone: "Estudios realizados",
    results: "Resultados",
    presumptiveDiagnosis: "Diagnóstico presuntivo",
    definitiveDiagnosis: "Diagnóstico definitivo",
    prognosis: "Pronóstico",
    traumaReason: "Motivo del trauma",
    eventDateTime: "Fecha y hora del evento",
    injuryType: "Tipo de lesión",
    affectedZone: "Zona afectada",
    howOccurred: "Cómo ocurrió",
    pain: "Dolor",
    inflammation: "Inflamación",
    wounds: "Heridas",
    mobility: "Movilidad",
    limp: "Cojera",
    studies: "Estudios",
    imagingNotes: "Notas de imagen",
    immobilization: "Inmovilización",
    reproductiveStatus: "Estado reproductivo",
    reproductiveHistory: "Historial reproductivo",
    cycleHeat: "Ciclo / celo",
    lastHeatDate: "Último celo",
    priorGestations: "Gestaciones previas",
    priorBirths: "Partos previos",
    priorProblems: "Problemas previos",
    reproductiveExam: "Examen reproductivo",
    followUp: "Seguimiento",
    relatedConsultationId: "Consulta relacionada",
    followUpReason: "Motivo de seguimiento",
    changesSince: "Cambios desde última visita",
    currentSigns: "Signos actuales",
    treatmentResponse: "Respuesta al tratamiento",
    currentMeds: "Medicación actual",
    treatmentCompliance: "Cumplimiento del tratamiento",
    newFindings: "Nuevos hallazgos",
    newTests: "Nuevos estudios",
    currentStatus: "Estado actual",
    treatmentModification: "Modificación del tratamiento",
    newIndications: "Nuevas indicaciones",
};

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

function typePayloadLabel(key) {
    return TYPE_PAYLOAD_LABELS[key] || key;
}

function isFemaleSex(sexo) {
    const s = String(sexo || "").toLowerCase();
    return s.includes("hembra") || s === "f" || s === "female";
}

function currentTimeValue() {
    const now = new Date();
    return (
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0")
    );
}

function showConsultaTipoSection(tipo) {
    const selected = tipo || "GENERAL";
    document.querySelectorAll(".consulta-tipo-seccion").forEach((section) => {
        const match = section.getAttribute("data-tipo") === selected;
        section.hidden = !match;
    });
    applyReproductivaSexVisibility();
}

function applyReproductivaSexVisibility() {
    const seccion = document.getElementById("seccionREPRODUCTIVA");
    if (!seccion || seccion.hidden) return;
    const female = isFemaleSex(paciente && paciente.sexo);
    seccion.querySelectorAll(".campo-sexo-hembra").forEach((el) => {
        el.hidden = !female;
        if (!female) {
            el.querySelectorAll("input, textarea, select").forEach((field) => {
                field.value = "";
            });
        }
    });
}

function collectTypePayload(tipo) {
    const section = document.querySelector(
        '.consulta-tipo-seccion[data-tipo="' + (tipo || "GENERAL") + '"]'
    );
    const payload = {};
    if (!section) return payload;
    section.querySelectorAll("input[name], textarea[name], select[name]").forEach((el) => {
        if (el.closest("[hidden]")) return;
        const key = el.getAttribute("name");
        if (!key) return;
        const value = String(el.value || "").trim();
        if (value) payload[key] = value;
    });
    return payload;
}

function fillRelatedConsultationSelect() {
    const select = document.getElementById("relatedConsultationId");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">— Sin seleccionar —</option>';
    const list = (paciente && paciente.historial) || [];
    list.forEach((item) => {
        if (!item.id) return;
        const label =
            (item.consultationNumber || item.id) +
            " · " +
            (item.fecha || "") +
            " · " +
            consultationTypeLabel(item.type);
        select.innerHTML += `<option value="${item.id}">${label}</option>`;
    });
    if (current) select.value = current;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function detalleRow(label, value) {
    if (value == null || value === "") return "";
    return `<div class="detalle-fila"><span class="detalle-label">${escapeHtml(
        label
    )}</span><span class="detalle-valor">${escapeHtml(value)}</span></div>`;
}

function resolveRelatedConsultaLabel(id) {
    if (!id || !paciente || !paciente.historial) return id;
    const found = paciente.historial.find((h) => h.id === id);
    if (!found) return id;
    return (
        (found.consultationNumber || found.id) +
        " · " +
        (found.fecha || "") +
        " · " +
        consultationTypeLabel(found.type)
    );
}

function mostrarDetalleConsulta(item) {
    const box = document.getElementById("detalleConsultaContenido");
    const modal = document.getElementById("modalDetalleConsulta");
    if (!box || !modal || !item) return;

    let html = "";
    html += detalleRow("Nº consulta", item.consultationNumber);
    html += detalleRow("Fecha", item.fecha);
    html += detalleRow("Hora", item.time);
    html += detalleRow("Tipo", consultationTypeLabel(item.type));
    html += detalleRow("Motivo", item.motivo || item.reason);
    html += detalleRow("Veterinario", item.veterinario || item.vetName);
    html += detalleRow("Propietario", item.ownerName);
    html += detalleRow("Estado", item.estado || item.status);
    html += detalleRow("Peso", item.weightAtVisit);
    html += detalleRow("Temperatura", item.temperature);
    html += detalleRow("Frecuencia cardiaca", item.heartRate);
    html += detalleRow("Frecuencia respiratoria", item.respiratoryRate);
    html += detalleRow("Observaciones", item.observations);
    html += detalleRow("Diagnóstico", item.diagnostico || item.diagnosis);
    html += detalleRow("Tratamiento", item.tratamiento || item.treatment);
    html += detalleRow("Medicamento", item.medication);
    html += detalleRow("Examen físico", item.physicalExam);
    html += detalleRow("Prescripciones", item.prescriptions);
    html += detalleRow("Resultados", item.results);
    html += detalleRow("Notas", item.notes);
    html += detalleRow("Seguimiento", item.followUpDate);
    html += detalleRow("Hora seguimiento", item.followUpTime);

    if (!isOwner) {
        html += detalleRow("Notas privadas", item.privateNotes);
    }

    const payload = item.typePayload && typeof item.typePayload === "object" ? item.typePayload : null;
    if (payload && Object.keys(payload).length) {
        html += `<h3 class="detalle-subtitulo">Detalle por tipo</h3>`;
        Object.keys(payload).forEach((key) => {
            let val = payload[key];
            if (key === "relatedConsultationId") val = resolveRelatedConsultaLabel(val);
            html += detalleRow(typePayloadLabel(key), val);
        });
    } else if (isOwner && (item.recomendaciones || item.motivo)) {
        html += detalleRow("Recomendaciones", item.recomendaciones);
    }

    if (!html) html = "<p>Sin datos de consulta.</p>";
    box.innerHTML = html;
    modal.classList.add("activo");
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
    const btnUnlink = document.getElementById("btnDesvincular");
    if (btnUnlink) {
        const isVet = (PawApi.getUser()?.role || "").toLowerCase() === "vet";
        const linked = (paciente.linkStatus || "") === "LINKED";
        btnUnlink.hidden = !(isVet && linked);
        btnUnlink.onclick = async () => {
            const ok = window.confirm(
                "¿Desvincular esta mascota del usuario?\n\n" +
                    "La mascota seguirá en el sistema veterinario con su historial y datos médicos. " +
                    "Solo se elimina la relación con el usuario; no se borra la mascota."
            );
            if (!ok) return;
            btnUnlink.disabled = true;
            try {
                await PawApi.api.unlinkPatient(paciente.id);
                await refrescarPaciente();
                alert("Mascota desvinculada. Sigue disponible en tu listado de pacientes.");
            } catch (err) {
                alert(err.message || "No se pudo desvincular.");
            } finally {
                btnUnlink.disabled = false;
            }
        };
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
        paciente.historial.forEach((item, index) => {
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
            <tr class="historial-fila" data-historial-index="${index}" title="Ver detalle">
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
const modalDetalleConsulta = document.getElementById("modalDetalleConsulta");

function prepareConsultaForm() {
    const form = document.getElementById("formConsulta");
    if (form) form.reset();
    document.getElementById("consultaFecha").value = new Date().toISOString().split("T")[0];
    document.getElementById("consultaHora").value = currentTimeValue();
    const sessionUser = PawApi.getUser() || user;
    if (sessionUser?.name) {
        document.getElementById("consultaVet").value = sessionUser.name;
        const list = document.getElementById("listaVeterinarios");
        if (list) list.innerHTML = `<option value="${sessionUser.name}">`;
    }
    document.getElementById("consultaPropietario").value = (paciente && paciente.propietario) || "";
    document.getElementById("consultaPacienteNombre").textContent =
        (paciente && paciente.nombre) || "—";
    if (paciente && paciente.peso) {
        document.getElementById("consultaPeso").value = paciente.peso;
    }
    const numEl = document.getElementById("consultaNumero");
    if (numEl) numEl.value = "";
    document.getElementById("consultaTipo").value = "GENERAL";
    fillRelatedConsultationSelect();
    showConsultaTipoSection("GENERAL");
}

document.getElementById("btnNuevaConsulta").addEventListener("click", () => {
    if (isOwner) return;
    prepareConsultaForm();
    modalConsulta.classList.add("activo");
});

document.getElementById("consultaTipo").addEventListener("change", (e) => {
    showConsultaTipoSection(e.target.value);
});

document.querySelector(".cerrarModalConsulta").addEventListener("click", () => {
    modalConsulta.classList.remove("activo");
});

document.querySelector(".cerrarModalDetalle").addEventListener("click", () => {
    modalDetalleConsulta.classList.remove("activo");
});

window.addEventListener("click", (e) => {
    if (e.target === modalConsulta) modalConsulta.classList.remove("activo");
    if (e.target === modalDetalleConsulta) modalDetalleConsulta.classList.remove("activo");
});

document.getElementById("historial").addEventListener("click", (e) => {
    const row = e.target.closest("tr.historial-fila");
    if (!row || !paciente || !paciente.historial) return;
    const idx = Number(row.getAttribute("data-historial-index"));
    const item = paciente.historial[idx];
    if (item) mostrarDetalleConsulta(item);
});

document.getElementById("formConsulta").addEventListener("submit", async function (e) {
    e.preventDefault();
    const type = document.getElementById("consultaTipo").value || "GENERAL";
    const typePayload = collectTypePayload(type);
    const body = {
        date: document.getElementById("consultaFecha").value,
        time: document.getElementById("consultaHora").value || undefined,
        type,
        reason: document.getElementById("consultaMotivo").value.trim(),
        vetName: document.getElementById("consultaVet").value.trim(),
        ownerName: document.getElementById("consultaPropietario").value.trim() || undefined,
        status: document.getElementById("consultaEstado").value,
        weightAtVisit: document.getElementById("consultaPeso").value.trim() || undefined,
        temperature: document.getElementById("consultaTemp").value.trim() || undefined,
        heartRate: document.getElementById("consultaFC").value.trim() || undefined,
        respiratoryRate: document.getElementById("consultaFR").value.trim() || undefined,
        observations: document.getElementById("consultaObservaciones").value.trim() || undefined,
        privateNotes: document.getElementById("consultaNotasPrivadas").value.trim() || undefined,
        followUpDate: document.getElementById("consultaSeguimiento").value || undefined,
        followUpTime: document.getElementById("consultaSeguimientoHora").value || undefined,
    };

    if (Object.keys(typePayload).length) {
        body.typePayload = typePayload;
    }
    if (typePayload.relatedConsultationId) {
        body.relatedConsultationId = typePayload.relatedConsultationId;
    }
    // Promote common clinical fields for owner projection / list views
    if (typePayload.diagnosis) body.diagnosis = typePayload.diagnosis;
    else if (typePayload.definitiveDiagnosis) body.diagnosis = typePayload.definitiveDiagnosis;
    else if (typePayload.presumptiveDiagnosis) body.diagnosis = typePayload.presumptiveDiagnosis;
    if (typePayload.treatment) body.treatment = typePayload.treatment;
    if (typePayload.medication) body.medication = typePayload.medication;
    else if (typePayload.vaccine) body.medication = typePayload.vaccine;
    else if (typePayload.product) body.medication = typePayload.product;
    if (typePayload.physicalExam) body.physicalExam = typePayload.physicalExam;
    if (typePayload.results) body.results = typePayload.results;
    if (typePayload.notes) body.notes = typePayload.notes;

    try {
        const created = await PawApi.api.addMedicalRecord(pacienteId, body);
        if (created && created.consultationNumber) {
            document.getElementById("consultaNumero").value = created.consultationNumber;
        }
        await refrescarPaciente();
        this.reset();
        showConsultaTipoSection("GENERAL");
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
showConsultaTipoSection(document.getElementById("consultaTipo")?.value || "GENERAL");
PawApi.syncProfileToSession().then(() => {
    pintarSidebar();
    if (PawApi.getUser()?.name) {
        const vetInput = document.getElementById("consultaVet");
        if (vetInput && !vetInput.value.trim()) vetInput.value = PawApi.getUser().name;
        const list = document.getElementById("listaVeterinarios");
        if (list) list.innerHTML = `<option value="${PawApi.getUser().name}">`;
    }
}).catch(() => {});
refrescarPaciente().catch((err) => {
    document.querySelector(".perfilMascota").innerHTML =
        `<p style='text-align:center;padding:40px;color:#e8556d;'>${err.message}</p>`;
});

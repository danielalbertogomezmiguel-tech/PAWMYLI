if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

const DEFAULT_FOTO = "https://cdn-icons-png.flaticon.com/512/616/616408.png";
const pacienteId = localStorage.getItem("pacienteID");
let paciente = null;

if (!pacienteId) {
    window.location.href = "../pacientes/paciente.html";
}

function pintarSidebar() {
    const user = PawApi.getUser();
    const title = document.querySelector(".perfilDoctor h2");
    if (user && title) title.textContent = user.name;
}

function cargarPerfil() {
    if (!paciente) {
        document.querySelector(".perfilMascota").innerHTML =
            "<p style='text-align:center;padding:40px;font-size:24px;color:#999;'>Paciente no encontrado</p>";
        return;
    }

    document.getElementById("fotoPaciente").src = paciente.foto || DEFAULT_FOTO;
    document.getElementById("nombrePaciente").textContent = paciente.nombre;
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
    document.getElementById("barcodeImg").src =
        "https://barcode.tec-it.com/barcode.ashx?data=" +
        encodeURIComponent(paciente.codigo || "SIN-CODIGO") +
        "&code=Code128&dpi=96&imagetype=png";

    const listaAlim = document.getElementById("listaAlimentacion");
    listaAlim.innerHTML = "";
    if (paciente.alimentacion && paciente.alimentacion.length) {
        paciente.alimentacion.forEach((item) => {
            listaAlim.innerHTML += `<li>${item}</li>`;
        });
    } else {
        listaAlim.innerHTML = "<li>Sin información</li>";
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
            tabla.innerHTML += `
            <tr>
                <td>${item.fecha}</td>
                <td>${item.motivo}</td>
                <td>${item.veterinario}</td>
                <td><span class="estado ${clase}">${item.estado}</span></td>
            </tr>`;
        });
    } else {
        tabla.innerHTML = `<tr><td colspan="4">Sin historial médico</td></tr>`;
    }
}

async function refrescarPaciente() {
    const data = await PawApi.api.getPatient(pacienteId);
    paciente = PawApi.mapPatient(data);
    cargarPerfil();
}

document.querySelector(".volver").addEventListener("click", () => {
    window.location.href = "../pacientes/paciente.html";
});

const modal = document.getElementById("modalEditar");

document.querySelector(".editar").addEventListener("click", () => {
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

document.querySelector(".consulta").addEventListener("click", () => {
    document.getElementById("consultaFecha").value = new Date().toISOString().split("T")[0];
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
        reason: document.getElementById("consultaMotivo").value.trim(),
        vetName: document.getElementById("consultaVet").value.trim(),
        status: document.getElementById("consultaEstado").value,
    };

    try {
        await PawApi.api.addMedicalRecord(pacienteId, body);
        await refrescarPaciente();
        this.reset();
        modalConsulta.classList.remove("activo");
        alert("Consulta registrada correctamente.");
    } catch (err) {
        alert(err.message || "No se pudo registrar la consulta.");
    }
});

document.querySelector(".cerrar").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
});

pintarSidebar();
refrescarPaciente().catch((err) => {
    document.querySelector(".perfilMascota").innerHTML =
        `<p style='text-align:center;padding:40px;color:#e8556d;'>${err.message}</p>`;
});

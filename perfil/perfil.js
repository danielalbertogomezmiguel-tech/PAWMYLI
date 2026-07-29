const STORAGE_KEY = "pacientesData";

const datosBase = [
    {
        id: 1,
        codigo: "PAW-000001",
        nombre: "Horchata",
        especie: "Gato",
        raza: "Europeo",
        edad: "6 años",
        sexo: "Hembra",
        peso: "8 kg",
        color: "Blanco",
        microchip: "Sí",
        propietario: "Sofia Carmendia",
        telefono: "7777-7777",
        correo: "sofia@email.com",
        foto: "../img/horchata.jpg",
        alimentacion: [
            "Purina Pro Plan",
            "2 veces al día",
            "Agua fresca"
        ],
        historial: [
            { fecha: "10/05/2026", motivo: "Vacunación", veterinario: "Dr. Daniel", estado: "Finalizada" },
            { fecha: "15/06/2026", motivo: "Control General", veterinario: "Dr. Daniel", estado: "Finalizada" },
            { fecha: "22/07/2026", motivo: "Desparasitación", veterinario: "Dr. Daniel", estado: "En proceso" }
        ]
    },
    {
        id: 2,
        codigo: "PAW-000002",
        nombre: "Princesa",
        especie: "Perro",
        raza: "Chihuahua",
        edad: "8 años",
        sexo: "Hembra",
        peso: "4 kg",
        color: "Café",
        microchip: "No",
        propietario: "Leonardo Da Vinci",
        telefono: "7777-8888",
        correo: "leo@email.com",
        foto: "../img/princesa.jpg",
        alimentacion: [
            "Pedigree",
            "3 veces al día"
        ],
        historial: []
    }
];

function inicializarStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datosBase));
}

function obtenerPacientes() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
            inicializarStorage();
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        }
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            inicializarStorage();
            return JSON.parse(localStorage.getItem(STORAGE_KEY));
        }
        return parsed;
    } catch {
        inicializarStorage();
        return JSON.parse(localStorage.getItem(STORAGE_KEY));
    }
}

const pacientes = obtenerPacientes();

const idPaciente = Number(localStorage.getItem("pacienteID")) || 1;

let paciente = pacientes.find(p => p.id === idPaciente);

function guardarStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pacientes));
}

function cargarPerfil() {
    if (!paciente) {
        document.querySelector(".perfilMascota").innerHTML = "<p style='text-align:center;padding:40px;font-size:24px;color:#999;'>Paciente no encontrado</p>";
        return;
    }

    document.getElementById("fotoPaciente").src = paciente.foto || "https://cdn-icons-png.flaticon.com/512/616/616408.png";
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
    document.getElementById("barcodeImg").src = "https://barcode.tec-it.com/barcode.ashx?data=" + (paciente.codigo || "SIN-CODIGO") + "&code=Code128&dpi=96&imagetype=png";

    const listaAlim = document.getElementById("listaAlimentacion");
    listaAlim.innerHTML = "";
    if (paciente.alimentacion && paciente.alimentacion.length) {
        paciente.alimentacion.forEach(item => {
            listaAlim.innerHTML += `<li>${item}</li>`;
        });
    } else {
        listaAlim.innerHTML = "<li>Sin información</li>";
    }

    const tabla = document.getElementById("historial");
    tabla.innerHTML = "";
    if (paciente.historial) {
        paciente.historial.forEach(item => {
            let clase = "";
            switch (item.estado) {
                case "Finalizada": clase = "finalizada"; break;
                case "En proceso": clase = "proceso"; break;
                default: clase = "cancelada";
            }
            tabla.innerHTML += `
            <tr>
                <td>${item.fecha}</td>
                <td>${item.motivo}</td>
                <td>${item.veterinario}</td>
                <td><span class="estado ${clase}">${item.estado}</span></td>
            </tr>`;
        });
    }
}

cargarPerfil();

document.querySelector(".volver").addEventListener("click", () => {
    history.back();
});

const modal = document.getElementById("modalEditar");

document.querySelector(".editar").addEventListener("click", () => {
    document.getElementById("editNombre").value = paciente.nombre;
    document.getElementById("editEspecie").value = paciente.especie;
    document.getElementById("editRaza").value = paciente.raza;
    document.getElementById("editEdad").value = paciente.edad ? paciente.edad.replace(" años", "") : "";
    document.getElementById("editSexo").value = paciente.sexo;
    document.getElementById("editPeso").value = paciente.peso ? paciente.peso.replace(" kg", "") : "";
    document.getElementById("editColor").value = paciente.color || "";
    document.getElementById("editMicrochip").value = paciente.microchip || "No";
    document.getElementById("editPropietario").value = paciente.propietario;
    modal.classList.add("activo");
});

document.querySelector(".cerrarModal").addEventListener("click", () => {
    modal.classList.remove("activo");
});

window.addEventListener("click", e => {
    if (e.target === modal) {
        modal.classList.remove("activo");
    }
});

document.getElementById("formEditar").addEventListener("submit", function (e) {
    e.preventDefault();
    paciente.nombre = document.getElementById("editNombre").value;
    paciente.especie = document.getElementById("editEspecie").value;
    paciente.raza = document.getElementById("editRaza").value;
    paciente.edad = document.getElementById("editEdad").value + " años";
    paciente.sexo = document.getElementById("editSexo").value;
    paciente.peso = document.getElementById("editPeso").value + " kg";
    paciente.color = document.getElementById("editColor").value;
    paciente.microchip = document.getElementById("editMicrochip").value;
    paciente.propietario = document.getElementById("editPropietario").value;
    guardarStorage();
    cargarPerfil();
    modal.classList.remove("activo");
    alert("Paciente actualizado correctamente.");
});

// ─── NUEVA CONSULTA ───

const modalConsulta = document.getElementById("modalConsulta");

document.querySelector(".consulta").addEventListener("click", () => {
    document.getElementById("consultaFecha").value = new Date().toISOString().split("T")[0];
    modalConsulta.classList.add("activo");
});

document.querySelector(".cerrarModalConsulta").addEventListener("click", () => {
    modalConsulta.classList.remove("activo");
});

window.addEventListener("click", e => {
    if (e.target === modalConsulta) {
        modalConsulta.classList.remove("activo");
    }
});

document.getElementById("formConsulta").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!paciente.historial) paciente.historial = [];
    paciente.historial.push({
        fecha: document.getElementById("consultaFecha").value,
        motivo: document.getElementById("consultaMotivo").value,
        veterinario: document.getElementById("consultaVet").value,
        estado: document.getElementById("consultaEstado").value
    });
    guardarStorage();
    cargarPerfil();
    this.reset();
    modalConsulta.classList.remove("activo");
    alert("Consulta registrada correctamente.");
});

document.querySelector(".cerrar").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) {
        window.location.href = "../auth/login.html";
    }
});
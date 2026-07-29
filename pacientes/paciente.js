function generarCodigo() {
    return "PAW-" + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-6);
}

const datosBase = [
    {
        id: 1,
        codigo: "PAW-000001",
        nombre: "Horchata",
        especie: "Gato",
        raza: "Europeo",
        edad: "6 años",
        sexo: "Hembra",
        propietario: "Sofia Carmendia",
        foto: "../img/horchata.jpg",
        peso: "",
        color: "",
        microchip: "No"
    },
    {
        id: 2,
        codigo: "PAW-000002",
        nombre: "Princesa",
        especie: "Perro",
        raza: "Chihuahua",
        edad: "8 años",
        sexo: "Hembra",
        propietario: "Leonardo Da Vinci",
        foto: "../img/princesa.jpg",
        peso: "",
        color: "",
        microchip: "Sí"
    },
    {
        id: 3,
        codigo: "PAW-000003",
        nombre: "Milo",
        especie: "Perro",
        raza: "Golden Retriever",
        edad: "3 años",
        sexo: "Macho",
        propietario: "Carlos Méndez",
        foto: "../img/milo.jpg",
        peso: "",
        color: "",
        microchip: "No"
    }
];

function inicializarStorage() {
    localStorage.setItem("pacientesData", JSON.stringify(datosBase));
}

function obtenerPacientes() {
    try {
        const data = localStorage.getItem("pacientesData");
        if (!data) {
            inicializarStorage();
            return JSON.parse(localStorage.getItem("pacientesData"));
        }
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            inicializarStorage();
            return JSON.parse(localStorage.getItem("pacientesData"));
        }
        return parsed;
    } catch {
        inicializarStorage();
        return JSON.parse(localStorage.getItem("pacientesData"));
    }
}

const pacientes = obtenerPacientes();

function guardarStorage() {
    localStorage.setItem("pacientesData", JSON.stringify(pacientes));
}

const contenedor = document.getElementById("contenedorPacientes");
const buscar = document.getElementById("buscar");
const modal = document.getElementById("modal");
const btnNuevo = document.getElementById("nuevoPaciente");
const cerrarModal = document.querySelector(".cerrarModal");
const formulario = document.getElementById("formMascota");

function mostrarPacientes(lista) {
    contenedor.innerHTML = "";
    lista.forEach(paciente => {
        contenedor.innerHTML += `
        <div class="tarjeta">
            <img
                class="foto"
                src="${paciente.foto}"
                onerror="this.src='https://cdn-icons-png.flaticon.com/512/616/616408.png'">
            <div class="info">
                <h2>${paciente.nombre}</h2>
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
            <button
                class="expediente"
                onclick="abrirPerfil(${paciente.id})">
                <i class="fa-solid fa-file-medical"></i>
            </button>
        </div>
        `;
    });
}

mostrarPacientes(pacientes);

buscar.addEventListener("keyup", () => {
    const texto = buscar.value.toLowerCase();
    const resultado = pacientes.filter(p =>
        p.nombre.toLowerCase().includes(texto) ||
        p.propietario.toLowerCase().includes(texto) ||
        p.especie.toLowerCase().includes(texto) ||
        p.raza.toLowerCase().includes(texto)
    );
    mostrarPacientes(resultado);
});

btnNuevo.addEventListener("click", () => {
    modal.classList.add("activo");
});

cerrarModal.addEventListener("click", () => {
    modal.classList.remove("activo");
});

window.addEventListener("click", e => {
    if (e.target === modal) {
        modal.classList.remove("activo");
    }
});

formulario.addEventListener("submit", function (e) {
    e.preventDefault();
    const nuevo = {
        id: pacientes.length + 1,
        codigo: generarCodigo(),
        nombre: document.getElementById("nombre").value,
        especie: document.getElementById("especie").value,
        raza: document.getElementById("raza").value,
        edad: document.getElementById("edad").value + " años",
        sexo: document.getElementById("sexo").value,
        propietario: document.getElementById("propietario").value,
        peso: document.getElementById("peso").value + " kg",
        color: document.getElementById("color").value,
        microchip: document.getElementById("microchip").value,
        telefono: "",
        correo: "",
        foto: "https://cdn-icons-png.flaticon.com/512/616/616408.png",
        alimentacion: [],
        historial: []
    };
    pacientes.push(nuevo);
    guardarStorage();
    mostrarPacientes(pacientes);
    formulario.reset();
    modal.classList.remove("activo");
    alert("Paciente registrado correctamente.");
});

function abrirPerfil(id) {
    localStorage.setItem("pacienteID", id);
    window.location.href = "../perfil/perfil.html";
}

document.querySelector(".cerrar").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) {
        window.location.href = "../auth/login.html";
    }
});
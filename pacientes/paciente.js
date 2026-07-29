if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

const DEFAULT_FOTO = "https://cdn-icons-png.flaticon.com/512/616/616408.png";
let pacientes = [];

const contenedor = document.getElementById("contenedorPacientes");
const buscar = document.getElementById("buscar");
const modal = document.getElementById("modal");
const btnNuevo = document.getElementById("nuevoPaciente");
const cerrarModal = document.querySelector(".cerrarModal");
const formulario = document.getElementById("formMascota");

function pintarSidebar() {
    const user = PawApi.getUser();
    const title = document.querySelector(".perfil h2, .perfilDoctor h2");
    if (user && title) title.textContent = user.name;
}

function mostrarPacientes(lista) {
    contenedor.innerHTML = "";
    if (!lista.length) {
        contenedor.innerHTML = "<p style='padding:20px;color:#8a9aa8;'>No hay pacientes registrados.</p>";
        return;
    }

    lista.forEach((paciente) => {
        contenedor.innerHTML += `
        <div class="tarjeta">
            <img
                class="foto"
                src="${paciente.foto || DEFAULT_FOTO}"
                onerror="this.src='${DEFAULT_FOTO}'">
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
    const result = await PawApi.api.listPatients({ search, limit: 100 });
    pacientes = (result.data || []).map(PawApi.mapPatient);
    mostrarPacientes(pacientes);
}

function abrirPerfil(id) {
    localStorage.setItem("pacienteID", id);
    window.location.href = "../perfil/perfil.html";
}

btnNuevo.addEventListener("click", () => modal.classList.add("activo"));
cerrarModal.addEventListener("click", () => modal.classList.remove("activo"));
window.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("activo");
});

let searchTimer;
buscar.addEventListener("keyup", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            await cargarPacientes(buscar.value.trim());
        } catch (err) {
            alert(err.message);
        }
    }, 300);
});

formulario.addEventListener("submit", async function (e) {
    e.preventDefault();
    const edadVal = document.getElementById("edad").value;
    const pesoVal = document.getElementById("peso").value.trim();

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
        alert("Completa los campos obligatorios.");
        return;
    }

    try {
        await PawApi.api.createPatient(body);
        formulario.reset();
        modal.classList.remove("activo");
        await cargarPacientes(buscar.value.trim());
        alert("Paciente registrado correctamente.");
    } catch (err) {
        alert(err.message || "No se pudo registrar el paciente.");
    }
});

document.querySelector(".cerrar").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
});

pintarSidebar();
cargarPacientes().catch((err) => {
    contenedor.innerHTML = `<p style="padding:20px;color:#e8556d;">${err.message}</p>`;
});

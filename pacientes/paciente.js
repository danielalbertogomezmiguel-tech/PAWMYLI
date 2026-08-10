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

const contenedor = document.getElementById("contenedorPacientes");
const buscar = document.getElementById("buscar");
const modal = document.getElementById("modal");
const modalExito = document.getElementById("modalExito");
const btnNuevo = document.getElementById("nuevoPaciente");
const btnVincular = document.getElementById("vincularCodigo");
const cerrarModal = document.querySelector(".cerrarModal");
const formulario = document.getElementById("formMascota");

function pintarSidebar() {
    PawApi.applySidebar();
}

function configurarRol() {
    if (isOwner) {
        btnNuevo.style.display = "none";
        btnVincular.style.display = "inline-flex";
    } else {
        btnNuevo.style.display = "inline-flex";
        btnVincular.style.display = "none";
    }
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
    const result = isOwner
        ? await PawApi.api.myPatients({ limit: 100 })
        : await PawApi.api.listPatients({ search, limit: 100 });
    pacientes = (result.data || []).map(PawApi.mapPatient);
    const filtro = (search || "").toLowerCase();
    const lista = isOwner && filtro
        ? pacientes.filter(
              (p) =>
                  p.nombre.toLowerCase().includes(filtro) ||
                  (p.codigo || "").toLowerCase().includes(filtro)
          )
        : pacientes;
    mostrarPacientes(lista);
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

btnVincular.addEventListener("click", async () => {
    const code = prompt("Ingresa el código de la mascota (PAW-XXXXXX):");
    if (!code) return;
    try {
        const patient = await PawApi.api.linkPatient(code.trim());
        alert("Mascota vinculada: " + patient.name + " (" + patient.code + ")");
        await cargarPacientes(buscar.value.trim());
    } catch (err) {
        alert(err.message || "No se pudo vincular.");
    }
});

async function resolverCodigo(code) {
    const value = (code || "").trim();
    if (!value) return;
    try {
        if (isOwner) {
            const patient = await PawApi.api.linkPatient(value);
            abrirPerfil(patient.id);
            return;
        }
        const patient = await PawApi.api.get("/patients/code/" + encodeURIComponent(value));
        abrirPerfil(patient.id);
    } catch (err) {
        alert(err.message || "Paciente no encontrado.");
    }
}

document.querySelector(".qr")?.addEventListener("click", async () => {
    const code = prompt("Ingresa o escanea el código (PAW-XXXXXX):");
    await resolverCodigo(code);
});

if (window.PawBarcodeHid) {
    PawBarcodeHid.attach((code) => resolverCodigo(code));
}

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

function readFotoAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
    });
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
        alert("Completa los campos obligatorios.");
        return;
    }

    try {
        if (file) {
            if (file.size > 1.5 * 1024 * 1024) {
                alert("La foto debe pesar menos de 1.5 MB.");
                return;
            }
            body.photo = await readFotoAsDataUrl(file);
        }
        const created = await PawApi.api.createPatient(body);
        formulario.reset();
        modal.classList.remove("activo");
        await cargarPacientes(buscar.value.trim());
        mostrarExito(created);
    } catch (err) {
        alert(err.message || "No se pudo registrar el paciente.");
    }
});

document.querySelector(".cerrar").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
});

pintarSidebar();
PawApi.syncProfileToSession().then(() => pintarSidebar()).catch(() => {});
configurarRol();
cargarPacientes().catch((err) => {
    contenedor.innerHTML = `<p style="padding:20px;color:#e8556d;">${err.message}</p>`;
});

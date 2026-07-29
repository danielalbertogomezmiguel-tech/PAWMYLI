const CONFIG_KEY = "configuracionClinica";

const datosBase = {
    perfil: {
        nombre: "Dr. Daniel Ozuna",
        correo: "daniel@clinica.com",
        telefono: "8888-8888",
        licencia: "VET-12345",
        password: ""
    },
    clinica: {
        nombre: "Clínica Pawmyli",
        direccion: "Av. Principal #123",
        telefono: "2222-2222",
        correo: "info@pawmyli.com",
        horario: "Lun-Vie 8:00-18:00",
        mapa: ""
    },
    preferencias: {
        idioma: "Español",
        zona: "GMT-6",
        fecha: "DD/MM/AAAA",
        tema: "Claro",
        notificaciones: true,
        sonidos: false
    }
};

function cargarConfig() {
    try {
        const data = localStorage.getItem(CONFIG_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch {
        return null;
    }
}

function guardarConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

const config = cargarConfig() || datosBase;

if (!localStorage.getItem(CONFIG_KEY)) {
    guardarConfig(config);
}

function cargarFormularios() {
    document.getElementById("nombre").value = config.perfil.nombre || "";
    document.getElementById("correo").value = config.perfil.correo || "";
    document.getElementById("telefono").value = config.perfil.telefono || "";
    document.getElementById("licencia").value = config.perfil.licencia || "";

    document.getElementById("clinica").value = config.clinica.nombre || "";
    document.getElementById("direccion").value = config.clinica.direccion || "";
    document.getElementById("telefonoClinica").value = config.clinica.telefono || "";
    document.getElementById("correoClinica").value = config.clinica.correo || "";
    document.getElementById("horario").value = config.clinica.horario || "";
    document.getElementById("mapa").value = config.clinica.mapa || "";

    document.getElementById("idioma").value = config.preferencias.idioma || "Español";
    document.getElementById("zona").value = config.preferencias.zona || "GMT-6";
    document.getElementById("fecha").value = config.preferencias.fecha || "DD/MM/AAAA";
    document.getElementById("tema").value = config.preferencias.tema || "Claro";
    document.getElementById("notificaciones").checked = config.preferencias.notificaciones || false;
    document.getElementById("sonidos").checked = config.preferencias.sonidos || false;
}

cargarFormularios();

document.getElementById("guardarPerfil").addEventListener("click", () => {
    config.perfil.nombre = document.getElementById("nombre").value;
    config.perfil.correo = document.getElementById("correo").value;
    config.perfil.telefono = document.getElementById("telefono").value;
    config.perfil.licencia = document.getElementById("licencia").value;
    const pw = document.getElementById("password").value;
    if (pw) config.perfil.password = pw;
    guardarConfig(config);
    alert("Perfil guardado correctamente.");
});

document.getElementById("guardarClinica").addEventListener("click", () => {
    config.clinica.nombre = document.getElementById("clinica").value;
    config.clinica.direccion = document.getElementById("direccion").value;
    config.clinica.telefono = document.getElementById("telefonoClinica").value;
    config.clinica.correo = document.getElementById("correoClinica").value;
    config.clinica.horario = document.getElementById("horario").value;
    config.clinica.mapa = document.getElementById("mapa").value;
    guardarConfig(config);
    alert("Clínica guardada correctamente.");
});

document.getElementById("guardarPrefs").addEventListener("click", () => {
    config.preferencias.idioma = document.getElementById("idioma").value;
    config.preferencias.zona = document.getElementById("zona").value;
    config.preferencias.fecha = document.getElementById("fecha").value;
    config.preferencias.tema = document.getElementById("tema").value;
    config.preferencias.notificaciones = document.getElementById("notificaciones").checked;
    config.preferencias.sonidos = document.getElementById("sonidos").checked;
    guardarConfig(config);
    alert("Preferencias guardadas correctamente.");
});

document.getElementById("foto").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (ev) {
            document.getElementById("fotoUsuario").src = ev.target.result;
            config.perfil.foto = ev.target.result;
            guardarConfig(config);
        };
        reader.readAsDataURL(file);
    }
});

document.querySelector(".cerrar").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) {
        window.location.href = "../auth/login.html";
    }
});
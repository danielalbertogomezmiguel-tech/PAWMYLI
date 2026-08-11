if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

let profile = null;
let clinicConfig = null;

function pintarSidebar() {
    const u = profile || PawApi.getUser();
    PawApi.applySidebar(u);
    if (u?.photo) {
        const img = document.getElementById("fotoUsuario");
        if (img) img.src = u.photo;
    }
}

function cargarFormularios() {
    if (profile) {
        document.getElementById("nombre").value = profile.name || "";
        document.getElementById("correo").value = profile.email || "";
        document.getElementById("telefono").value = profile.phone || "";
        document.getElementById("licencia").value = profile.license || "";
        if (profile.photo) document.getElementById("fotoUsuario").src = profile.photo;
    }

    if (clinicConfig) {
        document.getElementById("clinica").value = clinicConfig.clinicName || profile?.clinic || "";
        document.getElementById("direccion").value = clinicConfig.clinicAddress || profile?.address || "";
        document.getElementById("telefonoClinica").value = clinicConfig.clinicPhone || "";
        document.getElementById("correoClinica").value = clinicConfig.clinicEmail || "";
        document.getElementById("horario").value = clinicConfig.clinicHours || "";
        document.getElementById("mapa").value = clinicConfig.mapUrl || "";
        document.getElementById("idioma").value = clinicConfig.language || "Español";
        document.getElementById("zona").value = clinicConfig.timezone || "GMT-6";
        document.getElementById("fecha").value = clinicConfig.dateFormat || "DD/MM/AAAA";
        document.getElementById("tema").value = clinicConfig.theme || "Claro";
        document.getElementById("notificaciones").checked = !!clinicConfig.notifications;
        document.getElementById("sonidos").checked = !!clinicConfig.sounds;
    }
}

async function cargarTodo() {
    profile = await PawApi.api.profile();
    clinicConfig = await PawApi.api.getConfig();
    localStorage.setItem("usuarioActivo", JSON.stringify(profile));
    pintarSidebar();
    cargarFormularios();
}

document.getElementById("guardarPerfil").addEventListener("click", async () => {
    const body = {
        name: document.getElementById("nombre").value.trim(),
        phone: document.getElementById("telefono").value.trim() || undefined,
        license: document.getElementById("licencia").value.trim() || undefined,
        clinic: document.getElementById("clinica").value.trim() || undefined,
        address: document.getElementById("direccion").value.trim() || undefined,
    };
    const pw = document.getElementById("password").value;
    if (pw) body.password = pw;
    if (profile?.photo) body.photo = profile.photo;

    try {
        profile = await PawApi.api.updateProfile(body);
        localStorage.setItem("usuarioActivo", JSON.stringify(profile));
        document.getElementById("password").value = "";
        pintarSidebar();
        alert("Perfil guardado correctamente.");
    } catch (err) {
        alert(err.message || "No se pudo guardar el perfil.");
    }
});

document.getElementById("guardarClinica").addEventListener("click", async () => {
    const body = {
        clinicName: document.getElementById("clinica").value.trim() || undefined,
        clinicAddress: document.getElementById("direccion").value.trim() || undefined,
        clinicPhone: document.getElementById("telefonoClinica").value.trim() || undefined,
        clinicEmail: document.getElementById("correoClinica").value.trim() || undefined,
        clinicHours: document.getElementById("horario").value.trim() || undefined,
        mapUrl: document.getElementById("mapa").value.trim() || undefined,
    };

    try {
        clinicConfig = await PawApi.api.updateConfig(body);
        await PawApi.api.updateProfile({
            clinic: body.clinicName,
            address: body.clinicAddress,
        });
        alert("Clínica guardada correctamente.");
    } catch (err) {
        alert(err.message || "No se pudo guardar la clínica.");
    }
});

document.getElementById("guardarPrefs").addEventListener("click", async () => {
    const body = {
        language: document.getElementById("idioma").value,
        timezone: document.getElementById("zona").value,
        dateFormat: document.getElementById("fecha").value,
        theme: document.getElementById("tema").value,
        notifications: document.getElementById("notificaciones").checked,
        sounds: document.getElementById("sonidos").checked,
    };

    try {
        clinicConfig = await PawApi.api.updateConfig(body);
        alert("Preferencias guardadas correctamente.");
    } catch (err) {
        alert(err.message || "No se pudieron guardar las preferencias.");
    }
});

document.getElementById("foto").addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (ev) {
        try {
            profile = await PawApi.api.updateProfile({ photo: ev.target.result });
            document.getElementById("fotoUsuario").src = profile.photo;
            localStorage.setItem("usuarioActivo", JSON.stringify(profile));
        } catch (err) {
            alert(err.message || "No se pudo subir la foto.");
        }
    };
    reader.readAsDataURL(file);
});

document.getElementById("cerrarSesionPerfil").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
});

pintarSidebar();
cargarTodo().catch((err) => alert(err.message || "No se pudo cargar la configuración."));

if (!PawApi.requireAuth()) {
    throw new Error("Auth required");
}

let profile = null;
let clinicConfig = null;

function toast(type, title, message) {
    if (window.PawToast) {
        PawToast.show({ type, title, message });
    }
}

function friendlyError(err) {
    const raw = (err && err.message) || "";
    if (!raw || /internal|prisma|stack|ECONN|fetch/i.test(raw)) {
        return "No pudimos completar la operación. Inténtalo nuevamente.";
    }
    return raw;
}

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
        toast("success", "Perfil guardado correctamente");
    } catch (err) {
        toast("error", "No se pudo guardar el perfil", friendlyError(err));
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
        toast("success", "Clínica guardada correctamente");
    } catch (err) {
        toast("error", "No se pudo guardar la clínica", friendlyError(err));
    }
});

document.getElementById("guardarPrefs").addEventListener("click", async () => {
    const body = {
        language: document.getElementById("idioma").value,
        timezone: document.getElementById("zona").value,
        dateFormat: document.getElementById("fecha").value,
        notifications: document.getElementById("notificaciones").checked,
        sounds: document.getElementById("sonidos").checked,
    };

    try {
        clinicConfig = await PawApi.api.updateConfig(body);
        toast("success", "Preferencias guardadas correctamente");
    } catch (err) {
        toast("error", "No se pudieron guardar las preferencias", friendlyError(err));
    }
});

document.getElementById("foto").addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const applyPhoto = (nextProfile, url) => {
        if (nextProfile) profile = nextProfile;
        const src = url || (profile && profile.photo);
        if (src) {
            document.getElementById("fotoUsuario").src = src;
            if (profile) profile.photo = src;
        }
        if (profile) localStorage.setItem("usuarioActivo", JSON.stringify(profile));
        pintarSidebar();
    };

    // Prefer signed media upload; fall back to dataURL profile update.
    if (PawApi.api.uploadUserAvatar) {
        try {
            const result = await PawApi.api.uploadUserAvatar(file);
            applyPhoto(result.profile, result.url);
            toast("success", "Foto actualizada");
            return;
        } catch (_) {
            /* fall through */
        }
    }

    const reader = new FileReader();
    reader.onload = async function (ev) {
        try {
            profile = await PawApi.api.updateProfile({ photo: ev.target.result });
            applyPhoto(profile, profile.photo);
            toast("success", "Foto actualizada");
        } catch (err) {
            toast("error", "No se pudo subir la foto", friendlyError(err));
        }
    };
    reader.readAsDataURL(file);
});

document.getElementById("cerrarSesionPerfil").addEventListener("click", () => {
    if (confirm("¿Desea cerrar sesión?")) PawApi.logout();
});

pintarSidebar();
cargarTodo().catch((err) => {
    toast("error", "No se pudo cargar la configuración", friendlyError(err));
});

// ===============================
// MOSTRAR / OCULTAR CONTRASEÑA
// ===============================

document.querySelectorAll(".togglePassword").forEach((btn) => {
    btn.addEventListener("click", () => {
        const input = btn.parentElement.querySelector("input");
        const icon = btn.querySelector("i");
        if (input.type === "password") {
            input.type = "text";
            icon.classList.replace("fa-eye", "fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.replace("fa-eye-slash", "fa-eye");
        }
    });
});

const mostrar = document.getElementById("mostrarPassword");
if (mostrar) {
    mostrar.addEventListener("click", () => {
        const input = document.getElementById("password");
        const icon = mostrar.querySelector("i");
        if (input.type === "password") {
            input.type = "text";
            icon.classList.replace("fa-eye", "fa-eye-slash");
        } else {
            input.type = "password";
            icon.classList.replace("fa-eye-slash", "fa-eye");
        }
    });
}

// ===============================
// REGISTRO
// ===============================

const registroForm = document.getElementById("registroForm");
if (registroForm) {
    registroForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nombre = document.getElementById("nombre").value.trim();
        const correo = document.getElementById("correo").value.trim();
        const password = document.getElementById("password").value;
        const confirmar = document.getElementById("confirmar").value;
        const clinica = document.getElementById("clinica").value.trim();
        const direccion = document.getElementById("direccion").value.trim();
        const licencia = document.getElementById("licencia").value.trim();

        if (password !== confirmar) {
            PawToast.error("Registro", "Las contraseñas no coinciden.");
            return;
        }

        if (password.length < 6) {
            PawToast.error("Registro", "La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            let licensePhoto;
            const docInput = document.getElementById("documento");
            const file = docInput && docInput.files && docInput.files[0];
            if (file) {
                if (file.size > 2_500_000) {
                    PawToast.error("Registro", "El archivo de licencia es demasiado grande (máx. ~2.5 MB).");
                    return;
                }
                if (!/^image\//i.test(file.type) && file.type !== "application/pdf") {
                    PawToast.error("Registro", "Adjunta una imagen o PDF de la licencia.");
                    return;
                }
                licensePhoto = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ""));
                    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
                    reader.readAsDataURL(file);
                });
            }

            const result = await PawApi.api.register({
                name: nombre,
                email: correo,
                password,
                role: "vet",
                clinic: clinica,
                address: direccion,
                license: licencia,
                photo: licensePhoto,
            });
            PawApi.setSession(result.accessToken, result.user, result.refreshToken, { remember: true });
            PawToast.queue({
                type: "success",
                title: "Bienvenido",
                message: result.user.name,
            });
            window.location.href = "../dashboard/index.html";
        } catch (err) {
            PawToast.error("Registro", err.message || "No se pudo registrar.");
        }
    });
}

// ===============================
// LOGIN
// ===============================

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    // Stale token used to bounce login ↔ dashboard until Chromium crashed
    // (STATUS_ACCESS_VIOLATION). Only enter the app if the session is still valid.
    (async function resumeIfSessionValid() {
        const token = PawApi.getToken();
        const user = PawApi.getUser();
        if (!token || !user) return;
        try {
            await PawApi.api.profile();
            window.location.replace("../dashboard/index.html");
        } catch (_) {
            PawApi.clearSession();
        }
    })();

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const correo = document.getElementById("correo").value.trim();
        const password = document.getElementById("password").value;
        const btn = loginForm.querySelector("button[type='submit']");
        if (btn) btn.disabled = true;

        try {
            const result = await PawApi.api.login({ email: correo, password });
            const remember = Boolean(document.getElementById("recordar")?.checked);
            PawApi.setSession(result.accessToken, result.user, result.refreshToken, { remember });

            PawToast.queue({
                type: "success",
                title: "Bienvenido",
                message: result.user.name,
            });
            window.location.replace("../dashboard/index.html");
        } catch (err) {
            PawToast.error("Inicio de sesión", err.message || "Correo o contraseña incorrectos.");
            if (btn) btn.disabled = false;
        }
    });
}

function cerrarSesion() {
    PawApi.logout();
}

if (window.PawToast && PawToast.consume) PawToast.consume();

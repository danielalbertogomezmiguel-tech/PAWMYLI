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
            alert("Las contraseñas no coinciden.");
            return;
        }

        if (password.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres.");
            return;
        }

        try {
            const result = await PawApi.api.register({
                name: nombre,
                email: correo,
                password,
                role: "vet",
                clinic: clinica,
                address: direccion,
                license: licencia,
            });
            PawApi.setSession(result.accessToken, result.user);
            alert("Registro exitoso. Bienvenido " + result.user.name);
            window.location.href = "../dashboard/index.html";
        } catch (err) {
            alert(err.message || "No se pudo registrar.");
        }
    });
}

// ===============================
// LOGIN
// ===============================

const loginForm = document.getElementById("loginForm");
if (loginForm) {
    if (PawApi.getToken() && PawApi.getUser()) {
        window.location.href = "../dashboard/index.html";
    }

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const correo = document.getElementById("correo").value.trim();
        const password = document.getElementById("password").value;

        try {
            const result = await PawApi.api.login({ email: correo, password });
            PawApi.setSession(result.accessToken, result.user);

            if (document.getElementById("recordar")?.checked) {
                localStorage.setItem("recordarSesion", "true");
            } else {
                localStorage.removeItem("recordarSesion");
            }

            alert("Bienvenido " + result.user.name);
            window.location.href = "../dashboard/index.html";
        } catch (err) {
            alert(err.message || "Correo o contraseña incorrectos.");
        }
    });
}

function cerrarSesion() {
    PawApi.logout();
}

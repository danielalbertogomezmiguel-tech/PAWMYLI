// ===============================
// MOSTRAR / OCULTAR CONTRASEÑA
// ===============================

document.querySelectorAll(".togglePassword").forEach(btn => {

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

// Botón del login

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

    registroForm.addEventListener("submit", function(e){

        e.preventDefault();

        const nombre = document.getElementById("nombre").value.trim();
        const correo = document.getElementById("correo").value.trim();
        const password = document.getElementById("password").value;
        const confirmar = document.getElementById("confirmar").value;
        const clinica = document.getElementById("clinica").value.trim();
        const direccion = document.getElementById("direccion").value.trim();
        const licencia = document.getElementById("licencia").value.trim();

        if(password !== confirmar){

            alert("Las contraseñas no coinciden.");
            return;

        }

        let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

        const existe = usuarios.find(user => user.correo === correo);

        if(existe){

            alert("Este correo ya está registrado.");
            return;

        }

        usuarios.push({

            nombre,
            correo,
            password,
            clinica,
            direccion,
            licencia

        });

        localStorage.setItem("usuarios", JSON.stringify(usuarios));

        alert("Registro exitoso.");

        window.location.href = "login.html";

    });

}

// ===============================
// LOGIN
// ===============================

const loginForm = document.getElementById("loginForm");

if(loginForm){

    loginForm.addEventListener("submit", function(e){

        e.preventDefault();

        const correo = document.getElementById("correo").value.trim();

        const password = document.getElementById("password").value;

        let usuarios = JSON.parse(localStorage.getItem("usuarios")) || [];

        const usuario = usuarios.find(user =>

            user.correo === correo &&
            user.password === password

        );

        if(!usuario){

            alert("Correo o contraseña incorrectos.");

            return;

        }

        // Guardar sesión

        localStorage.setItem("usuarioActivo", JSON.stringify(usuario));

        // Recordar sesión

        if(document.getElementById("recordar")?.checked){

            localStorage.setItem("recordarSesion","true");

        }else{

            localStorage.removeItem("recordarSesion");

        }

        alert("Bienvenido " + usuario.nombre);

        window.location.href="../dashboard/index.html";

    });

}

// ===============================
// CERRAR SESIÓN
// ===============================

function cerrarSesion(){

    localStorage.removeItem("usuarioActivo");

    window.location.href="../auth/login.html";

}
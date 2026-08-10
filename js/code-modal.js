(function (global) {
    const MODAL_ID = "pawModalCodigo";

    function ensureModal() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;

        modal = document.createElement("div");
        modal.className = "modal";
        modal.id = MODAL_ID;
        modal.innerHTML =
            '<div class="ventana ventana-codigo" role="dialog" aria-modal="true" aria-labelledby="pawModalCodigoTitle">' +
            '<button type="button" class="cerrarModal" data-paw-code-cancel aria-label="Cerrar">' +
            '<i class="fa-solid fa-xmark"></i>' +
            "</button>" +
            '<h2 id="pawModalCodigoTitle">Ingresar código</h2>' +
            '<p class="hint-codigo" data-paw-code-hint></p>' +
            '<label for="pawInputCodigo">Código PAW</label>' +
            '<input type="text" id="pawInputCodigo" autocomplete="off" spellcheck="false" ' +
            'placeholder="PAW-000001" inputmode="text">' +
            '<div class="modal-acciones">' +
            '<button type="button" class="btn-secundario" data-paw-code-cancel>Cancelar</button>' +
            '<button type="button" class="guardar" data-paw-code-confirm>Continuar</button>' +
            "</div>" +
            "</div>";
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Custom code entry modal (replaces window.prompt).
     * @returns {Promise<string|null>} trimmed code, or null if cancelled
     */
    function askCode(options) {
        const opts = options || {};
        const modal = ensureModal();
        const titleEl = modal.querySelector("#pawModalCodigoTitle");
        const hintEl = modal.querySelector("[data-paw-code-hint]");
        const input = modal.querySelector("#pawInputCodigo");
        const confirmBtn = modal.querySelector("[data-paw-code-confirm]");
        const cancelBtns = modal.querySelectorAll("[data-paw-code-cancel]");

        titleEl.textContent = opts.title || "Ingresar código";
        hintEl.textContent =
            opts.message ||
            "Escribe o escanea el código de la mascota (PAW-XXXXXX).";
        input.value = opts.initialValue || "";

        return new Promise((resolve) => {
            let settled = false;

            function finish(value) {
                if (settled) return;
                settled = true;
                modal.classList.remove("activo");
                document.removeEventListener("keydown", onKey);
                modal.removeEventListener("click", onBackdrop);
                confirmBtn.removeEventListener("click", onConfirm);
                cancelBtns.forEach((btn) => btn.removeEventListener("click", onCancel));
                resolve(value);
            }

            function onConfirm() {
                const code = (input.value || "").trim();
                if (!code) {
                    input.focus();
                    input.style.borderColor = "#e8556d";
                    return;
                }
                input.style.borderColor = "";
                finish(code);
            }

            function onCancel() {
                finish(null);
            }

            function onBackdrop(e) {
                if (e.target === modal) onCancel();
            }

            function onKey(e) {
                if (e.key === "Escape") onCancel();
                if (e.key === "Enter" && document.activeElement === input) {
                    e.preventDefault();
                    onConfirm();
                }
            }

            confirmBtn.addEventListener("click", onConfirm);
            cancelBtns.forEach((btn) => btn.addEventListener("click", onCancel));
            modal.addEventListener("click", onBackdrop);
            document.addEventListener("keydown", onKey);

            modal.classList.add("activo");
            setTimeout(() => {
                input.focus();
                input.select();
            }, 30);
        });
    }

    global.PawCodeModal = { ask: askCode };
})(window);

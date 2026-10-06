(function (global) {
    const MODAL_ID = "pawUiDialog";

    function ensureModal() {
        let modal = document.getElementById(MODAL_ID);
        if (modal) return modal;

        modal = document.createElement("div");
        modal.className = "modal";
        modal.id = MODAL_ID;
        modal.innerHTML =
            '<div class="ventana ventana-codigo" role="dialog" aria-modal="true" aria-labelledby="pawUiDialogTitle">' +
            '<button type="button" class="cerrarModal" data-paw-ui-cancel aria-label="Cerrar">' +
            '<i class="fa-solid fa-xmark"></i>' +
            "</button>" +
            '<h2 id="pawUiDialogTitle"></h2>' +
            '<p class="hint-codigo" data-paw-ui-message></p>' +
            '<div data-paw-ui-prompt-wrap style="display:none;margin-top:12px;">' +
            '<label for="pawUiPromptInput" data-paw-ui-prompt-label>Valor</label>' +
            '<input type="text" id="pawUiPromptInput" autocomplete="off" spellcheck="false">' +
            "</div>" +
            '<div class="modal-acciones">' +
            '<button type="button" class="btn-secundario" data-paw-ui-cancel>Cancelar</button>' +
            '<button type="button" class="guardar" data-paw-ui-confirm>Aceptar</button>' +
            "</div>" +
            "</div>";
        document.body.appendChild(modal);
        return modal;
    }

    function openDialog(options) {
        const opts = options || {};
        const modal = ensureModal();
        const titleEl = modal.querySelector("#pawUiDialogTitle");
        const msgEl = modal.querySelector("[data-paw-ui-message]");
        const promptWrap = modal.querySelector("[data-paw-ui-prompt-wrap]");
        const promptLabel = modal.querySelector("[data-paw-ui-prompt-label]");
        const input = modal.querySelector("#pawUiPromptInput");
        const confirmBtn = modal.querySelector("[data-paw-ui-confirm]");
        const cancelBtns = modal.querySelectorAll("[data-paw-ui-cancel]");

        titleEl.textContent = opts.title || "Confirmar";
        msgEl.textContent = opts.message || "";
        confirmBtn.textContent = opts.confirmLabel || "Aceptar";
        cancelBtns.forEach((btn) => {
            if (btn.classList.contains("btn-secundario")) {
                btn.textContent = opts.cancelLabel || "Cancelar";
            }
        });

        const mode = opts.mode || "confirm";
        const showPrompt = mode === "prompt";
        const alertOnly = mode === "alert";
        promptWrap.style.display = showPrompt ? "block" : "none";
        if (showPrompt) {
            promptLabel.textContent = opts.inputLabel || "Valor";
            input.value = opts.initialValue != null ? String(opts.initialValue) : "";
            input.placeholder = opts.placeholder || "";
        }
        cancelBtns.forEach((btn) => {
            if (btn.classList.contains("btn-secundario") || btn.classList.contains("cerrarModal")) {
                if (alertOnly) btn.setAttribute("hidden", "hidden");
                else btn.removeAttribute("hidden");
            }
        });

        return new Promise((resolve) => {
            let settled = false;

            function cleanup() {
                document.removeEventListener("keydown", onEsc);
                modal.removeEventListener("click", onBackdrop);
                confirmBtn.removeEventListener("click", onConfirm);
                cancelBtns.forEach((btn) => btn.removeEventListener("click", onCancel));
                input.removeEventListener("keydown", onInputKey);
            }

            function finish(value) {
                if (settled) return;
                settled = true;
                cleanup();
                modal.classList.remove("activo");
                resolve(value);
            }

            function onConfirm() {
                if (showPrompt) {
                    finish(input.value);
                    return;
                }
                finish(true);
            }

            function onCancel() {
                finish(showPrompt ? null : false);
            }

            function onBackdrop(e) {
                if (e.target === modal) onCancel();
            }

            function onEsc(e) {
                if (e.key === "Escape") onCancel();
            }

            function onInputKey(e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    onConfirm();
                }
            }

            confirmBtn.addEventListener("click", onConfirm);
            cancelBtns.forEach((btn) => btn.addEventListener("click", onCancel));
            modal.addEventListener("click", onBackdrop);
            document.addEventListener("keydown", onEsc);
            if (showPrompt) input.addEventListener("keydown", onInputKey);

            modal.classList.add("activo");
            setTimeout(() => {
                if (showPrompt) {
                    input.focus();
                    input.select();
                } else {
                    confirmBtn.focus();
                }
            }, 40);
        });
    }

    function confirm(message, options) {
        const opts = typeof options === "string" ? { title: options } : options || {};
        return openDialog({
            mode: "confirm",
            title: opts.title || "Confirmar",
            message: message || "",
            confirmLabel: opts.confirmLabel || "Aceptar",
            cancelLabel: opts.cancelLabel || "Cancelar",
        });
    }

    function prompt(message, initialValue, options) {
        const opts = options || {};
        return openDialog({
            mode: "prompt",
            title: opts.title || "Ingresar",
            message: message || "",
            initialValue: initialValue != null ? initialValue : "",
            inputLabel: opts.inputLabel || "Valor",
            placeholder: opts.placeholder || "",
            confirmLabel: opts.confirmLabel || "Continuar",
            cancelLabel: opts.cancelLabel || "Cancelar",
        });
    }

    function alert(message, options) {
        const opts = options || {};
        return openDialog({
            mode: "alert",
            title: opts.title || "Aviso",
            message: message || "",
            confirmLabel: opts.confirmLabel || "Entendido",
        }).then(() => undefined);
    }

    global.PawUi = { confirm, prompt, alert };
})(window);

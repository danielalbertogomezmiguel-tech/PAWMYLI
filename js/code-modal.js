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
            '<label for="pawInputCodigo">Código PAW / lector USB</label>' +
            '<input type="text" id="pawInputCodigo" data-barcode-target="1" autocomplete="off" spellcheck="false" ' +
            'placeholder="Escanea aquí o escribe PAW-000001" inputmode="text">' +
            '<p class="hint-codigo" style="margin-top:10px;font-size:13px;">' +
            "Con lector Motorola LS1203: deja el cursor en este campo y escanea." +
            "</p>" +
            '<div class="modal-acciones">' +
            '<button type="button" class="btn-secundario" data-paw-code-cancel>Cancelar</button>' +
            '<button type="button" class="guardar" data-paw-code-confirm>Continuar</button>' +
            "</div>" +
            "</div>";
        document.body.appendChild(modal);
        return modal;
    }

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

            function cleanup() {
                document.removeEventListener("keydown", onEsc);
                modal.removeEventListener("click", onBackdrop);
                confirmBtn.removeEventListener("click", onConfirm);
                cancelBtns.forEach((btn) => btn.removeEventListener("click", onCancel));
                input.removeEventListener("keydown", onInputKey);
                input.removeEventListener("paw-barcode", onPawBarcode);
            }

            function finish(value) {
                if (settled) return;
                settled = true;
                cleanup();
                modal.classList.remove("activo");
                resolve(value);
            }

            function onConfirm() {
                const raw = (input.value || "").trim();
                const code =
                    (global.PawBarcodeHid && PawBarcodeHid.normalize(raw)) ||
                    raw.toUpperCase();
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

            function onEsc(e) {
                if (e.key === "Escape") onCancel();
            }

            function onInputKey(e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    onConfirm();
                }
            }

            function onPawBarcode(e) {
                const code = e.detail && e.detail.code;
                if (code) {
                    input.value = code;
                    finish(code);
                }
            }

            confirmBtn.addEventListener("click", onConfirm);
            cancelBtns.forEach((btn) => btn.addEventListener("click", onCancel));
            modal.addEventListener("click", onBackdrop);
            document.addEventListener("keydown", onEsc);
            input.addEventListener("keydown", onInputKey);
            input.addEventListener("paw-barcode", onPawBarcode);

            modal.classList.add("activo");
            setTimeout(() => {
                input.focus();
                input.select();
            }, 40);
        });
    }

    global.PawCodeModal = { ask: askCode };
})(window);

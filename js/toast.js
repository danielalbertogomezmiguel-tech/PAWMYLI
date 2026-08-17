/**
 * PawToast — notificaciones no bloqueantes para PawMily.
 * Uso: PawToast.show({ type: 'success'|'error'|'warning'|'info', title, message, duration })
 */
(function (global) {
    const ICONS = {
        success: "fa-solid fa-circle-check",
        error: "fa-solid fa-circle-xmark",
        warning: "fa-solid fa-triangle-exclamation",
        info: "fa-solid fa-circle-info",
    };

    let container = null;

    function ensureContainer() {
        if (container && document.body.contains(container)) return container;
        container = document.createElement("div");
        container.id = "pawToastContainer";
        container.className = "paw-toast-container";
        container.setAttribute("aria-live", "polite");
        container.setAttribute("aria-relevant", "additions");
        document.body.appendChild(container);
        return container;
    }

    function dismiss(el) {
        if (!el || el.classList.contains("paw-toast-out")) return;
        el.classList.add("paw-toast-out");
        const remove = () => {
            el.removeEventListener("animationend", remove);
            el.remove();
        };
        el.addEventListener("animationend", remove);
        setTimeout(() => {
            if (el.parentNode) el.remove();
        }, 400);
    }

    function show(opts) {
        const options = typeof opts === "string" ? { message: opts } : opts || {};
        const type = options.type || "info";
        const title = options.title || "";
        const message = options.message || "";
        const duration =
            options.duration === 0
                ? 0
                : typeof options.duration === "number"
                  ? options.duration
                  : 4200;

        const wrap = ensureContainer();
        const el = document.createElement("div");
        el.className = "paw-toast paw-toast--" + type;
        el.setAttribute("role", "status");

        const icon = document.createElement("i");
        icon.className = "paw-toast-icon " + (ICONS[type] || ICONS.info);
        icon.setAttribute("aria-hidden", "true");

        const body = document.createElement("div");
        body.className = "paw-toast-body";
        if (title) {
            const h = document.createElement("strong");
            h.className = "paw-toast-title";
            h.textContent = title;
            body.appendChild(h);
        }
        if (message) {
            const p = document.createElement("p");
            p.className = "paw-toast-message";
            p.textContent = message;
            body.appendChild(p);
        }

        const close = document.createElement("button");
        close.type = "button";
        close.className = "paw-toast-close";
        close.setAttribute("aria-label", "Cerrar");
        close.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        close.addEventListener("click", () => dismiss(el));

        el.appendChild(icon);
        el.appendChild(body);
        el.appendChild(close);
        wrap.appendChild(el);

        if (duration > 0) {
            setTimeout(() => dismiss(el), duration);
        }

        return el;
    }

    global.PawToast = {
        show,
        success: (title, message, duration) =>
            show({ type: "success", title, message, duration }),
        error: (title, message, duration) =>
            show({ type: "error", title, message, duration }),
        warning: (title, message, duration) =>
            show({ type: "warning", title, message, duration }),
        info: (title, message, duration) =>
            show({ type: "info", title, message, duration }),
    };
})(window);

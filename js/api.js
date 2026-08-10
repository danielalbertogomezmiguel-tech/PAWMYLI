(function (global) {
    const TOKEN_KEY = "pawmyliAccessToken";
    const USER_KEY = "usuarioActivo";

    function apiBase() {
        return (
            (global.PAWMYLI_CONFIG && global.PAWMYLI_CONFIG.apiBase) ||
            (global.PAWMYLI_ENV && global.PAWMYLI_ENV.PAWMYLI_API_BASE) ||
            ""
        );
    }

    function defaultAvatar() {
        return (
            (global.PAWMYLI_CONFIG && global.PAWMYLI_CONFIG.defaultAvatarUrl) ||
            (global.PAWMYLI_ENV && global.PAWMYLI_ENV.PAWMYLI_DEFAULT_AVATAR_URL) ||
            "https://cdn-icons-png.flaticon.com/512/616/616408.png"
        );
    }

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setSession(accessToken, user) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem("recordarSesion");
        localStorage.removeItem("pacienteID");
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY) || "null");
        } catch {
            return null;
        }
    }

    /** Paint vet/owner identity into sidebar; replaces hardcoded HTML placeholders. */
    function applySidebar(user) {
        const u = user || getUser();
        const title = document.querySelector(".perfilDoctor h2, .perfil h2");
        const img = document.querySelector(".perfilDoctor img, .perfil img");
        if (u && title) title.textContent = u.name || "Usuario";
        if (u && img) {
            const src = u.photo || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
            if (img.src !== src) img.src = src;
        }
        return u;
    }

    async function syncProfileToSession() {
        try {
            const profile = await api.profile();
            const token = getToken();
            if (token && profile) setSession(token, profile);
            applySidebar(profile);
            return profile;
        } catch {
            applySidebar();
            return getUser();
        }
    }

    function authPath() {
        const path = global.location.pathname.replace(/\\/g, "/");
        if (path.includes("/auth/")) return "login.html";
        return "../auth/login.html";
    }

    function requireAuth() {
        if (!getToken()) {
            clearSession();
            global.location.href = authPath();
            return false;
        }
        return true;
    }

    function logout() {
        clearSession();
        global.location.href = authPath();
    }

    async function request(path, options = {}) {
        const headers = Object.assign(
            { "Content-Type": "application/json", Accept: "application/json" },
            options.headers || {}
        );

        const token = getToken();
        if (token) headers.Authorization = "Bearer " + token;

        const response = await fetch(apiBase() + path, Object.assign({}, options, { headers }));

        if (response.status === 204) return null;

        let data = null;
        const text = await response.text();
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { message: text };
            }
        }

        if (response.status === 401) {
            clearSession();
            if (!global.location.pathname.includes("/auth/")) {
                global.location.href = authPath();
            }
            throw new Error((data && (data.message || data.error)) || "Sesión expirada");
        }

        if (!response.ok) {
            const message =
                (data && (data.message || data.error)) ||
                (Array.isArray(data?.issues) && data.issues[0]?.message) ||
                "Error de servidor (" + response.status + ")";
            throw new Error(message);
        }

        return data;
    }

    const api = {
        get: (path) => request(path),
        post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
        put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
        del: (path) => request(path, { method: "DELETE" }),
        register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
        login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
        profile: () => request("/auth/profile"),
        updateProfile: (body) => request("/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
        listPatients: (params = {}) => {
            const q = new URLSearchParams();
            if (params.search) q.set("search", params.search);
            q.set("page", String(params.page || 1));
            q.set("limit", String(params.limit || 100));
            return request("/patients?" + q.toString());
        },
        getPatient: (id) => request("/patients/" + encodeURIComponent(id)),
        createPatient: (body) => request("/patients", { method: "POST", body: JSON.stringify(body) }),
        updatePatient: (id, body) =>
            request("/patients/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(body) }),
        listMedicalRecords: (id) => request("/patients/" + encodeURIComponent(id) + "/medical-records"),
        addMedicalRecord: (id, body) =>
            request("/patients/" + encodeURIComponent(id) + "/medical-records", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        updateMedicalRecord: (id, recordId, body) =>
            request(
                "/patients/" +
                    encodeURIComponent(id) +
                    "/medical-records/" +
                    encodeURIComponent(recordId),
                { method: "PUT", body: JSON.stringify(body) }
            ),
        deleteMedicalRecord: (id, recordId) =>
            request(
                "/patients/" +
                    encodeURIComponent(id) +
                    "/medical-records/" +
                    encodeURIComponent(recordId),
                { method: "DELETE" }
            ),
        updateFeeding: (id, body) =>
            request("/patients/" + encodeURIComponent(id) + "/feeding", {
                method: "PUT",
                body: JSON.stringify(body),
            }),
        generateDiet: (id, body) =>
            request("/patients/" + encodeURIComponent(id) + "/diet", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        getFeeding: (id) => request("/patients/" + encodeURIComponent(id) + "/feeding"),
        listReminders: (id) => request("/patients/" + encodeURIComponent(id) + "/reminders"),
        linkPatient: (code) =>
            request("/patients/link", { method: "POST", body: JSON.stringify({ code }) }),
        unlinkPatient: (id) =>
            request("/patients/" + encodeURIComponent(id) + "/link", { method: "DELETE" }),
        myPatients: (params = {}) => {
            const q = new URLSearchParams();
            q.set("page", String(params.page || 1));
            q.set("limit", String(params.limit || 100));
            return request("/patients/mine?" + q.toString());
        },
        barcode: (id) => request("/patients/" + encodeURIComponent(id) + "/barcode"),
        updateReminder: (id, body) =>
            request("/patients/reminders/" + encodeURIComponent(id), {
                method: "PUT",
                body: JSON.stringify(body),
            }),
        completeReminder: (id) =>
            request("/patients/reminders/" + encodeURIComponent(id) + "/complete", {
                method: "POST",
                body: JSON.stringify({}),
            }),
        myAppointments: (params = {}) => {
            const q = new URLSearchParams();
            q.set("page", String(params.page || 1));
            q.set("limit", String(params.limit || 100));
            return request("/appointments/mine?" + q.toString());
        },
        confirmAppointment: (id) =>
            request("/appointments/" + encodeURIComponent(id) + "/confirm", {
                method: "POST",
                body: JSON.stringify({}),
            }),
        listAppointments: (params = {}) => {
            const q = new URLSearchParams();
            if (params.date) q.set("date", params.date);
            q.set("page", String(params.page || 1));
            q.set("limit", String(params.limit || 100));
            return request("/appointments?" + q.toString());
        },
        listAppointmentsByMonth: (year, month) =>
            request("/appointments/month?year=" + year + "&month=" + month),
        createAppointment: (body) =>
            request("/appointments", { method: "POST", body: JSON.stringify(body) }),
        deleteAppointment: (id) =>
            request("/appointments/" + encodeURIComponent(id), { method: "DELETE" }),
        getConfig: () => request("/config"),
        updateConfig: (body) => request("/config", { method: "PUT", body: JSON.stringify(body) }),
        health: () => request("/health"),
    };

    function mapPatient(p) {
        if (!p) return null;
        const feeding = p.feeding
            ? [
                  p.feeding.recommendedAmount,
                  p.feeding.caloriesPerDay != null
                      ? p.feeding.caloriesPerDay + " kcal/día"
                      : null,
                  p.feeding.mealsPerDay != null
                      ? p.feeding.mealsPerDay + " veces al día"
                      : null,
                  p.feeding.weightKg != null ? "Peso dieta: " + p.feeding.weightKg + " kg" : null,
                  p.feeding.vetNotes || p.feeding.specialInstructions,
                  p.feeding.schedule,
              ].filter(Boolean)
            : [];
        const historial = (p.medicalRecords || []).map((r) => ({
            id: r.id,
            fecha: r.date,
            motivo: r.reason,
            veterinario: r.vetName,
            estado: r.status || "Finalizada",
            diagnostico: r.diagnosis,
            tratamiento: r.treatment,
            weightAtVisit: r.weightAtVisit,
            temperature: r.temperature,
            heartRate: r.heartRate,
            respiratoryRate: r.respiratoryRate,
            physicalExam: r.physicalExam,
            prescriptions: r.prescriptions,
            notes: r.notes,
            followUpDate: r.followUpDate,
        }));
        return {
            id: p.id,
            codigo: p.code,
            barcodePayload: p.barcodePayload || p.code,
            nombre: p.name,
            especie: p.species,
            raza: p.breed,
            edad: p.age,
            sexo: p.sex,
            peso: p.weight || "",
            color: p.color || "",
            microchip: p.microchip || "No",
            propietario: p.ownerName,
            telefono: p.ownerPhone || "",
            correo: p.ownerEmail || "",
            foto: p.photo || defaultAvatar(),
            alimentacion: feeding,
            feeding: p.feeding || null,
            historial,
            raw: p,
        };
    }

    global.PawApi = {
        api,
        apiBase,
        defaultAvatar,
        getToken,
        setSession,
        clearSession,
        getUser,
        applySidebar,
        syncProfileToSession,
        requireAuth,
        logout,
        mapPatient,
    };
})(window);

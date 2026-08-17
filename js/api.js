(function (global) {
    const TOKEN_KEY = "pawmyliAccessToken";
    const REFRESH_KEY = "pawmyliRefreshToken";
    const USER_KEY = "usuarioActivo";
    let refreshPromise = null;

    function apiBase() {
        return (
            (global.PAWMYLI_CONFIG && global.PAWMYLI_CONFIG.apiBase) ||
            (global.PAWMYLI_ENV && global.PAWMYLI_ENV.PAWMYLI_API_BASE) ||
            ""
        );
    }

    function isApiDebug() {
        try {
            if (global.localStorage && global.localStorage.getItem("PAWMYLI_DEBUG") === "1") {
                return true;
            }
        } catch (_) {
            /* ignore */
        }
        const host = (global.location && global.location.hostname) || "";
        return host === "localhost" || host === "127.0.0.1";
    }

    function debugApi(label, detail) {
        if (!isApiDebug()) return;
        console.warn("[PawApi]", label, detail || "");
    }

    function sanitizeApiMessage(raw, status) {
        const text = String(raw || "").trim();
        if (!text) return "Error de servidor (" + (status || "?") + ")";
        if (
            /<\s*html|Cannot GET|Cannot POST|Cannot PUT|Cannot DELETE|<pre>/i.test(text)
        ) {
            return "Error de servidor (" + (status || "?") + ")";
        }
        // Cap very long bodies (e.g. accidental HTML)
        if (text.length > 280) return "Error de servidor (" + (status || "?") + ")";
        return text;
    }

    function assetUrl(name) {
        const path = global.location.pathname.replace(/\\/g, "/");
        if (path.includes("/auth/") || path.includes("/dashboard/") || path.includes("/pacientes/") ||
            path.includes("/perfil/") || path.includes("/agenda/") || path.includes("/configuracion/")) {
            return "../assets/" + name;
        }
        return "assets/" + name;
    }

    function defaultAvatar() {
        return (
            (global.PAWMYLI_CONFIG && global.PAWMYLI_CONFIG.defaultAvatarUrl) ||
            (global.PAWMYLI_ENV && global.PAWMYLI_ENV.PAWMYLI_DEFAULT_AVATAR_URL) ||
            assetUrl("placeholder-pet.svg")
        );
    }

    function defaultUserAvatar() {
        return (
            (global.PAWMYLI_CONFIG && global.PAWMYLI_CONFIG.defaultDoctorAvatarUrl) ||
            assetUrl("placeholder-user.svg")
        );
    }

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getRefreshToken() {
        return localStorage.getItem(REFRESH_KEY);
    }

    function setSession(accessToken, user, refreshToken) {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
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
            const src = u.photo || defaultUserAvatar();
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

    async function logout() {
        const refreshToken = getRefreshToken();
        try {
            if (refreshToken) {
                await fetch(apiBase() + "/auth/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + (getToken() || ""),
                    },
                    body: JSON.stringify({ refreshToken }),
                });
            }
        } catch (_) {
            /* ignore */
        }
        clearSession();
        global.location.href = authPath();
    }

    async function refreshAccessToken() {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;
        if (!refreshPromise) {
            refreshPromise = fetch(apiBase() + "/auth/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ refreshToken }),
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => null);
                    if (!res.ok || !data?.accessToken) return false;
                    setSession(data.accessToken, data.user || getUser(), data.refreshToken || refreshToken);
                    return true;
                })
                .catch(() => false)
                .finally(() => {
                    refreshPromise = null;
                });
        }
        return refreshPromise;
    }

    async function request(path, options = {}, _retried) {
        const base = apiBase();
        const url = base + path;
        if (!base) {
            debugApi("apiBase vacío", { path });
            throw new Error("API no configurada. Revisa la URL del servidor.");
        }

        const headers = Object.assign(
            { "Content-Type": "application/json", Accept: "application/json" },
            options.headers || {}
        );

        const token = getToken();
        if (token) headers.Authorization = "Bearer " + token;

        const response = await fetch(url, Object.assign({}, options, { headers }));

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

        if (!response.ok) {
            debugApi((options.method || "GET") + " " + url, {
                status: response.status,
                body: text ? String(text).slice(0, 400) : null,
            });
        }

        if (response.status === 401 && !_retried && getRefreshToken() && !path.includes("/auth/")) {
            const ok = await refreshAccessToken();
            if (ok) return request(path, options, true);
            clearSession();
            if (!global.location.pathname.includes("/auth/")) {
                global.location.href = authPath();
            }
            throw new Error(
                sanitizeApiMessage((data && (data.message || data.error)) || "Sesión expirada", 401)
            );
        }

        if (response.status === 401) {
            clearSession();
            if (!global.location.pathname.includes("/auth/")) {
                global.location.href = authPath();
            }
            throw new Error(
                sanitizeApiMessage((data && (data.message || data.error)) || "Sesión expirada", 401)
            );
        }

        if (!response.ok) {
            const raw =
                (data && (data.message || data.error)) ||
                (Array.isArray(data?.issues) && data.issues[0]?.message) ||
                "";
            throw new Error(sanitizeApiMessage(raw, response.status));
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
        createPatient: (body, opts) => {
            const key =
                (opts && opts.idempotencyKey) ||
                (global.crypto && global.crypto.randomUUID
                    ? global.crypto.randomUUID()
                    : "idemp-" + Date.now() + "-" + Math.random().toString(36).slice(2));
            return request("/patients", {
                method: "POST",
                body: JSON.stringify(body),
                headers: { "Idempotency-Key": key },
            });
        },
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
        /** @deprecated use createLinkRequest */
        linkPatient: (code) =>
            request("/patients/link", { method: "POST", body: JSON.stringify({ code }) }),
        createLinkRequest: (code, requestedRole) =>
            request("/patients/link-requests", {
                method: "POST",
                body: JSON.stringify({ code, requestedRole }),
            }),
        pendingLinkRequests: () => request("/patients/link-requests/pending"),
        approveLinkRequest: (id) =>
            request("/patients/link-requests/" + encodeURIComponent(id) + "/approve", {
                method: "POST",
                body: JSON.stringify({}),
            }),
        rejectLinkRequest: (id) =>
            request("/patients/link-requests/" + encodeURIComponent(id) + "/reject", {
                method: "POST",
                body: JSON.stringify({}),
            }),
        migratePatientCodes: () =>
            request("/patients/migrate-codes", { method: "POST", body: JSON.stringify({}) }),
        patientMembers: (id) => request("/patients/" + encodeURIComponent(id) + "/members"),
        revokeMember: (patientId, userId) =>
            request(
                "/patients/" +
                    encodeURIComponent(patientId) +
                    "/members/" +
                    encodeURIComponent(userId),
                { method: "DELETE" }
            ),
        unlinkPatient: (id) =>
            request("/patients/" + encodeURIComponent(id) + "/link", { method: "DELETE" }),
        requestPasswordReset: (email) =>
            request("/auth/password-reset/request", {
                method: "POST",
                body: JSON.stringify({ email }),
            }),
        confirmPasswordReset: (token, password) =>
            request("/auth/password-reset/confirm", {
                method: "POST",
                body: JSON.stringify({ token, password }),
            }),
        confirmEmailVerification: (token) =>
            request("/auth/email-verification/confirm", {
                method: "POST",
                body: JSON.stringify({ token }),
            }),
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
        deleteAppointment: async (id) => {
            const result = await request("/appointments/" + encodeURIComponent(id), {
                method: "DELETE",
            });
            // Soft-cancel may return the appointment; 204 would be null
            return result || { id: id, status: "Eliminada" };
        },
        getConfig: () => request("/config"),
        updateConfig: (body) => request("/config", { method: "PUT", body: JSON.stringify(body) }),
        health: () => request("/health"),
        getMediaUrl: (assetId) =>
            request("/media/" + encodeURIComponent(assetId) + "/url"),
        listFavorites: () => request("/favorites"),
        addFavorite: (body) =>
            request("/favorites", { method: "POST", body: JSON.stringify(body) }),
        removeFavorite: (id) =>
            request("/favorites/" + encodeURIComponent(id), { method: "DELETE" }),
        listFeedingLogs: (id, params = {}) => {
            const q = new URLSearchParams();
            if (params.from) q.set("from", params.from);
            if (params.to) q.set("to", params.to);
            const qs = q.toString();
            return request(
                "/patients/" +
                    encodeURIComponent(id) +
                    "/feeding/logs" +
                    (qs ? "?" + qs : "")
            );
        },
        createFeedingLog: (id, body) =>
            request("/patients/" + encodeURIComponent(id) + "/feeding/logs", {
                method: "POST",
                body: JSON.stringify(body),
            }),
        syncFeedingReminders: (id) =>
            request("/patients/" + encodeURIComponent(id) + "/feeding/reminders/sync", {
                method: "POST",
            }),
        createMediaUploadUrl: (body) =>
            request("/media/upload-url", { method: "POST", body: JSON.stringify(body) }),
        confirmMediaUpload: (body) =>
            request("/media/confirm", { method: "POST", body: JSON.stringify(body) }),
        /** Upload user avatar via signed URL; returns { assetId, url?, profile? }. */
        uploadUserAvatar: async (file) => {
            if (!file) throw new Error("Archivo requerido");
            const mimeType = file.type || "image/jpeg";
            const sizeBytes = file.size;
            const created = await api.createMediaUploadUrl({
                mimeType,
                sizeBytes,
                kind: "user_avatar",
            });
            const signedUrl =
                (created && created.upload && created.upload.signedUrl) ||
                (created && created.signedUrl);
            if (!signedUrl) throw new Error("No se recibió URL de subida");
            const putRes = await fetch(signedUrl, {
                method: "PUT",
                headers: { "Content-Type": mimeType },
                body: file,
            });
            if (!putRes.ok) {
                throw new Error("Error al subir el archivo (" + putRes.status + ")");
            }
            await api.confirmMediaUpload({
                assetId: created.assetId,
                setAsUserPhoto: true,
            });
            let url = null;
            try {
                const media = await api.getMediaUrl(created.assetId);
                if (media && media.url) url = media.url;
            } catch (_) {
                /* optional */
            }
            let profile = null;
            try {
                profile = await api.profile();
                if (url && profile) profile.photo = url;
            } catch (_) {
                /* optional */
            }
            return { assetId: created.assetId, url, profile };
        },
    };

    function isDisplayablePhoto(value) {
        if (!value) return false;
        const s = String(value);
        if (s.startsWith("asset:")) return false;
        return (
            s.startsWith("http://") ||
            s.startsWith("https://") ||
            s.startsWith("data:") ||
            s.startsWith("blob:")
        );
    }

    function pickPhoto(p) {
        if (isDisplayablePhoto(p.photoUrl)) return p.photoUrl;
        if (isDisplayablePhoto(p.photo)) return p.photo;
        return defaultAvatar();
    }

    function extractAssetId(p) {
        if (p.photoAssetId) return p.photoAssetId;
        if (p.photo && String(p.photo).startsWith("asset:")) {
            return String(p.photo).slice("asset:".length);
        }
        return null;
    }

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
                  p.feeding.allowedFoods ? "Permitidos: " + p.feeding.allowedFoods : null,
                  p.feeding.forbiddenFoods ? "Prohibidos: " + p.feeding.forbiddenFoods : null,
                  p.feeding.vetNotes || p.feeding.specialInstructions,
                  p.feeding.schedule,
              ].filter(Boolean)
            : [];
        const historial = (p.medicalRecords || []).map((r) => ({
            id: r.id,
            fecha: r.date,
            time: r.time || null,
            motivo: r.reason || r.motivo || null,
            reason: r.reason || r.motivo || null,
            veterinario: r.vetName || null,
            vetName: r.vetName || null,
            ownerName: r.ownerName || null,
            estado: r.status || "Finalizada",
            status: r.status || "Finalizada",
            diagnostico: r.diagnosis || null,
            diagnosis: r.diagnosis || null,
            tratamiento: r.treatment || null,
            treatment: r.treatment || null,
            medication: r.medication || null,
            type: r.type || null,
            consultationNumber: r.consultationNumber || null,
            weightAtVisit: r.weightAtVisit,
            temperature: r.temperature,
            heartRate: r.heartRate,
            respiratoryRate: r.respiratoryRate,
            physicalExam: r.physicalExam,
            prescriptions: r.prescriptions,
            results: r.results || null,
            observations: r.observations || null,
            notes: r.notes,
            privateNotes: r.privateNotes || null,
            typePayload: r.typePayload || null,
            followUpDate: r.followUpDate,
            followUpTime: r.followUpTime || null,
            relatedConsultationId: r.relatedConsultationId || null,
            recomendaciones: r.recomendaciones || r.observations || r.treatment || null,
        }));
        const role = (getUser() && getUser().role) || "";
        if (String(role).toLowerCase() === "owner") {
            historial.forEach((h) => {
                delete h.privateNotes;
            });
        }
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
            foto: pickPhoto(p),
            photoAssetId: extractAssetId(p),
            accessRole: p.accessRole || null,
            previousCode: p.previousCode || null,
            linkStatus: p.linkStatus || null,
            alimentacion: feeding,
            feeding: p.feeding || null,
            historial,
            raw: p,
        };
    }

    /** Defense: if API still returned asset:, fetch signed URL. */
    async function enrichPatientPhoto(mapped) {
        if (!mapped) return mapped;
        if (isDisplayablePhoto(mapped.foto) && mapped.foto !== defaultAvatar()) return mapped;
        const assetId = mapped.photoAssetId || extractAssetId(mapped.raw || {});
        if (!assetId) return mapped;
        try {
            const result = await api.getMediaUrl(assetId);
            if (result && result.url) mapped.foto = result.url;
        } catch (_) {
            /* keep placeholder */
        }
        return mapped;
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
        enrichPatientPhoto,
        isDisplayablePhoto,
        isApiDebug,
        sanitizeApiMessage,
    };
})(window);

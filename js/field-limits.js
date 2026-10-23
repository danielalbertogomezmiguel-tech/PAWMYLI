(function (factory) {
    const api = factory();
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    if (typeof window !== "undefined") {
        window.PawFieldLimits = api;
        const boot = () => {
            api.apply(document);
            api.observe(document.body);
        };
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
        else boot();
    }
})(function () {
    const LIMITS = {
        personName: 80,
        petName: 50,
        species: 50,
        email: 254,
        phone: 20,
        password: 72,
        address: 200,
        license: 50,
        clinic: 100,
        productName: 100,
        dose: 100,
        appointmentReason: 500,
        messageSubject: 150,
        messageBody: 5000,
        notes: 2000,
        search: 100,
        patientCode: 20,
    };

    const BY_ID = {
        buscar: LIMITS.search,
        scanhidinput: LIMITS.patientCode,
        pawinputcodigo: LIMITS.patientCode,
        pawcameramanual: LIMITS.patientCode,
        pawuipromptinput: LIMITS.dose,
        nombremascota: LIMITS.petName,
        editnombre: LIMITS.petName,
        especieotra: LIMITS.species,
        editespecieotra: LIMITS.species,
        raza: LIMITS.species,
        editraza: LIMITS.species,
        tipo: LIMITS.species,
        edittipo: LIMITS.species,
        color: LIMITS.species,
        editcolor: LIMITS.species,
        propietario: LIMITS.personName,
        editpropietario: LIMITS.personName,
        dueno: LIMITS.personName,
        correo: LIMITS.email,
        correoclinica: LIMITS.email,
        consultapropietarioemail: LIMITS.email,
        telefono: LIMITS.phone,
        telefonoclinica: LIMITS.phone,
        consultapropietariotel: LIMITS.phone,
        password: LIMITS.password,
        passwordactual: LIMITS.password,
        passwordconfirm: LIMITS.password,
        confirmar: LIMITS.password,
        direccion: LIMITS.address,
        licencia: LIMITS.license,
        clinica: LIMITS.clinic,
        horario: LIMITS.clinic,
        mapa: LIMITS.address,
        nota: LIMITS.notes,
        consultamotivo: LIMITS.appointmentReason,
        consultavet: LIMITS.personName,
        consultapropietario: LIMITS.personName,
        consultanumero: LIMITS.patientCode,
        consultapeso: LIMITS.dose,
        consultatemp: LIMITS.dose,
        consultafc: LIMITS.dose,
        consultafr: LIMITS.dose,
        editedad: LIMITS.dose,
        editpeso: LIMITS.dose,
        dietafoodtype: LIMITS.productName,
        dietabrand: LIMITS.productName,
        dietaresultado: LIMITS.dose,
        dietakcal: LIMITS.dose,
        dietapermitidos: LIMITS.notes,
        dietaprohibidos: LIMITS.notes,
        dietanotas: LIMITS.notes,
        consultaobservaciones: LIMITS.notes,
        consultanotasprivadas: LIMITS.notes,
    };

    const BY_NAME = {
        reason: LIMITS.appointmentReason,
        vetname: LIMITS.personName,
        ownername: LIMITS.personName,
        weight: LIMITS.dose,
        temperature: LIMITS.dose,
        heartrate: LIMITS.dose,
        respiratoryrate: LIMITS.dose,
        observations: LIMITS.notes,
        privatenotes: LIMITS.notes,
        anamnesis: LIMITS.notes,
        hydration: LIMITS.dose,
        mucousmembranes: LIMITS.dose,
        bodycondition: LIMITS.dose,
        nextcontrol: LIMITS.dose,
        physicalexam: LIMITS.notes,
        findings: LIMITS.notes,
        diagnosis: LIMITS.notes,
        treatment: LIMITS.notes,
        medication: LIMITS.productName,
        dose: LIMITS.dose,
        medfrequency: LIMITS.dose,
        duration: LIMITS.dose,
        indications: LIMITS.notes,
        vaccinesreviewed: LIMITS.dose,
        dewormingreviewed: LIMITS.dose,
        parasiteprevention: LIMITS.notes,
        recommendations: LIMITS.notes,
        feedingnotes: LIMITS.notes,
        hygiene: LIMITS.dose,
        activity: LIMITS.dose,
        assessment: LIMITS.notes,
        vaccine: LIMITS.productName,
        diseaseprevented: LIMITS.productName,
        manufacturer: LIMITS.productName,
        lot: LIMITS.license,
        route: LIMITS.dose,
        site: LIMITS.dose,
        nextdose: LIMITS.dose,
        priorreactions: LIMITS.notes,
        postreactions: LIMITS.notes,
        vaccinenotes: LIMITS.notes,
        parasitetype: LIMITS.species,
        product: LIMITS.productName,
        activeingredient: LIMITS.productName,
        frequency: LIMITS.dose,
        weightfordose: LIMITS.dose,
        nextdeworming: LIMITS.dose,
        notes: LIMITS.notes,
        symptoms: LIMITS.notes,
        symptomonset: LIMITS.dose,
        relevanthistory: LIMITS.notes,
        clinicalsigns: LIMITS.notes,
        testsdone: LIMITS.notes,
        results: LIMITS.notes,
        presumptivediagnosis: LIMITS.notes,
        definitivediagnosis: LIMITS.notes,
        prognosis: LIMITS.dose,
        traumareason: LIMITS.appointmentReason,
        injurytype: LIMITS.species,
        affectedzone: LIMITS.dose,
        howoccurred: LIMITS.dose,
        pain: LIMITS.dose,
        inflammation: LIMITS.dose,
        wounds: LIMITS.dose,
        mobility: LIMITS.dose,
        limp: LIMITS.dose,
        studies: LIMITS.notes,
        imagingnotes: LIMITS.notes,
        immobilization: LIMITS.productName,
        reproductivestatus: LIMITS.species,
        cycleheat: LIMITS.species,
        reproductivehistory: LIMITS.notes,
        priorgestations: LIMITS.dose,
        priorbirths: LIMITS.dose,
        priorproblems: LIMITS.notes,
        reproductiveexam: LIMITS.notes,
        followup: LIMITS.notes,
        followupreason: LIMITS.appointmentReason,
        changessince: LIMITS.notes,
        currentsigns: LIMITS.notes,
        treatmentresponse: LIMITS.notes,
        currentmeds: LIMITS.notes,
        treatmentcompliance: LIMITS.notes,
        newfindings: LIMITS.notes,
        newtests: LIMITS.notes,
        currentstatus: LIMITS.notes,
        treatmentmodification: LIMITS.notes,
        newindications: LIMITS.notes,
    };

    const SKIP_TYPES = {
        hidden: 1,
        checkbox: 1,
        radio: 1,
        file: 1,
        button: 1,
        submit: 1,
        reset: 1,
        image: 1,
        number: 1,
        date: 1,
        time: 1,
        "datetime-local": 1,
        month: 1,
        week: 1,
        color: 1,
        range: 1,
    };

    function pageHint(file) {
        const fromDom = typeof location !== "undefined" && location.pathname ? location.pathname : "";
        return String(file || fromDom)
            .replace(/\\/g, "/")
            .toLowerCase();
    }

    function maxLengthFor(field) {
        const id = String((field && field.id) || "").trim().toLowerCase();
        const name = String((field && field.name) || "").trim().toLowerCase();
        const className = String((field && field.className) || "").toLowerCase();
        const type = String((field && field.type) || "text").toLowerCase();
        const tagName = String((field && field.tagName) || "input").toLowerCase();
        if (className.split(/\s+/).indexOf("meal-label") !== -1) return LIMITS.productName;
        if (className.split(/\s+/).indexOf("meal-amount") !== -1) return LIMITS.dose;
        if (id === "nombre") {
            const hint = pageHint(field && field.file);
            const petForm = hint.indexOf("pacientes/") !== -1;
            return petForm ? LIMITS.petName : LIMITS.personName;
        }
        if (id && Object.prototype.hasOwnProperty.call(BY_ID, id)) return BY_ID[id];
        if (name === "evolution") return tagName === "textarea" ? LIMITS.notes : LIMITS.dose;
        if (name && Object.prototype.hasOwnProperty.call(BY_NAME, name)) return BY_NAME[name];
        if (type === "email") return LIMITS.email;
        if (type === "password") return LIMITS.password;
        const where = id || name || type || tagName;
        throw new Error("Sin límite para el campo " + where);
    }

    function promptMaxLength(inputLabel, explicit) {
        const given = Number(explicit);
        if (Number.isFinite(given) && given > 0) return given;
        const label = String(inputLabel || "")
            .trim()
            .toLowerCase();
        if (label === "motivo") return LIMITS.appointmentReason;
        if (label === "fecha" || label === "hora") return LIMITS.phone;
        if (label === "intervalo" || label === "días" || label === "dias") return LIMITS.dose;
        return LIMITS.dose;
    }

    function counterLabel(length, max) {
        return String(length) + "/" + String(max);
    }

    function isTextControl(el) {
        if (!el || !el.tagName) return false;
        const tag = el.tagName.toLowerCase();
        if (tag === "textarea") return true;
        if (tag !== "input") return false;
        const type = (el.getAttribute("type") || "text").toLowerCase();
        return !SKIP_TYPES[type];
    }

    function ensureCounter(el, max) {
        let counter = el.nextElementSibling;
        if (!counter || !counter.classList || !counter.classList.contains("field-count")) {
            counter = el.ownerDocument.createElement("span");
            counter.className = "field-count";
            counter.setAttribute("aria-live", "polite");
            el.insertAdjacentElement("afterend", counter);
        }
        const paint = () => {
            const n = String(el.value || "").length;
            counter.textContent = counterLabel(n, max);
            counter.classList.toggle("is-full", n >= max);
        };
        if (el.dataset.fieldCountBound !== "1") {
            el.addEventListener("input", paint);
            el.dataset.fieldCountBound = "1";
        }
        paint();
    }

    function applyOne(el) {
        if (!isTextControl(el)) return;
        const tag = el.tagName.toLowerCase();
        const max = maxLengthFor({
            id: el.id || "",
            name: el.getAttribute("name") || "",
            className: typeof el.className === "string" ? el.className : "",
            type: tag === "textarea" ? "textarea" : el.getAttribute("type") || "text",
            tagName: tag,
        });
        el.maxLength = max;
        el.setAttribute("maxlength", String(max));
        if (tag === "textarea" && max >= 500) ensureCounter(el, max);
    }

    function apply(root) {
        if (!root || !root.querySelectorAll) return;
        if (isTextControl(root)) applyOne(root);
        root.querySelectorAll("input, textarea").forEach(applyOne);
    }

    function observe(root) {
        if (!root || typeof MutationObserver === "undefined") return null;
        const observer = new MutationObserver((records) => {
            records.forEach((record) => {
                record.addedNodes.forEach((node) => {
                    if (!node || node.nodeType !== 1) return;
                    apply(node);
                });
            });
        });
        observer.observe(root, { childList: true, subtree: true });
        return observer;
    }

    return {
        LIMITS: LIMITS,
        maxLengthFor: maxLengthFor,
        promptMaxLength: promptMaxLength,
        counterLabel: counterLabel,
        apply: apply,
        observe: observe,
        isTextControl: isTextControl,
    };
});

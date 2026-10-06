(function (global) {
    const WITH_BREED = [
        "Perro",
        "Gato",
        "Caballo",
        "Conejo",
        "Hámster",
        "Cobayo",
        "Hurón",
        "Loro",
        "Canario",
        "Periquito",
        "Gallina",
        "Pato",
        "Vaca",
        "Cerdo",
        "Oveja",
        "Cabra",
    ];

    const WITHOUT_BREED = ["Iguana", "Erizo", "Rata", "Ratón"];

    const WITH_TYPE = ["Pez", "Tortuga", "Serpiente", "Rana", "Lagartija", "Gecko"];

    const TYPE_HINTS = {
        PEZ: "Ej: Salmón, pez globo, betta",
        TORTUGA: "Ej: Marina, terrestre, orejas rojas",
        SERPIENTE: "Ej: Pitón, boa, coral",
        RANA: "Ej: Arborícola, toro",
        LAGARTIJA: "Ej: Común, anolis",
        GECKO: "Ej: Leopardo, crestado",
    };

    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "")
            .toUpperCase();
    }

    const breedKeys = new Set(WITH_BREED.map(normalize));
    const typeKeys = new Set(WITH_TYPE.map(normalize));

    function requiresBreed(species) {
        return breedKeys.has(normalize(species));
    }

    function usesType(species) {
        return typeKeys.has(normalize(species));
    }

    function detailLabel(species) {
        return usesType(species) ? "Tipo" : "Raza";
    }

    function fillSelect(select) {
        if (!select) return;
        select.innerHTML = "";
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecciona especie";
        select.appendChild(placeholder);

        function group(label, names) {
            const wrap = document.createElement("optgroup");
            wrap.label = label;
            names.forEach((name) => {
                const option = document.createElement("option");
                option.value = name;
                option.textContent = name;
                wrap.appendChild(option);
            });
            select.appendChild(wrap);
        }

        group("Piden raza", WITH_BREED);
        group("Por tipo", WITH_TYPE);
        group("Sin raza ni tipo", WITHOUT_BREED);

        const other = document.createElement("option");
        other.value = "OTRA";
        other.textContent = "Otra";
        select.appendChild(other);
    }

    function readSpecies(select, customInput) {
        if (!select) return "";
        if (select.value === "OTRA") return (customInput && customInput.value.trim()) || "";
        return select.value.trim();
    }

    function applySpecies(select, customInput, species) {
        const value = String(species || "").trim();
        const known = WITH_BREED.concat(WITH_TYPE, WITHOUT_BREED);
        const match = known.find((name) => normalize(name) === normalize(value));
        if (match) {
            select.value = match;
            if (customInput) customInput.value = "";
            return;
        }
        if (value) {
            select.value = "OTRA";
            if (customInput) customInput.value = value;
            return;
        }
        select.value = "";
        if (customInput) customInput.value = "";
    }

    function bind(select, customWrap, breedWrap, breedInput, customInput, typeWrap, typeInput) {
        function sync() {
            const other = select.value === "OTRA";
            if (customWrap) customWrap.hidden = !other;
            const species = readSpecies(select, customInput);
            const askBreed = requiresBreed(species);
            const askType = usesType(species);
            if (breedWrap) breedWrap.hidden = !askBreed;
            if (typeWrap) typeWrap.hidden = !askType;
            if (!askBreed && breedInput) breedInput.value = "";
            if (!askType && typeInput) typeInput.value = "";
            if (askType && typeInput) {
                typeInput.placeholder = TYPE_HINTS[normalize(species)] || "Ej: Salmón, pez globo";
            }
        }
        select.addEventListener("change", sync);
        if (customInput) customInput.addEventListener("input", sync);
        sync();
        return sync;
    }

    global.PawSpecies = {
        WITH_BREED,
        WITH_TYPE,
        WITHOUT_BREED,
        normalize,
        requiresBreed,
        usesType,
        detailLabel,
        fillSelect,
        readSpecies,
        applySpecies,
        bind,
    };
})(window);

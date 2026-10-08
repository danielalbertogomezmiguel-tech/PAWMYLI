const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadHoraComidaParaInput() {
    const src = fs.readFileSync(path.join(__dirname, "../../perfil/perfil.js"), "utf8");
    const start = src.indexOf("function horaComidaParaInput(");
    if (start < 0) throw new Error("horaComidaParaInput no está en perfil.js");
    let i = src.indexOf("{", start);
    let depth = 0;
    for (; i < src.length; i += 1) {
        const ch = src[i];
        if (ch === "{") depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0) {
                i += 1;
                break;
            }
        }
    }
    const script = src.slice(start, i) + "\nhoraComidaParaInput;";
    return vm.runInNewContext(script);
}

test("horaComidaParaInput convierte horas guardadas a HH:MM", () => {
    const horaComidaParaInput = loadHoraComidaParaInput();
    const validas = [
        ["20:00", "20:00"],
        ["8:00", "08:00"],
        ["20:00:00", "20:00"],
        ["8 pm", "20:00"],
        ["8pm", "20:00"],
        ["8:30 pm", "20:30"],
        ["8:30 p. m.", "20:30"],
        ["8:30 p.m.", "20:30"],
        ["7:00 a. m.", "07:00"],
        ["12 am", "00:00"],
        ["12 pm", "12:00"],
        ["8:00 PM", "20:00"],
        ["  8   PM  ", "20:00"],
        ["8:30 P. M.", "20:30"],
        ["7:00 A.M.", "07:00"],
    ];
    validas.forEach(([input, expected]) => {
        assert.equal(horaComidaParaInput(input), expected, input);
    });

    ["xx", "25:00", "13 pm", "13pm", "24:00", "8:60", ""].forEach((input) => {
        assert.equal(horaComidaParaInput(input), "", input);
    });
    assert.equal(horaComidaParaInput(null), "");
    assert.equal(horaComidaParaInput(undefined), "");
});

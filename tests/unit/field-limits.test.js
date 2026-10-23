const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { LIMITS, maxLengthFor, promptMaxLength, counterLabel } = require("../../js/field-limits.js");

const root = path.join(__dirname, "../..");
const SKIP = new Set([
    "hidden",
    "checkbox",
    "radio",
    "file",
    "button",
    "submit",
    "reset",
    "image",
    "number",
    "date",
    "time",
    "datetime-local",
    "month",
    "week",
    "color",
    "range",
]);

const FORM_PAGES = [
    "agenda/agenda.html",
    "auth/login.html",
    "auth/registro.html",
    "auth/reset.html",
    "configuracion/configuracion.html",
    "correo/index.html",
    "pacientes/paciente.html",
    "perfil/perfil.html",
];

test("maxlength de los formularios coincide con la tabla común", () => {
    assert.equal(maxLengthFor({ id: "nombre", file: "auth/registro.html" }), LIMITS.personName);
    assert.equal(maxLengthFor({ id: "nombre", file: "pacientes/paciente.html" }), LIMITS.petName);
    assert.equal(maxLengthFor({ id: "consultaMotivo" }), LIMITS.appointmentReason);
    assert.equal(maxLengthFor({ name: "diagnosis", tagName: "textarea" }), LIMITS.notes);
    assert.equal(maxLengthFor({ id: "nota", tagName: "textarea" }), LIMITS.notes);
    assert.equal(maxLengthFor({ id: "password", type: "password" }), LIMITS.password);
    assert.equal(maxLengthFor({ id: "correo", type: "email" }), LIMITS.email);
    assert.equal(maxLengthFor({ id: "buscar" }), LIMITS.search);
    assert.equal(maxLengthFor({ id: "pawInputCodigo" }), LIMITS.patientCode);
    assert.equal(counterLabel(3, 2000), "3/2000");
    assert.equal(promptMaxLength("Motivo"), 500);
    assert.equal(promptMaxLength("Fecha"), 20);
    assert.equal(promptMaxLength("Hora"), 20);

    const misses = [];
    for (const rel of FORM_PAGES) {
        const html = fs.readFileSync(path.join(root, rel), "utf8");
        assert.match(html, /field-limits\.js/);
        const tags = html.match(/<(input|textarea)\b[\s\S]*?>/gi) || [];
        for (const tag of tags) {
            const isTa = /^<textarea/i.test(tag);
            const type = (tag.match(/\btype="([^"]+)"/i) || [])[1] || (isTa ? "textarea" : "text");
            if (!isTa && SKIP.has(type.toLowerCase())) continue;
            const id = (tag.match(/\bid="([^"]+)"/i) || [])[1] || "";
            const name = (tag.match(/\bname="([^"]+)"/i) || [])[1] || "";
            const className = (tag.match(/\bclass="([^"]+)"/i) || [])[1] || "";
            const expected = maxLengthFor({
                id,
                name,
                className,
                type: isTa ? "textarea" : type,
                tagName: isTa ? "textarea" : "input",
                file: rel,
            });
            const found = tag.match(/maxlength="(\d+)"/i);
            if (!found || Number(found[1]) !== expected) {
                misses.push(rel + " #" + (id || name || type) + " esperaba " + expected);
            }
        }
    }
    assert.deepEqual(misses, []);
    const limiter = fs.readFileSync(path.join(root, "js/field-limits.js"), "utf8");
    assert.match(limiter, /tag === "textarea" && max >= 500/);
    assert.match(limiter, /field-count/);

    const reset = fs.readFileSync(path.join(root, "auth/reset.html"), "utf8");
    assert.match(reset, /id="password"[^>]*minlength="6"/);
    assert.match(reset, /id="password"[^>]*maxlength="72"/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const { apiErrorPayload, sanitizeApiMessage } = require("../../js/api.js");

test("un 400 con el mensaje en arreglo muestra el texto del backend", () => {
    const payload = apiErrorPayload({
        statusCode: 400,
        message: ["El nombre no puede superar 80 caracteres"],
        error: "Bad Request",
    });
    assert.equal(payload.raw, "El nombre no puede superar 80 caracteres");
    assert.equal(
        sanitizeApiMessage(payload.raw, 400),
        "El nombre no puede superar 80 caracteres"
    );
});

test("un 400 de validación prefiere el detalle y no el código genérico", () => {
    const payload = apiErrorPayload({
        message: "VALIDATION_ERROR",
        issues: [{ message: "El correo no es válido" }],
        error: "Bad Request",
    });
    assert.equal(payload.raw, "El correo no es válido");
    assert.equal(sanitizeApiMessage(payload.raw, 400), "El correo no es válido");
});

test("un 400 largo se muestra y un HTML no", () => {
    const largo = "x".repeat(300);
    assert.equal(sanitizeApiMessage(largo, 400), largo);
    assert.equal(sanitizeApiMessage("<html><body>no</body></html>", 400), "Error de servidor (400)");
    assert.equal(sanitizeApiMessage(largo, 500), "Error de servidor (500)");
});

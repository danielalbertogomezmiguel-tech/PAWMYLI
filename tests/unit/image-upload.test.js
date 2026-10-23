const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { detectImageMime, assertImageFile, photoFieldForSave } = require("../../js/image-upload.js");

const TYPE_MSG = "Solo se permiten imágenes JPG, PNG o WebP.";

function fileFrom(bytes, name, type) {
    return new File([Uint8Array.from(bytes)], name, { type: type || "" });
}

test("detecta JPEG y PNG por magic bytes", async () => {
    const jpeg = fileFrom([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "foto.jpg", "image/jpeg");
    const png = fileFrom(
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00],
        "foto.png",
        "image/png"
    );
    assert.equal(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff])), "image/jpeg");
    assert.equal(
        detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
        "image/png"
    );
    assert.equal((await assertImageFile(jpeg)).mime, "image/jpeg");
    assert.equal((await assertImageFile(png)).mime, "image/png");
});

test("rechaza un exe renombrado como jpg", async () => {
    const exe = fileFrom([0x4d, 0x5a, 0x90, 0x00, 0x03], "foto.jpg", "image/jpeg");
    await assert.rejects(assertImageFile(exe), { message: TYPE_MSG });
});

test("rechaza un pdf renombrado como jpg", async () => {
    const pdf = new File([Buffer.from("%PDF-1.7\n%fake")], "scan.jpg", { type: "image/jpeg" });
    await assert.rejects(assertImageFile(pdf), { message: TYPE_MSG });
});

test("las fotos de paciente y perfil aceptan jpg png webp y no usan capture", () => {
    const root = path.join(__dirname, "../..");
    for (const rel of ["pacientes/paciente.html", "configuracion/configuracion.html"]) {
        const html = fs.readFileSync(path.join(root, rel), "utf8");
        const input = html.match(/<input\b[^>]*\bid="foto"[^>]*>/);
        assert.ok(input, rel);
        assert.match(input[0], /accept="image\/jpeg,image\/png,image\/webp"/);
        assert.equal(/\bcapture\b/.test(input[0]), false);
    }
    const registro = fs.readFileSync(path.join(root, "auth/registro.html"), "utf8");
    const licencia = registro.match(/<input\b[^>]*\bid="documento"[^>]*>/);
    assert.ok(licencia);
    assert.match(licencia[0], /accept="\.pdf,\.png,\.jpg,\.jpeg"/);
});

test("guardar sin archivo nuevo omite la foto y nunca reenvía la URL firmada", () => {
    assert.deepEqual(photoFieldForSave(undefined), {});
    assert.deepEqual(photoFieldForSave(""), {});
    assert.deepEqual(photoFieldForSave("https://cdn.example/luna.png?X-Amz-Signature=abc"), {});
    assert.deepEqual(photoFieldForSave("../assets/placeholder-pet.svg"), {});
    assert.deepEqual(photoFieldForSave("data:image/svg+xml;base64,abc"), {});
    assert.deepEqual(photoFieldForSave("data:image/jpeg;base64,abc"), {
        photo: "data:image/jpeg;base64,abc",
    });
    const perfil = fs.readFileSync(path.join(__dirname, "../../perfil/perfil.js"), "utf8");
    const editar = perfil.slice(perfil.indexOf('getElementById("formEditar")'));
    assert.equal(/photo:\s*paciente\.foto/.test(editar), false);
    assert.equal(/photoUrl:\s*paciente\.foto/.test(editar), false);
    const alta = fs.readFileSync(path.join(__dirname, "../../pacientes/paciente.js"), "utf8");
    assert.equal(/photo:\s*DEFAULT_FOTO/.test(alta), false);
});

test("rechaza un svg con script aunque se llame jpg", async () => {
    const svg = new File(
        [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
        "foto.jpg",
        { type: "image/jpeg" }
    );
    await assert.rejects(assertImageFile(svg), { message: TYPE_MSG });
});

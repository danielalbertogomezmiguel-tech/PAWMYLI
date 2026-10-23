const test = require("node:test");
const assert = require("node:assert/strict");
const { detectImageMime, assertImageFile } = require("../../js/image-upload.js");

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

test("rechaza un svg con script aunque se llame jpg", async () => {
    const svg = new File(
        [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
        "foto.jpg",
        { type: "image/jpeg" }
    );
    await assert.rejects(assertImageFile(svg), { message: TYPE_MSG });
});

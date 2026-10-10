/**
 * Genera tests/fixtures/paw-abc123.y4m para la cámara falsa de Chromium.
 *
 * El símbolo es Code 128, conjunto B: el mismo que elige JsBarcode
 * (format CODE128) para un texto como PAW-ABC123. Los patrones de barras
 * son los de JsBarcode 3.11.6 (BARS). Antes de escribir, el script comprueba
 * que el ZXing vendido en js/vendor lee ese símbolo.
 *
 * Cómo regenerarlo:
 *   node tests/generate-barcode-fixture.js
 *
 * El vídeo es YUV4MPEG2 sin comprimir (640×480, 15 fps, 12 fotogramas).
 * Chromium lo reproduce en bucle con:
 *   --use-file-for-fake-video-capture=<ruta absoluta del .y4m>
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TEXT = "PAW-ABC123";
const WIDTH = 640;
const HEIGHT = 480;
const FRAMES = 12;
const FPS = 15;

/* JsBarcode 3.11.6 CODE128 BARS. El índice 106 (STOP) tiene 13 módulos. */
const BARS = [
    "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
    "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
    "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
    "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
    "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
    "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
    "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
    "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
    "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
    "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
    "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
    "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
    "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
    "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
    "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
    "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
    "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
    "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
    "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
    "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
    "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
    "11010011100", "1100011101011",
];

const START_B = 104;
const STOP = 106;
const MODULO = 103;

function encodeSetB(text) {
    const values = [START_B];
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code < 32 || code > 126) {
            throw new Error("El texto no cabe en Code 128 conjunto B: " + text);
        }
        values.push(code - 32);
    }
    let checksum = values[0];
    for (let i = 1; i < values.length; i++) checksum += values[i] * i;
    values.push(checksum % MODULO);
    values.push(STOP);
    return values.map((index) => BARS[index]).join("");
}

function paint(bits) {
    const module = 3;
    const quiet = 10;
    const barHeight = 200;
    const modules = quiet + bits.length + quiet;
    const barcodeWidth = modules * module;
    const y = new Uint8Array(WIDTH * HEIGHT);
    y.fill(255);
    const originX = Math.floor((WIDTH - barcodeWidth) / 2);
    const originY = Math.floor((HEIGHT - barHeight) / 2);
    for (let row = 0; row < barHeight; row++) {
        for (let col = 0; col < bits.length; col++) {
            if (bits[col] !== "1") continue;
            const x0 = originX + (quiet + col) * module;
            for (let dx = 0; dx < module; dx++) {
                y[(originY + row) * WIDTH + x0 + dx] = 0;
            }
        }
    }
    return y;
}

function loadZxing() {
    const file = path.join(__dirname, "..", "js", "vendor", "zxing-library-0.23.0.min.js");
    const source = fs.readFileSync(file, "utf8");
    const sandbox = {};
    const context = { globalThis: sandbox, window: sandbox, self: sandbox, console: console };
    vm.createContext(context);
    vm.runInContext(source, context);
    if (!sandbox.ZXing) throw new Error("No se cargó ZXing");
    return sandbox.ZXing;
}

function assertDecoded(y) {
    const ZXing = loadZxing();
    const reader = new ZXing.MultiFormatReader();
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    const source = new ZXing.RGBLuminanceSource(Uint8ClampedArray.from(y), WIDTH, HEIGHT);
    const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
    const text = reader.decode(bitmap).getText();
    if (text !== TEXT) {
        throw new Error("ZXing leyó " + text + " en vez de " + TEXT);
    }
}

function writeY4m(y, file) {
    const header = Buffer.from(
        "YUV4MPEG2 W" + WIDTH + " H" + HEIGHT + " F" + FPS + ":1 Ip A1:1 C420\n"
    );
    const frameTag = Buffer.from("FRAME\n");
    const uvSize = (WIDTH / 2) * (HEIGHT / 2);
    const uv = Buffer.alloc(uvSize, 128);
    const yPlane = Buffer.from(y);
    const out = fs.createWriteStream(file);
    out.write(header);
    for (let i = 0; i < FRAMES; i++) {
        out.write(frameTag);
        out.write(yPlane);
        out.write(uv);
        out.write(uv);
    }
    return new Promise((resolve, reject) => {
        out.on("error", reject);
        out.end(resolve);
    });
}

async function main() {
    const bits = encodeSetB(TEXT);
    const y = paint(bits);
    assertDecoded(y);
    const dir = path.join(__dirname, "fixtures");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "paw-abc123.y4m");
    await writeY4m(y, file);
    const stat = fs.statSync(file);
    console.log(file);
    console.log(TEXT + " " + stat.size + " bytes");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

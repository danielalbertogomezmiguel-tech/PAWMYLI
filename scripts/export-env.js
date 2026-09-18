/**
 * Lee .env (y process.env en CI/Vercel) y exporta js/env.js para el frontend estático.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const outPath = path.join(root, "js", "env.js");

const KEYS = [
  "PAWMYLI_API_BASE",
  "PAWMYLI_API_BASE_LOCAL",
  "PAWMYLI_BARCODE_API_URL",
  "PAWMYLI_DEFAULT_AVATAR_URL",
  "PAWMYLI_DEFAULT_DOCTOR_AVATAR_URL",
];

const DEFAULTS = {
  PAWMYLI_API_BASE: "https://api-production-66b1.up.railway.app/api",
  PAWMYLI_API_BASE_LOCAL: "http://127.0.0.1:3000/api",
  PAWMYLI_BARCODE_API_URL: "",
  PAWMYLI_DEFAULT_AVATAR_URL: "../assets/placeholder-pet.svg",
  PAWMYLI_DEFAULT_DOCTOR_AVATAR_URL: "../assets/placeholder-user.svg",
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const fromFile = parseEnvFile(envPath);
const env = {};

for (const key of KEYS) {
  env[key] = process.env[key] || fromFile[key] || DEFAULTS[key];
}

const banner = `/* Generado por scripts/export-env.js — no editar a mano. */\n`;
const body =
  "window.PAWMYLI_ENV = " +
  JSON.stringify(env, null, 2) +
  ";\n";

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, banner + body, "utf8");
console.log("Exported env -> js/env.js");

const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml, safeImageUrl } = require("../../js/escape.js");
const { resolveApiOverride, applyStoredApiOverride } = require("../../js/config.js");

test("escapeHtml escapes tags and quotes", () => {
    const raw = '<img src=x onerror=1>';
    const escaped = escapeHtml(raw);
    assert.equal(escaped, "&lt;img src=x onerror=1&gt;");
    assert.equal(escaped.includes("<"), false);
    assert.equal(escaped.includes(">"), false);
    assert.equal(escapeHtml('"'), "&quot;");
    assert.equal(escapeHtml("'"), "&#39;");
    assert.equal(
        escapeHtml('<img src=x onerror="window.__xss=1">'),
        "&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;"
    );
    assert.equal(escapeHtml("Lúa ñandú 🐶"), "Lúa ñandú 🐶");
});

test("safeImageUrl rejects javascript and accepts https", () => {
    assert.equal(safeImageUrl("javascript:alert(1)"), "");
    assert.equal(safeImageUrl("javascript:alert(1)", "../assets/placeholder-pet.svg"), "../assets/placeholder-pet.svg");
    assert.equal(safeImageUrl("https://x/y.png"), "https://x/y.png");
    assert.equal(safeImageUrl("http://x/y.png"), "");
    assert.equal(safeImageUrl("data:text/html,<script>"), "");
    assert.equal(safeImageUrl("data:image/png;base64,aaaa"), "data:image/png;base64,aaaa");
    assert.equal(safeImageUrl("blob:https://localhost/abc"), "blob:https://localhost/abc");
});

test("api override ignores pawmyliApiBase outside localhost", () => {
    const evil = "https://evil.example/api";
    assert.equal(resolveApiOverride("pawmyli.vercel.app", evil), "");
    assert.equal(resolveApiOverride("localhost", evil), "");
    assert.equal(resolveApiOverride("127.0.0.1", "http://127.0.0.1:3000/api"), "http://127.0.0.1:3000/api");
    assert.equal(resolveApiOverride("localhost", "http://localhost:3000/api"), "http://localhost:3000/api");

    const mem = new Map();
    const storage = {
        getItem(key) {
            return mem.has(key) ? mem.get(key) : null;
        },
        removeItem(key) {
            mem.delete(key);
        },
    };
    mem.set("pawmyliApiBase", evil);
    const base = applyStoredApiOverride(
        storage,
        "example.com",
        "https://api-production-66b1.up.railway.app/api"
    );
    assert.equal(base, "https://api-production-66b1.up.railway.app/api");
    assert.equal(storage.getItem("pawmyliApiBase"), null);
});

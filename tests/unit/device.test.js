const test = require("node:test");
const assert = require("node:assert/strict");
const { isPhoneOrTablet } = require("../../js/device.js");

function matchMedia(coarse) {
    return (query) => ({ matches: query === "(pointer: coarse)" ? coarse : false });
}

const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD =
    "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const IPOD =
    "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
const MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

test("Android con puntero grueso es teléfono", () => {
    assert.equal(isPhoneOrTablet({ userAgent: ANDROID, maxTouchPoints: 5 }, matchMedia(true)), true);
});

test("iPhone con puntero grueso es teléfono", () => {
    assert.equal(isPhoneOrTablet({ userAgent: IPHONE, maxTouchPoints: 5 }, matchMedia(true)), true);
});

test("iPad clásico con puntero grueso es tablet", () => {
    assert.equal(isPhoneOrTablet({ userAgent: IPAD, maxTouchPoints: 5 }, matchMedia(true)), true);
});

test("iPod con puntero grueso es móvil", () => {
    assert.equal(isPhoneOrTablet({ userAgent: IPOD, maxTouchPoints: 5 }, matchMedia(true)), true);
});

test("iPadOS anunciado como Mac con touch y puntero grueso es tablet", () => {
    assert.equal(
        isPhoneOrTablet({ userAgent: MAC, maxTouchPoints: 5 }, matchMedia(true)),
        true
    );
});

test("Mac sin touch y puntero fino es escritorio", () => {
    assert.equal(
        isPhoneOrTablet({ userAgent: MAC, maxTouchPoints: 0 }, matchMedia(false)),
        false
    );
});

test("portátil táctil Windows es escritorio aunque el puntero sea grueso", () => {
    assert.equal(
        isPhoneOrTablet(
            {
                userAgent: WINDOWS,
                maxTouchPoints: 10,
                userAgentData: { mobile: false },
            },
            matchMedia(true)
        ),
        false
    );
});

test("userAgentData.mobile con puntero grueso es móvil", () => {
    assert.equal(
        isPhoneOrTablet(
            { userAgent: "Mozilla/5.0", maxTouchPoints: 1, userAgentData: { mobile: true } },
            matchMedia(true)
        ),
        true
    );
});

test("puntero fino no es móvil aunque el UA sea Android o userAgentData.mobile", () => {
    assert.equal(isPhoneOrTablet({ userAgent: ANDROID, maxTouchPoints: 5 }, matchMedia(false)), false);
    assert.equal(
        isPhoneOrTablet(
            { userAgent: ANDROID, maxTouchPoints: 5, userAgentData: { mobile: true } },
            matchMedia(false)
        ),
        false
    );
    assert.equal(
        isPhoneOrTablet({ userAgent: MAC, maxTouchPoints: 5 }, matchMedia(false)),
        false
    );
});

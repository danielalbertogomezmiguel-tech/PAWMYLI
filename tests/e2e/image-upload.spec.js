const { test, expect } = require("@playwright/test");

test("una imagen grande de canvas queda bajo 1.2 MB", async ({ page }) => {
    await page.route("**/*", async (route) => {
        let host = "";
        try {
            host = new URL(route.request().url()).hostname;
        } catch (_) {
            host = "";
        }
        if (
            host === "127.0.0.1" ||
            host === "localhost" ||
            host === "cdnjs.cloudflare.com" ||
            host === "fonts.googleapis.com" ||
            host === "fonts.gstatic.com"
        ) {
            await route.continue();
            return;
        }
        await route.abort();
    });

    await page.goto("/auth/login.html");
    await page.addScriptTag({ path: "js/image-upload.js" });
    const result = await page.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 2200;
        canvas.height = 1600;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 2200, 1600);
        gradient.addColorStop(0, "#2c5f5a");
        gradient.addColorStop(0.5, "#e8a05a");
        gradient.addColorStop(1, "#8fc3a7");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2200, 1600);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        const file = new File([blob], "grande.png", { type: "image/png" });
        const prepared = await PawImageUpload.prepare(file);
        return {
            bytes: prepared.outputBytes,
            prefix: prepared.dataUrl.slice(0, 23),
            optimized: prepared.optimized,
            mime: prepared.mime,
        };
    });

    expect(result.prefix).toBe("data:image/jpeg;base64,");
    expect(result.mime).toBe("image/jpeg");
    expect(result.optimized).toBe(true);
    expect(result.bytes).toBeLessThan(1.2 * 1024 * 1024);
});

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
};

function localFile(urlPath) {
    let rel = decodeURIComponent(urlPath || "/");
    rel = rel.replace(/^[/\\]+/, "");
    if (!rel || rel.endsWith("/")) rel += "index.html";
    const file = path.resolve(root, rel);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return file;
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const file = localFile(url.pathname);
    if (!file) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }
    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(data);
    });
});

server.listen(port, "127.0.0.1");

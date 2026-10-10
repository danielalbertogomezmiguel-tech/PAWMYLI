(function (global) {
    var activeStop = null;

    function normalize(raw) {
        if (global.PawBarcodeHid && typeof global.PawBarcodeHid.normalize === "function") {
            return global.PawBarcodeHid.normalize(raw);
        }
        return String(raw || "")
            .replace(/[\r\n\t]+/g, "")
            .trim()
            .toUpperCase();
    }

    function vendorSrc() {
        var scripts = document.getElementsByTagName("script");
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute("src") || "";
            if (src.indexOf("barcode-camera.js") !== -1) {
                return src.replace(
                    /barcode-camera\.js(?:\?.*)?$/,
                    "vendor/zxing-library-0.23.0.min.js"
                );
            }
        }
        return "../js/vendor/zxing-library-0.23.0.min.js";
    }

    function loadZxing() {
        if (global.ZXing && global.ZXing.MultiFormatReader) {
            return Promise.resolve(global.ZXing);
        }
        return new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = vendorSrc();
            script.async = true;
            script.onload = function () {
                if (global.ZXing && global.ZXing.MultiFormatReader) resolve(global.ZXing);
                else reject(new Error("lector"));
            };
            script.onerror = function () {
                reject(new Error("lector"));
            };
            document.head.appendChild(script);
        });
    }

    function nativeCode128() {
        if (typeof global.BarcodeDetector !== "function") return Promise.resolve(null);
        if (typeof global.BarcodeDetector.getSupportedFormats !== "function") {
            return Promise.resolve(null);
        }
        return global.BarcodeDetector.getSupportedFormats()
            .then(function (formats) {
                var ok = (formats || []).some(function (format) {
                    return String(format).toLowerCase() === "code_128";
                });
                if (!ok) return null;
                return new global.BarcodeDetector({ formats: ["code_128"] });
            })
            .catch(function () {
                return null;
            });
    }

    function stopStream(stream) {
        if (!stream || !stream.getTracks) return;
        stream.getTracks().forEach(function (track) {
            try {
                track.stop();
            } catch (_) {
                /* already ended */
            }
        });
    }

    function failureMessage(err) {
        var name = err && err.name;
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            return "No hay permiso para usar la cámara. Puedes escribir el código a mano.";
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
            return "No se encontró una cámara. Puedes escribir el código a mano.";
        }
        if (name === "SecurityError") {
            return "La cámara necesita una conexión segura (HTTPS). Puedes escribir el código a mano.";
        }
        return "No se pudo abrir la cámara. Puedes escribir el código a mano.";
    }

    function openStream() {
        var preferred = {
            audio: false,
            video: { facingMode: { ideal: "environment" } },
        };
        return global.navigator.mediaDevices.getUserMedia(preferred).catch(function (err) {
            if (!err || err.name !== "OverconstrainedError") throw err;
            return global.navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        });
    }

    function buildModal() {
        var modal = document.createElement("div");
        modal.className = "modal modal-escaner activo";
        modal.id = "pawModalCamara";
        modal.innerHTML =
            '<div class="ventana" role="dialog" aria-modal="true" aria-labelledby="pawCamaraTitle">' +
            '<button type="button" class="cerrarModal" data-cam-close aria-label="Cerrar">' +
            '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
            "</button>" +
            '<h2 id="pawCamaraTitle">Escanear código</h2>' +
            '<p class="hint-codigo" data-cam-status>Apunta la cámara al código de barras de la mascota.</p>' +
            '<div class="camara-video-wrap" data-cam-stage>' +
            '<video playsinline autoplay muted data-cam-video></video>' +
            '<div class="camara-guia" aria-hidden="true"></div>' +
            "</div>" +
            '<p class="camara-error" data-cam-error hidden></p>' +
            '<label for="pawCamaraManual">O escribe el código</label>' +
            '<input type="text" id="pawCamaraManual" autocomplete="off" spellcheck="false" placeholder="PAW-000001">' +
            '<div class="modal-acciones">' +
            '<button type="button" class="guardar" data-cam-manual>Buscar</button>' +
            "</div>" +
            "</div>";
        document.body.appendChild(modal);
        return modal;
    }

    function scan(options) {
        if (activeStop) activeStop();
        var opts = options || {};
        var onCode = typeof opts.onCode === "function" ? opts.onCode : function () {};
        var modal = buildModal();
        var video = modal.querySelector("[data-cam-video]");
        var stage = modal.querySelector("[data-cam-stage]");
        var errorEl = modal.querySelector("[data-cam-error]");
        var statusEl = modal.querySelector("[data-cam-status]");
        var manual = modal.querySelector("#pawCamaraManual");
        var stream = null;
        var timer = null;
        var closed = false;
        var delivered = false;
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d", { willReadFrequently: true });

        function showError(message) {
            if (stage) stage.hidden = true;
            if (statusEl) statusEl.hidden = true;
            if (errorEl) {
                errorEl.hidden = false;
                errorEl.textContent = message;
            }
        }

        function stopTracks() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            stopStream(stream);
            stream = null;
            if (video) {
                try {
                    video.pause();
                } catch (_) {
                    /* ignore */
                }
                video.srcObject = null;
            }
        }

        function closeModal() {
            if (closed) return;
            closed = true;
            stopTracks();
            document.removeEventListener("keydown", onKey, true);
            global.removeEventListener("pagehide", onPageHide);
            document.removeEventListener("visibilitychange", onVisibility);
            modal.removeEventListener("click", onBackdrop);
            if (modal.parentNode) modal.parentNode.removeChild(modal);
            if (activeStop === closeModal) activeStop = null;
        }

        function deliver(raw) {
            if (delivered || closed) return;
            var code = normalize(raw);
            if (!code) return;
            delivered = true;
            stopTracks();
            closeModal();
            onCode(code);
        }

        function onKey(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                closeModal();
            }
        }

        function onPageHide() {
            stopTracks();
        }

        function onVisibility() {
            if (document.hidden) {
                stopTracks();
                if (!closed && !delivered) {
                    showError("La cámara se detuvo. Puedes escribir el código a mano.");
                }
            }
        }

        function onBackdrop(event) {
            if (event.target === modal) closeModal();
        }

        activeStop = closeModal;
        document.addEventListener("keydown", onKey, true);
        global.addEventListener("pagehide", onPageHide);
        document.addEventListener("visibilitychange", onVisibility);
        modal.addEventListener("click", onBackdrop);
        modal.querySelector("[data-cam-close]").addEventListener("click", closeModal);
        modal.querySelector("[data-cam-manual]").addEventListener("click", function () {
            deliver(manual.value);
            if (!delivered) manual.focus();
        });
        manual.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                deliver(manual.value);
                if (!delivered) manual.focus();
            }
        });

        function loopNative(detector) {
            if (closed || delivered) return;
            var pending = Promise.resolve([]);
            if (video.readyState >= 2) {
                pending = detector.detect(video).catch(function () {
                    return [];
                });
            }
            pending.then(function (codes) {
                if (closed || delivered) return;
                if (codes && codes[0] && codes[0].rawValue) {
                    deliver(codes[0].rawValue);
                    return;
                }
                timer = setTimeout(function () {
                    loopNative(detector);
                }, 200);
            });
        }

        function loopZxing(ZXing, reader) {
            if (closed || delivered) return;
            var found = "";
            if (video.readyState >= 2 && video.videoWidth && ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                try {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    var source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
                    var bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
                    found = reader.decode(bitmap).getText();
                } catch (_) {
                    found = "";
                    try {
                        reader.reset();
                    } catch (__) {
                        /* ignore */
                    }
                }
            }
            if (found) {
                deliver(found);
                return;
            }
            timer = setTimeout(function () {
                loopZxing(ZXing, reader);
            }, 200);
        }

        function startReader() {
            return nativeCode128().then(function (detector) {
                if (closed) return;
                if (detector) {
                    loopNative(detector);
                    return;
                }
                return loadZxing().then(function (ZXing) {
                    if (closed) return;
                    var reader = new ZXing.MultiFormatReader();
                    var hints = new Map();
                    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128]);
                    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
                    reader.setHints(hints);
                    loopZxing(ZXing, reader);
                });
            });
        }

        if (!global.isSecureContext) {
            showError("La cámara necesita una conexión segura (HTTPS). Puedes escribir el código a mano.");
            return;
        }
        if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
            showError("No se encontró una cámara. Puedes escribir el código a mano.");
            return;
        }

        openStream()
            .then(function (next) {
                if (closed) {
                    stopStream(next);
                    return;
                }
                stream = next;
                video.srcObject = stream;
                return video.play();
            })
            .then(function () {
                if (closed || !stream) return;
                return startReader();
            })
            .catch(function (err) {
                if (closed) return;
                stopTracks();
                if (err && err.message === "lector") {
                    showError("No se pudo preparar el lector. Puedes escribir el código a mano.");
                    return;
                }
                showError(failureMessage(err));
            });
    }

    global.PawBarcodeCamera = { scan: scan, normalize: normalize };
})(window);

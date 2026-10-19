# Estudio del portal web (PAWMYLI)

El portal es HTML, CSS y JavaScript, sin framework. Casi toda la lógica está en archivos `.js`. Cada pantalla llama a la API con `PawApi` (`js/api.js`) y guarda la sesión en el navegador.

Las páginas HTML solo arman la pantalla y cargan esos scripts. La que importa antes de entrar es `index.html`: la portada, con los botones de registro e inicio de sesión. El tablero (`dashboard/`) aparece después de entrar.

No se documenta `js/vendor/zxing-library-0.23.0.min.js`: es la librería ZXing ya compilada, no código del proyecto. Los nombres de campos que van a la API (`email`, `accessToken`, `status`) se dejan en inglés porque el backend los espera así.

## Archivos compartidos

**`js/api.js`.** Es el cliente de la API. Arma cada `fetch`, pone el token `Bearer`, renueva la sesión si llega un 401 y, si el refresco también falla, manda al login. Aquí están las funciones de pacientes, consultas, dieta, citas, bandeja, perfil y subida de fotos. El alta de paciente manda `Idempotency-Key`.

**`js/config.js`.** Decide la URL de la API. En producción usa `PAWMYLI_API_BASE`. En `localhost` acepta un override guardado en `localStorage.pawmyliApiBase`, y solo si esa URL también es local.

**`js/env.js`.** No tiene funciones. Es el objeto que genera `scripts/export-env.js` con la URL de la API y los avatares por defecto. No se edita a mano.

**`scripts/export-env.js`.** Lee el `.env` del portal y escribe `js/env.js`. Lo usa el build de Vercel.

**`js/escape.js`.** Convierte texto a HTML seguro (`escapeHtml`) y acepta solo URLs de imagen `https`, `blob` o `data:image` (`safeImageUrl`). Evita que un dato de la API se interprete como código.

**`js/device.js`.** Dice si el navegador es teléfono o tablet. Un portátil, aunque tenga pantalla táctil, cuenta como escritorio. Sirve para mostrar la cámara del código solo en móvil.

**`js/species.js`.** Catálogo de especies del formulario. Separa las que piden raza, las que piden tipo y las que no piden detalle. Llena el selector y lee el valor elegido.

**`js/toast.js`.** Avisos que no bloquean la página (`PawToast.show`): éxito, error, aviso o información. Se cierran solos.

**`js/paw-ui.js`.** Diálogos propios del portal: confirmar, pedir un dato o mostrar un aviso. Sustituye a `confirm`, `prompt` y `alert` del navegador.

**`js/code-modal.js`.** Ventana para escribir o escanear el código `PAW-`. La usa el lector USB y el flujo de vinculación.

**`js/barcode-local.js`.** Dibuja el Code 128 del código PAW dentro de la página con JsBarcode. Si la librería no carga, deja el código en texto.

**`js/barcode-camera.js`.** Abre la cámara, lee un Code 128 y devuelve el texto. Prueba el lector nativo del navegador y, si no está, usa ZXing.

**`js/barcode-hid.js`.** Entiende el lector USB que escribe como teclado (Motorola LS1203). Junta la ráfaga de teclas y, al terminar, entrega el código. Ignora la escritura lenta de una persona.

## Pantallas

**`auth/auth.js`.** Registro e inicio de sesión del veterinario. Muestra u oculta la contraseña, valida el formulario, guarda la sesión y entra al tablero solo si el token sigue vigente. `cerrarSesion` avisa a la API y limpia el navegador.

**`dashboard/app.js`.** Tablero de después de entrar. Muestra citas del día, la semana y las solicitudes que el veterinario puede aceptar. No crea pacientes.

**`pacientes/paciente.js`.** Lista, búsqueda y alta de mascotas. Ordena desvinculadas, pendientes y vinculadas. El veterinario aprueba o rechaza solicitudes de vínculo. También descarga el código de barras y, si hace falta, migra códigos viejos.

**`perfil/perfil.js`.** Ficha de una mascota: datos, consultas, dieta y registros de comida. Arma el formulario según el tipo de consulta, propone horarios a partir de la receta y guarda el plan de alimentación. La edad se conserva como texto (“2 años 3 meses”).

**`agenda/agenda.js`.** Calendario mensual. Carga las citas del mes, filtra por pendientes, hechas o canceladas, y deja crear, aceptar o cancelar. El gris muestra todos los estados.

**`correo/app.js`.** Bandeja interna. Lista mensajes, marca leídos y, si el mensaje es una solicitud de cita, deja aceptar, rechazar o proponer otra fecha y hora.

**`configuracion/configuracion.js`.** Perfil del veterinario y datos de la clínica. Carga los formularios desde la sesión y la API. La foto se sube con URL firmada; si eso falla, se guarda como data URL.

**`landing.js`.** Animación de la portada (`index.html`). Muestra los bloques de funciones cuando entran en pantalla. No llama a la API.

## Pruebas

Están en `tests/`. No forman la aplicación: simulan la API en el navegador.

- `tests/unit/` prueba funciones sueltas (dispositivo, hora de comida, escape).
- `tests/e2e/` recorre pantallas con Playwright: cámara, responsive, textos peligrosos y arreglos de sesión.
- `tests/serve.js` sirve el sitio en local para esas pruebas.
- `tests/generate-barcode-fixture.js` genera el video falso del código de barras.

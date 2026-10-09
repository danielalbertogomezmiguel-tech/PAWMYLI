# Pawmyli — Sistema de Gestión Veterinaria

Dashboard web para administrar pacientes, citas, perfiles y configuración de una clínica veterinaria.

## Estructura

```
├── auth/          Login y registro (localStorage)
├── dashboard/     Inicio con stats, consultas del día, recordatorios
├── pacientes/     Lista de pacientes + formulario de registro
├── perfil/        Perfil detallado del paciente, edición, historial médico, código de barras
├── agenda/        Calendario mensual + CRUD de citas
├── configuracion/ Perfil del doctor, datos de la clínica, preferencias
└── img/           Imágenes locales
```

## Funcionalidad

- **Pacientes:** registro con código único (PAW-XXXXXX), búsqueda, edición, foto.
- **Perfil:** datos del paciente, propietario, alimentación, historial médico. Código de barras generado automáticamente.
- **Agenda:** calendario navegable, creación y eliminación de citas, persistencia en localStorage.
- **Configuración:** perfil del veterinario, datos de la clínica, preferencias (idioma, zona horaria, tema, notificaciones).
- **Auth:** registro e inicio de sesión con validación y persistencia en localStorage.
- **Barra lateral:** navegación entre todas las secciones con diseño responsivo.

Todos los datos se guardan en `localStorage` (página única, sin backend).

## Código de barras

El código PAW se dibuja en el navegador con JsBarcode. Si esa librería no carga, la página muestra el código en texto. El código no se envía a ningún servicio externo.

## Pruebas

No usan la API real: las unitarias prueban funciones puras y las de extremo a extremo simulan la API en el navegador.

```bash
npm install
npx playwright install chromium
npm test
```

- `npm run test:unit` — node:test (escape de HTML, URLs de imagen y override de la API).
- `npm run test:e2e` — Playwright, con el sitio servido en local.
- `npm test` — las dos.

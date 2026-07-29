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

## API de Código de Barras (TEC-IT)

Endpoint:

```
https://barcode.tec-it.com/barcode.ashx
```

Parámetros usados en el perfil del paciente:

| Parámetro  | Valor       | Descripción                                  |
|------------|-------------|----------------------------------------------|
| `data`     | PAW-XXXXXX  | Código único del paciente                    |
| `code`     | Code128     | Simbología de código de barras               |
| `dpi`      | 96          | Resolución de la imagen                      |
| `imagetype`| png         | Formato de salida                            |

EJemplo de uso en `perfil/perfil.js:106`:

```js
`https://barcode.tec-it.com/barcode.ashx?data=${codigo}&code=Code128&dpi=96&imagetype=png`
```

Code128 es ideal para datos alfanuméricos como los códigos PAW-XXXXXX. La imagen se asigna directamente al `src` de un `<img>`.

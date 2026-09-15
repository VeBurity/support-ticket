# Frontend — Plataforma de gestión de tickets de soporte

React + TypeScript + Vite + TanStack Query + React Hook Form + Zod +
shadcn/ui + Tailwind. Ver el `README.md` en la raíz del repo para cómo
levantar todo el proyecto (backend, Postgres, seed).

## Requisitos

| Software | Versión | Notas |
|---|---|---|
| Node.js | ≥ 20 LTS (probado con 24.20.0) | `node -v` |
| npm | ≥ 10 (probado con 11.19.0) | viene con Node |
| Backend | corriendo en `http://localhost:3000` | ver `../backend/README.md` |

Dependencias principales (ver `package.json` para la lista completa
con sub-dependencias):

| Paquete | Versión | Rol |
|---|---|---|
| `react` / `react-dom` | ^19.2.8 | UI |
| `vite` / `@vitejs/plugin-react` | ^8.2.2 / ^6.1.0 | bundler/dev server |
| `react-router-dom` | ^7.18.3 | rutas |
| `@tanstack/react-query` | ^5.102.8 | data fetching, cache, invalidación |
| `react-hook-form` / `@hookform/resolvers` | ^7.87.0 / ^5.9.1 | formularios |
| `zod` | ^4.6.0 | validación (espejo de los DTOs del backend) |
| `zustand` | ^5.0.15 | store de sesión (access token en memoria) |
| `tailwindcss` / `@tailwindcss/vite` | ^4.3.3 | estilos |
| `radix-ui` / `cmdk` / `sonner` | ^1.6.7 / ^1.1.1 / ^2.0.8 | primitivos de shadcn/ui, combobox, toasts |
| `shadcn` (CLI, devDependency) | fijado en 3.8.5 al generar componentes | ver `README-fase3b-notas.md` — la v4 del CLI falla en este layout de proyecto |
| `typescript` | ~6.0.2 | tipado |

`npm install` instala todo lo anterior automáticamente a partir de
`package.json` / `package-lock.json` — esta tabla es solo para saber
qué esperar antes de instalar. `shadcn` solo se usa puntualmente para
generar nuevos componentes (`npx shadcn@3.8.5 add <componente>`), no en
el build ni en runtime.

## Comandos

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
```

## Documentación

- Diseño de rutas, manejo de tokens, vistas: `../docs/02-diseno-frontend.md`
- Decisiones y desviaciones tomadas al implementar: `README-fase3b-notas.md`

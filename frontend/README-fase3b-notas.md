# Notas de implementación — Fase 3b

Desviaciones y decisiones no cubiertas literalmente por
`docs/02-diseno-frontend.md`, y bugs reales encontrados al probar en
navegador.

## 1. Tailwind v4 + shadcn/ui (CLI v3.8.5, no v4)

Tailwind se instaló en su versión 4 (setup vía `@tailwindcss/vite`, sin
`tailwind.config.js` ni PostCSS manual — es el flujo actual
recomendado). Para shadcn/ui se usó explícitamente `shadcn@3.8.5` en
vez de `shadcn@latest` (v4.21.0): la v4 del CLI falla con
"Could not load the workspace config" en este layout de proyecto
(Vite simple, sin monorepo) — es una versión muy nueva con una re-arquitectura
de "workspaces" que no está madura para este caso. La v3.8.5 es estable
y funciona con Tailwind v4 sin problema.

## 2. Zod 4 / React Hook Form 7 / TanStack Query 5

Versiones más recientes disponibles al momento de instalar. No se fijó
ninguna versión anterior porque, a diferencia de Prisma 8 o `nest new`
en modo ESM, no rompen ningún patrón usado por el diseño del documento
(los schemas de Zod y las query keys de TanStack Query del contrato se
implementaron literalmente).

## 3. Paginación: `meta.nextCursor` en vez de `page/pageSize/total`

El contrato de éxito de la API (`00-arquitectura-y-decisiones.md`)
muestra `meta: { page, pageSize, total }` como ejemplo, pero la
paginación de tickets es explícitamente por cursor (convención en
`CLAUDE.md` y DTO `ListTicketsQueryDto` con `cursor`/`limit`, no
`page`). El frontend usa `useInfiniteQuery` de TanStack Query
consumiendo `meta.nextCursor` — es la adaptación correcta de ese
ejemplo genérico a paginación por cursor, no una inconsistencia.

## 4. Bug real: `AuthBootstrap` no restauraba la sesión al recargar

`src/app/providers.tsx` llamaba `me()` inmediatamente después de
`refresh()`, sin antes guardar el `accessToken` recién obtenido en el
store de Zustand. Como `apiFetch` lee el token del store en cada
request, `GET /auth/me` salía sin `Authorization` → 401 → la sesión se
daba por cerrada aunque el refresh hubiera funcionado. Efecto visible:
cualquier recarga completa de página (F5, o navegar escribiendo una
URL) expulsaba al usuario al login, aunque la cookie de refresh fuera
válida. Corregido llamando `setAccessToken(accessToken)` antes de
`me()`. Verificado en navegador real tras el fix: recargar `/`,
`/tickets/new`, etc. mantiene la sesión.

## 5. Bug real: historial de ticket disparaba un 403 visible para agentes sin acceso

`GET /tickets/:id/history` es 403 (`FORBIDDEN_OWNERSHIP`) para un
Agente que no es dueño del ticket — comportamiento correcto del
backend (doc §4: "Agente (solo si el ticket es suyo)"). Pero
`TicketDetailPage` pedía ese historial sin condición, así que ese 403
esperado aparecía como un toast de error rojo en pantalla. Corregido:
la query de historial ahora solo se habilita (`enabled`) cuando el
usuario tiene permiso (Admin/Supervisor siempre, Agente solo si
`assignedToId === user.id`), y la tarjeta "Historial" completa se
oculta en vez de mostrarse vacía o con error.

## 6. Combobox de cliente con alta rápida inline

`CustomerCombobox` (Popover + Command de shadcn) hace debounce de
300ms como pide el documento, y su estado vacío ofrece
"Crear cliente "<busqueda>"" que abre `CustomerCreateDialog`. Al crear,
selecciona automáticamente el cliente nuevo en el formulario de
ticket — no estaba detallado a ese nivel en el documento, es la
interpretación razonable de "opción de alta rápida inline".

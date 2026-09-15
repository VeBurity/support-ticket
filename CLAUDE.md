# CLAUDE.md — Support Ticket Platform

Prueba técnica Tech Lead Full Stack JS: plataforma interna de gestión
de tickets de soporte (auth + RBAC, tickets, dashboard, React + Node +
SQL, objetivo AWS).

## Antes de escribir código

Lee `docs/00-arquitectura-y-decisiones.md`. Ahí están tomadas y
justificadas las decisiones de stack, modelo de datos, estados,
prioridades/SLA, RBAC y seguridad. No te desvíes de ellas sin decírselo
explícitamente al usuario y explicar por qué.

## Stack (fijo — no renegociar sin avisar)

- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Auth: JWT access (~15 min) + refresh (7 días, rotado) + bcrypt
- Frontend: React + TypeScript + Vite + TanStack Query + React Hook
  Form + Zod + shadcn/ui + Tailwind
- Infra objetivo: AWS (S3+CloudFront, ECS Fargate o App Runner, RDS
  PostgreSQL) — desarrollo local con Docker Compose

## Estado del proyecto

- [x] **Fase 1** — Análisis y arquitectura → `docs/00-arquitectura-y-decisiones.md`
- [x] **Fase 2a** — Diseño detallado del backend (schema Prisma
      completo, catálogo de endpoints con permisos exactos, DTOs,
      catálogo de errores, estructura de archivos) →
      `docs/01-diseno-api-backend.md`. **Es el contrato a implementar
      — no lo renegocies al codear, si algo no calza, se vuelve
      aquí primero.**
- [x] **Fase 2b** — Backend: scaffold (`nest new backend`), Prisma
      schema + migración inicial aplicada, todos los módulos de §8
      implementados (auth con cookie httpOnly de refresh rotado,
      RBAC de dos niveles, máquina de estados, tickets/comments,
      dashboard). Probado en caliente contra Postgres local: login,
      refresh/rotación/reuse, bloqueo de usuario, scope por rol,
      máquina de estados y dashboard responden como en el contrato.
      Ver `backend/README-fase2b-notas.md` para desviaciones menores
      del contrato y por qué.
- [x] **Fase 3a** — Diseño detallado del frontend (rutas, manejo de
      tokens, query keys, schemas Zod espejo de los DTOs, vistas,
      estructura de archivos) → `docs/02-diseno-frontend.md`. Este
      diseño ajustó la Fase 2a (refresh token pasó de body a cookie
      httpOnly) — el ajuste ya está reflejado en ambos documentos, no
      hay inconsistencia entre ellos.
- [x] **Fase 3b** — Frontend: scaffold (Vite + React + TS + Tailwind v4
      + shadcn/ui), implementadas todas las vistas de la §5 de
      `docs/02-diseno-frontend.md` (login, dashboard por rol, listado
      con filtros en URL y paginación por cursor, detalle con
      acciones/comentarios/historial, creación con combobox de
      cliente, gestión de usuarios). Probado en navegador real contra
      el backend: login/logout, refresh de sesión tras recargar
      página, scope de tickets por rol, RBAC oculto en UI, bloqueo de
      usuario. Dos bugs reales encontrados y corregidos durante la
      prueba: `AuthBootstrap` no guardaba el access token antes de
      pedir `/auth/me` (rompía la restauración de sesión al recargar),
      y el historial del ticket se pedía sin verificar permisos
      (mostraba un toast de error 403 a un agente sin acceso en vez de
      ocultar la sección). Ver `frontend/README-fase3b-notas.md`.
- [x] **Fase 4** — `queries.sql` (las 8 consultas del enunciado,
      confirmadas por el usuario a partir del PDF original) + script de
      datos semilla (`backend/prisma/seed.js`, `npm run seed`): 20
      clientes, 7 usuarios de staff y 400 tickets con historial de
      estado/reasignación simulado de forma realista (createdAt
      repartido en 60 días, updatedAt retrocedido cuando corresponde
      para que la consulta de "48h sin actualización" tenga resultados
      reales). Las 8 consultas se corrieron contra los datos semilla y
      devuelven resultados no triviales — verificado con `psql -f
      queries.sql`.
- [x] **Fase 5** — `README.md` final en la raíz del repo (instrucciones
      completas de instalación, credenciales de demo, enlaces a las
      decisiones de arquitectura, declaración honesta de uso de IA con
      estimado de %). `docker-compose.yml` ya existía desde la Fase 2b.
      `backend/README.md` y `frontend/README.md` reemplazados (traían
      el boilerplate de `nest new`/`create-vite`) por punteros cortos al
      README raíz y a sus notas de implementación. Se eliminaron
      artefactos de build sueltos (`tsconfig.build.tsbuildinfo`) y se
      verificó que backend y frontend compilan y buildean limpio.
- [x] **Fase 6** — checklist de sustentación →
      `docs/03-checklist-sustentacion.md` (tabla de decisiones citables,
      preguntas esperadas con respuesta corta, trade-offs conocidos, y
      un guion de demo en vivo)

## Convenciones

- Respuesta API éxito: `{ success: true, data, meta? }`
- Respuesta API error: `{ success: false, error: { code, message, details } }`
- RBAC en dos niveles: guard de rol (`@Roles(...)`) a nivel de endpoint
  + chequeo de ownership en el Service (un agente solo opera sobre sus
  tickets asignados)
- Tablas en `snake_case`, código TypeScript en `camelCase`
- Todo cambio de estado o de asignación se audita en
  `ticket_status_history` / `ticket_assignment_history` — nunca se
  sobreescribe sin dejar rastro
- Paginación de listados: cursor/keyset, no `OFFSET`

## Comandos esperados (una vez scaffoldeado)

```bash
docker compose up -d                 # Postgres local
cd backend && npm install && npx prisma migrate dev && npm run start:dev
cd backend && npm run seed           # datos de demo (resetea tickets/clientes)
psql "$DATABASE_URL" -f queries.sql  # las 8 consultas requeridas
cd frontend && npm install && npm run dev
```

## Nota

La Fase 1 se hizo en conversación con Claude (claude.ai), incluyendo
lectura completa del PDF del reto y del documento de sustentación. La
declaración de uso de IA (qué se usó, para qué, y qué % de la prueba)
que pedía el reto ya está en el `README.md` de la raíz, sección
"Uso de IA".

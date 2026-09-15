# Notas de implementación — Fase 2b

Desviaciones menores respecto al contrato de `docs/01-diseno-api-backend.md`,
y por qué. Todo lo demás (endpoints, DTOs, catálogo de errores, RBAC,
máquina de estados, estructura de carpetas) está implementado tal cual
está especificado.

## 1. CommonJS en vez de ESM

`nest new` (versión actual del CLI) scaffoldea por defecto un proyecto
ESM (`"type": "module"`, imports con `.js`, Vitest, oxlint). Se revirtió
a CommonJS clásico (`module: commonjs` en `tsconfig.json`, sin `.js` en
los imports) porque el ecosistema Prisma + Passport + bcrypt está mucho
mejor probado y documentado en CommonJS, y evita el footgun de tener que
poner `.js` en cada import relativo de decenas de archivos. Se mantuvo
Vitest (ya scaffoldeado) en vez de migrar a Jest.

## 2. Prisma fijado en 6.19.3, no "latest"

La versión `latest` de `prisma`/`@prisma/client` en npm es un release
candidate de Prisma 8 (`8.0.0-rc.x`) que **rompe** el patrón
`datasource db { url = env("DATABASE_URL") }` usado literalmente en el
`schema.prisma` del contrato (exige mover la URL a `prisma.config.ts` +
un "driver adapter"). Se fijó la última versión estable de la serie 6
(`6.19.3`), que soporta el schema tal como está escrito en el
documento, sin reescribirlo.

## 3. Campo `Ticket.sequence` (autoincrement) — no está en el contrato

Se añadió un campo interno `sequence Int @default(autoincrement()) @unique`
al modelo `Ticket`, no expuesto como "nuevo campo de negocio" sino como
mecanismo para generar el `folio` (`TCK-00042`) de forma atómica y sin
condición de carrera, aprovechando el `SERIAL` de Postgres en vez de
hacer `COUNT(*) + 1` o una secuencia manual. El folio se calcula dentro
de la misma transacción de creación del ticket.

## 4. Refresh token opaco, no JWT firmado

El refresh token viaja como `<id>.<secret aleatorio>` (no como JWT), con
solo el hash bcrypt del secreto guardado en `refresh_tokens.tokenHash`.
Esto es consistente con la razón que el propio documento da para que
`refresh_tokens` exista como tabla propia (rotación + logout de una sola
sesión sin tocar `tokenVersion`). Efecto colateral: la variable de
entorno `JWT_REFRESH_SECRET` (listada en §7 del contrato) queda sin uso
real — se deja declarada en `.env.example` por fidelidad al documento,
pero no la consume ningún código.

## 5. Postgres nativo en Windows en vez de Docker

Docker Desktop no pudo iniciar en esta máquina ("Virtualization support
not detected"). Se instaló PostgreSQL 17 nativo vía `winget` para poder
probar el backend en caliente (login, refresh/rotación, bloqueo de
usuario, RBAC, máquina de estados, dashboard — todo verificado con
`curl` contra un servidor real). `docker-compose.yml` en la raíz del
repo sigue siendo la forma prevista de levantar Postgres en una máquina
con Docker funcional; no depende de nada de lo anterior.

## 6. Columnas de la base en camelCase, no snake_case

El `schema.prisma` del contrato usa `@@map` para las tablas (snake_case)
pero no usa `@map` por campo — los nombres de columna quedan tal cual el
campo Prisma (`passwordHash`, no `password_hash`). Se implementó
exactamente así, sin agregar mapeos que no estaban en el documento. Esto
afecta a `queries.sql` (Fase 4): las columnas ahí deberán citarse entre
comillas dobles con su nombre camelCase real, no snake_case.

## 7. Rate limiting: baseline global + límite estricto en login

Se registró `ThrottlerGuard` como guard global (100 req/min por IP) y
además un límite más estricto (`5 req/min`) específico en
`POST /auth/login` vía `@Throttle`. El documento solo pedía limitar
"endpoints sensibles"; el baseline global es una capa adicional de
defensa que no contradice eso.

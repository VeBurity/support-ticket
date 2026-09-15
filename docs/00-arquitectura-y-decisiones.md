# Fase 1 — Análisis, Arquitectura y Modelo de Datos

## 1. Punto de partida

El enunciado deja deliberadamente varios bloques incompletos (marcados con
`...`): campos del ticket, estados, prioridades, filtros del listado,
métricas del dashboard, contenido del detalle, validaciones de la API y
entidades del modelo de datos. Esto se interpreta como parte de la
evaluación: se espera que el candidato tome esas decisiones y las
defienda, no que las adivine.

Esta sección documenta **qué se decidió, y por qué**, para poder
sustentarlo con seguridad.

---

## 2. Decisiones que completan los puntos abiertos del enunciado

### 2.1 Campos del ticket

| Campo | Notas |
|---|---|
| `id` | UUID v4 (evita IDs secuenciales adivinables; más seguro en URLs públicas de API) |
| `folio` | Identificador corto legible (ej. `TCK-00042`) para UI y comunicación con el cliente |
| `customer_id` | Cliente asociado (FK) |
| `title` | Título |
| `description` | Descripción larga |
| `status` | Ver 2.2 |
| `priority` | Ver 2.3 |
| `category` | Área/categoría (ej. Facturación, Soporte técnico, Accesos) — pensado para "múltiples áreas" a futuro |
| `channel` | Origen: web, email, teléfono, manual — trazabilidad del canal |
| `assigned_to` | Agente asignado (FK a users, nullable) |
| `created_by` | Usuario que creó el ticket (FK a users) |
| `created_at` / `updated_at` | Timestamps estándar |
| `closed_at` | Se llena al cerrar; se limpia al reabrir |
| `sla_due_at` | Calculado según prioridad al crear/reasignar; usado para "vencidos" |
| `reassignment_count` | Contador desnormalizado, actualizado por trigger o por servicio, para no tener que agregar sobre el historial en cada consulta |

Justificación clave: `sla_due_at` y `reassignment_count` son campos
"calculados" que se podrían derivar en cada query, pero se
desnormalizan porque se necesitan en consultas de alta frecuencia
(dashboard, listado, query obligatoria #7) — es un trade-off explícito
de lectura-rápida vs. escritura-un-poco-más-cara, razonable para este
dominio (muchas más lecturas que escrituras).

### 2.2 Estados (con máquina de estados simple)

```
Abierto → En progreso → Pendiente cliente → Resuelto → Cerrado
                ↑______________________________|
                    (Reabierto vuelve a "En progreso")
```

- `abierto`, `en_progreso`, `pendiente_cliente`, `resuelto`, `cerrado`,
  con transición de reapertura desde `resuelto` o `cerrado` de vuelta a
  `en_progreso`.
- Solo Administrador y Supervisor pueden cerrar/reabrir libremente; un
  Agente solo puede mover sus propios tickets a través de los estados
  operativos (no cerrar directamente, según el enunciado: "puede cambiar
  el estado de sus tickets asignados" pero cerrar es explícito de Admin).
- Cada cambio de estado queda registrado en `ticket_status_history`
  (auditoría, y de ahí sale la query de tiempo promedio de resolución).

### 2.3 Prioridades + SLA

| Prioridad | SLA de primera respuesta / actualización |
|---|---|
| Baja | 72 h |
| Media | 48 h |
| Alta | 24 h |
| Crítica | 8 h |

El SLA de "Media" (48h) coincide con el umbral pedido en la consulta
SQL obligatoria #3, no es casualidad: se diseñó la tabla de SLAs
pensando en que esa consulta sea una comparación directa contra
`sla_due_at`, no un cálculo ad-hoc.

### 2.4 Filtros del listado

Estado, prioridad, cliente, agente asignado, categoría, rango de
fechas de creación, texto libre (busca en título), y un filtro rápido
"vencidos" (sla_due_at < now() y status no en cerrado/resuelto).
Paginación server-side obligatoria desde el día uno (ver §7, volumen).

### 2.5 Métricas del dashboard

Tickets abiertos (total y por estado), tickets vencidos, distribución
por prioridad, tiempo promedio de resolución (últimos 30 días), y —
según el rol— "mis tickets asignados" (agente) o "tickets por agente"
(supervisor/admin). Se prioriza reutilizar las mismas consultas de
`queries.sql` como fuente de estas métricas, para no mantener dos
implementaciones de la misma lógica de negocio.

### 2.6 Detalle de ticket

Info completa + comentarios (públicos vs. internos — internos solo
visibles para Agente/Supervisor/Admin) + historial de estado +
historial de reasignación + SLA countdown visual.

### 2.7 API — validación, errores, respuestas

- Validación de entrada con DTOs + `class-validator` (rechaza en el
  borde, nunca llega basura a la capa de servicio).
- Manejo de errores centralizado vía **exception filter global**:
  toda excepción de negocio, de validación o inesperada sale con la
  misma forma.
- Formato de respuesta consistente:

```json
// éxito
{ "success": true, "data": { ... }, "meta": { "page": 1, "pageSize": 20, "total": 134 } }

// error
{ "success": false, "error": { "code": "TICKET_NOT_FOUND", "message": "...", "details": null } }
```

---

## 3. Stack tecnológico y justificación

| Capa | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript (front y back) | Tipado end-to-end, menos bugs en runtime, más fácil de mantener/onboardear en un equipo que crece — relevante para un rol Lead |
| Backend | **NestJS** sobre Express | Guards, Interceptors, Pipes y Exception Filters mapean 1:1 con los requisitos explícitos (RBAC, respuestas consistentes, manejo centralizado de errores, validación). Da estructura modular sin reinventar arquitectura a mano. Alternativa considerada: Express "pelado" — más rápido de arrancar pero obliga a construir a mano lo que Nest da de fábrica; con 8–14h de presupuesto, Nest ahorra tiempo neto |
| ORM | **Prisma** | Migraciones versionadas, tipado generado desde el esquema, buen soporte de índices y transacciones. `queries.sql` se escribe aparte, a mano, en SQL puro (es un requisito explícito, no se genera desde el ORM) |
| Base de datos | PostgreSQL | Window functions (útiles para las consultas de promedios/rankings pedidas), buen soporte en RDS, extensible |
| Auth | JWT (access ~15 min + refresh ~7 días, rotado) + bcrypt | Sin estado en el access token → escala horizontal sin sticky sessions; el refresh con rotación permite revocar sin mantener sesión completa en memoria |
| Frontend | React + TypeScript + Vite | Pedido explícitamente; Vite por velocidad de desarrollo |
| Data fetching | TanStack Query | Cache, invalidación y estados de loading/error "gratis" — reduce boilerplate en un dashboard con varias vistas que refrescan datos |
| Formularios | React Hook Form + Zod | Validación consistente cliente/servidor (mismo enfoque declarativo que los DTOs del backend) |
| UI | shadcn/ui + Tailwind | Componentes accesibles por defecto, look profesional sin invertir tiempo en diseño desde cero |

---

## 4. Arquitectura general

```
support-ticket-platform/
├── backend/     → API REST (NestJS)
├── frontend/    → SPA (React)
├── docs/        → decisiones, ERD, diagramas
└── queries.sql  → consultas SQL requeridas (fase 4)
```

Backend en capas: `Controller → Service → Repository (Prisma) → DB`.
El control de acceso ocurre en dos niveles:

1. **Guard de rol** (declarativo, `@Roles('admin','supervisor')`) — bloquea
   antes de entrar al controlador.
2. **Chequeo de ownership en el Service** — un Agente solo puede
   modificar tickets donde `assigned_to === user.id`; esto no se puede
   resolver solo con un Guard de rol porque depende del dato, así que
   vive en la capa de negocio.

Este esquema de permisos se modela como tabla de política
(rol → acción → alcance) en vez de `if/else` dispersos, precisamente
para que agregar un cuarto rol en el futuro sea configuración, no
reescritura.

---

## 5. Modelo de datos (entidades principales)

- **users** (id, name, email, password_hash, role, status[active/blocked], token_version, created_at)
- **customers** (id, name, email, company, created_at)
- **tickets** (ver §2.1)
- **ticket_comments** (id, ticket_id, author_id, body, is_internal, created_at)
- **ticket_status_history** (id, ticket_id, from_status, to_status, changed_by, changed_at)
- **ticket_assignment_history** (id, ticket_id, from_user_id, to_user_id, changed_by, changed_at) → de aquí sale la query de "reasignados más de 2 veces" y se mantiene `tickets.reassignment_count`

El diagrama de abajo resume las relaciones.

---

## 6. Seguridad (detalle para sustentación)

- **Contraseñas**: bcrypt, nunca en texto plano ni en logs.
- **Bloqueo de usuario** (pedido explícito en la sustentación): el
  campo `users.status` se revisa en **cada request autenticado**, no
  solo en el login — un JWT válido pero de un usuario bloqueado debe
  rechazarse igual. Para no pegarle a la DB en cada request, se usa
  `token_version`: al bloquear a un usuario se incrementa ese número,
  se embebe la versión en el JWT al emitirlo, y el guard compara;
  si no coincide, el token quedó invalidado sin necesidad de una
  blocklist en Redis. Login además queda bloqueado directamente si
  `status = blocked`.
- RBAC en dos niveles (§4).
- Rate limiting en endpoints sensibles (login, creación masiva).
- Helmet + CORS restringido al origen del frontend.
- Toda entrada pasa por DTOs validados; el ORM parametriza queries
  (mitiga inyección SQL) — y en `queries.sql`, al ser SQL a mano, se
  documentará igual con parámetros nombrados, no concatenación.
- Auditoría de negocio "gratis" vía `ticket_status_history` /
  `ticket_assignment_history`.

## 7. Pensado para volumen (millones de registros)

- Índices sobre `customer_id`, `status`, `priority`, `assigned_to`,
  `updated_at` (las columnas por las que se filtra/ordena todo el
  tiempo).
- Paginación **keyset/cursor** en listados grandes en vez de
  `OFFSET`, que se degrada linealmente con el tamaño de la tabla.
- Selección explícita de columnas, nunca `SELECT *`.
- Dashboard con cache de corta duración (TTL de segundos/minutos) para
  no recalcular agregados en cada render.
- A futuro: read replica dedicada a reportes/analítica para no competir
  con el tráfico transaccional, y particionar `tickets` por fecha si el
  volumen lo justifica.

## 8. AWS objetivo

Frontend (S3 + CloudFront) · Backend (ECS Fargate detrás de ALB, o App
Runner como alternativa más simple) · DB (RDS PostgreSQL) · Secrets
Manager para credenciales · CloudWatch para logs/métricas · CI/CD con
GitHub Actions. Se documenta como arquitectura objetivo; el desarrollo
local usa Docker Compose con el mismo contrato de variables de entorno,
para que el paso a AWS sea configuración y no reescritura.

## 9. Roadmap de las fases siguientes

- **Fase 2** — Backend: proyecto Nest, Prisma schema + migraciones,
  auth (JWT + bloqueo), RBAC, CRUD de tickets, comentarios, endpoints
  de dashboard.
- **Fase 3** — Frontend: login, dashboard, listado con filtros,
  detalle, creación.
- **Fase 4** — `queries.sql` (las 8 consultas) + script de datos semilla
  con volumen suficiente para que las consultas sean demostrables.
- **Fase 5** — `README.md` final (declaración de uso de IA, instalación,
  decisiones), Docker Compose, pulido.
- **Fase 6** — Checklist de sustentación (por qué de cada decisión, qué
  preguntas esperar).

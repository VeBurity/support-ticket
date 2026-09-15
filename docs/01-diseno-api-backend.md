# Fase 2a — Diseño detallado del backend

Este documento es el contrato que debe seguir el scaffold (Fase 2b).
Todo lo que está aquí es lo que se implementa; si algo no está aquí,
no se improvisa — se vuelve a este documento primero.

---

## 1. Schema de Prisma (completo)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  AGENT
  SUPERVISOR
}

enum UserStatus {
  ACTIVE
  BLOCKED
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  PENDING_CUSTOMER
  RESOLVED
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TicketChannel {
  WEB
  EMAIL
  PHONE
  MANUAL
}

enum TicketCategory {
  BILLING
  TECHNICAL_SUPPORT
  ACCESS
  OTHER
}

model User {
  id           String     @id @default(uuid())
  name         String
  email        String     @unique
  passwordHash String
  role         Role
  status       UserStatus @default(ACTIVE)
  tokenVersion Int        @default(0)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  ticketsCreated  Ticket[] @relation("CreatedBy")
  ticketsAssigned Ticket[] @relation("AssignedTo")
  comments        TicketComment[]

  statusChangesBy     TicketStatusHistory[]     @relation("StatusChangedBy")
  assignmentChangesBy TicketAssignmentHistory[] @relation("AssignChangedBy")
  assignedFromEvents  TicketAssignmentHistory[] @relation("AssignFromUser")
  assignedToEvents    TicketAssignmentHistory[] @relation("AssignToUser")

  refreshTokens RefreshToken[]

  @@map("users")
}

model RefreshToken {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  tokenHash      String
  createdAt      DateTime  @default(now())
  expiresAt      DateTime
  revokedAt      DateTime?
  replacedByHash String?

  @@index([userId])
  @@map("refresh_tokens")
}

model Customer {
  id        String   @id @default(uuid())
  name      String
  email     String
  company   String?
  createdAt DateTime @default(now())

  tickets Ticket[]

  @@map("customers")
}

model Ticket {
  id                String         @id @default(uuid())
  folio             String         @unique
  customerId        String
  customer          Customer       @relation(fields: [customerId], references: [id])
  title             String
  description       String
  status            TicketStatus   @default(OPEN)
  priority          TicketPriority
  category          TicketCategory
  channel           TicketChannel  @default(WEB)
  assignedToId      String?
  assignedTo        User?          @relation("AssignedTo", fields: [assignedToId], references: [id])
  createdById       String
  createdBy         User           @relation("CreatedBy", fields: [createdById], references: [id])
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  closedAt          DateTime?
  slaDueAt          DateTime
  reassignmentCount Int            @default(0)

  comments          TicketComment[]
  statusHistory     TicketStatusHistory[]
  assignmentHistory TicketAssignmentHistory[]

  @@index([status])
  @@index([priority])
  @@index([customerId])
  @@index([assignedToId])
  @@index([updatedAt])
  @@map("tickets")
}

model TicketComment {
  id         String   @id @default(uuid())
  ticketId   String
  ticket     Ticket   @relation(fields: [ticketId], references: [id])
  authorId   String
  author     User     @relation(fields: [authorId], references: [id])
  body       String
  isInternal Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([ticketId])
  @@map("ticket_comments")
}

model TicketStatusHistory {
  id          String        @id @default(uuid())
  ticketId    String
  ticket      Ticket        @relation(fields: [ticketId], references: [id])
  fromStatus  TicketStatus?
  toStatus    TicketStatus
  changedById String
  changedBy   User          @relation("StatusChangedBy", fields: [changedById], references: [id])
  changedAt   DateTime      @default(now())

  @@index([ticketId])
  @@map("ticket_status_history")
}

model TicketAssignmentHistory {
  id          String   @id @default(uuid())
  ticketId    String
  ticket      Ticket   @relation(fields: [ticketId], references: [id])
  fromUserId  String?
  fromUser    User?    @relation("AssignFromUser", fields: [fromUserId], references: [id])
  toUserId    String?
  toUser      User?    @relation("AssignToUser", fields: [toUserId], references: [id])
  changedById String
  changedBy   User     @relation("AssignChangedBy", fields: [changedById], references: [id])
  changedAt   DateTime @default(now())

  @@index([ticketId])
  @@map("ticket_assignment_history")
}
```

**Decisión añadida respecto a la Fase 1**: se agrega `RefreshToken` como
tabla propia (en vez de solo confiar en `tokenVersion`). Sirven cosas
distintas: `tokenVersion` invalida *todos* los tokens de un usuario de
golpe (bloqueo); `refresh_tokens` permite rotación normal y logout de
una sola sesión sin desloguear al usuario de todos sus dispositivos.

---

## 2. Máquina de estados y quién puede disparar cada transición

```
OPEN → IN_PROGRESS → PENDING_CUSTOMER → RESOLVED → CLOSED
         ↑_______________________________|  (reabrir)
```

| Transición | Quién |
|---|---|
| Cualquier estado operativo (`open` ↔ `in_progress` ↔ `pending_customer` ↔ `resolved`) | Admin (cualquier ticket), Agente (solo si `assignedToId = self`) |
| `resolved`/`closed` → `closed` (cerrar) | **Solo Admin** — es una atribución explícita del enunciado, no se extiende a Agente ni Supervisor |
| `closed`/`resolved` → `in_progress` (reabrir) | **Solo Admin** — mismo motivo |
| Reasignar (`assignedToId`) | Admin (cualquiera), Supervisor (cualquiera, vía "reasignar"), Agente no puede reasignarse a sí mismo ni a otros |

Cada transición de estado escribe una fila en `ticket_status_history`.
Cada reasignación escribe una fila en `ticket_assignment_history` y
además incrementa `tickets.reassignment_count` (en la misma
transacción de Prisma).

---

## 3. Alcance de visibilidad por rol (qué ve cada quién en el listado)

Esto no estaba explícito en el enunciado (decía "puede consultar
tickets" para Agente, sin el calificador "todos" que sí tienen Admin y
Supervisor) — se interpreta así, y se deja documentado para poder
defenderlo:

| Rol | `GET /tickets` devuelve |
|---|---|
| Admin | todos los tickets |
| Supervisor | todos los tickets |
| Agente | tickets con `assignedToId = self` **o** `assignedToId = null` (para poder tomar trabajo de la cola sin asignar) |

Esto también aplica a `GET /tickets/:id` (404 en vez de 403 si el
ticket existe pero está fuera del alcance del agente — no se revela
la existencia de tickets ajenos).

---

## 4. Catálogo de endpoints

Prefijo: `/api/v1`. Todo endpoint salvo `auth/login` y `auth/refresh`
requiere `Authorization: Bearer <accessToken>`.

### Auth

| Método y ruta | Rol | Body | Notas |
|---|---|---|---|
| `POST /auth/login` | público | `{ email, password }` | responde `{ accessToken, user }`; rechaza si `status = BLOCKED` con `AUTH_USER_BLOCKED`; setea el refresh token como cookie `httpOnly` (ver §11) |
| `POST /auth/refresh` | público (requiere cookie de refresh válida) | — (sin body) | lee la cookie, rota el refresh token, verifica `tokenVersion` |
| `POST /auth/logout` | autenticado | — | revoca el refresh token de la sesión actual y limpia la cookie |
| `GET /auth/me` | autenticado | — | perfil + rol, para hidratar el frontend al cargar |

### Users (gestión de usuarios internos)

| Método y ruta | Rol | Notas |
|---|---|---|
| `GET /users` | Admin, Supervisor (solo lectura) | filtros: `role`, `status` |
| `POST /users` | Admin | crea agente/supervisor/admin |
| `PATCH /users/:id` | Admin | nombre, rol |
| `PATCH /users/:id/status` | Admin | bloquear/desbloquear → al bloquear, incrementa `tokenVersion` y revoca refresh tokens activos |

### Customers

| Método y ruta | Rol | Notas |
|---|---|---|
| `GET /customers` | todos los autenticados | búsqueda por nombre/email |
| `POST /customers` | todos los autenticados | alta rápida al crear un ticket para un cliente nuevo |
| `GET /customers/:id` | todos los autenticados | |
| `PATCH /customers/:id` | Admin | evita que cualquiera edite datos de facturación/contacto |

### Tickets

| Método y ruta | Rol | Notas |
|---|---|---|
| `GET /tickets` | todos | scope según §3; filtros: status, priority, customerId, assignedToId, category, dateFrom, dateTo, q (texto en título), overdue=true; paginación por cursor |
| `POST /tickets` | Admin, Agente | Supervisor no crea (no está en su matriz de permisos) |
| `GET /tickets/:id` | todos, con scope de §3 | incluye comentarios visibles según rol + historial resumido |
| `PATCH /tickets/:id` | Admin (cualquiera), Agente (solo asignados) | campos editables: title, description, category, priority — **no** status ni assignedTo (van por endpoints dedicados, para poder auditar cada uno con su propia regla) |
| `PATCH /tickets/:id/status` | Admin (cualquiera), Agente (solo asignados) — cierre/reapertura solo Admin | valida la máquina de estados de §2 |
| `PATCH /tickets/:id/assign` | Admin, Supervisor | body `{ assignedToId }`; escribe `ticket_assignment_history` |
| `POST /tickets/:id/comments` | Admin, Agente (asignados), Supervisor | `isInternal` solo puede ser `true` si el autor es Admin o Supervisor — si un Agente lo manda en `true`, se ignora y se fuerza `false` |
| `GET /tickets/:id/history` | Admin, Supervisor (siempre); Agente (solo si el ticket es suyo) | estado + reasignaciones combinados y ordenados por fecha |

### Dashboard

| Método y ruta | Rol | Notas |
|---|---|---|
| `GET /dashboard/metrics` | todos, payload distinto por rol | Admin/Supervisor: totales globales por estado/prioridad, vencidos, tiempo promedio de resolución (30 días), tickets por agente. Agente: sus propios totales + cola de "sin asignar" disponible |

---

## 5. DTOs principales (forma, no implementación)

```ts
class LoginDto { email: string; password: string; }

class CreateTicketDto {
  customerId: string;
  title: string;          // 5–150 chars
  description: string;    // 10–5000 chars
  priority: TicketPriority;
  category: TicketCategory;
  channel?: TicketChannel; // default WEB
}

class UpdateTicketDto {
  title?: string;
  description?: string;
  priority?: TicketPriority;
  category?: TicketCategory;
}

class ChangeTicketStatusDto { status: TicketStatus; }

class AssignTicketDto { assignedToId: string; }

class CreateCommentDto { body: string; isInternal?: boolean; }

class ListTicketsQueryDto {
  status?: TicketStatus;
  priority?: TicketPriority;
  customerId?: string;
  assignedToId?: string;
  category?: TicketCategory;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  overdue?: boolean;
  cursor?: string;
  limit?: number; // default 20, max 100
}

class CreateUserDto { name: string; email: string; password: string; role: Role; }
class UpdateUserStatusDto { status: UserStatus; }
```

Todas se validan con `class-validator` (`@IsEmail`, `@IsEnum`,
`@Length`, `@IsUUID`, etc.) a nivel de `Pipe` global — nada llega al
controller sin pasar por ahí.

---

## 6. Catálogo de códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | DTO inválido |
| `AUTH_INVALID_CREDENTIALS` | 401 | login con credenciales incorrectas |
| `AUTH_USER_BLOCKED` | 401 | login o request con usuario bloqueado |
| `AUTH_TOKEN_EXPIRED` | 401 | access token vencido |
| `AUTH_TOKEN_INVALID` | 401 | token malformado o `tokenVersion` desactualizado |
| `FORBIDDEN_ROLE` | 403 | rol no autorizado para el endpoint |
| `FORBIDDEN_OWNERSHIP` | 403 | agente intentando modificar ticket ajeno |
| `INVALID_STATUS_TRANSITION` | 409 | transición de estado no permitida por la máquina de §2 |
| `TICKET_NOT_FOUND` | 404 | no existe, o existe pero fuera del scope del rol (§3) |
| `CUSTOMER_NOT_FOUND` | 404 | |
| `USER_NOT_FOUND` | 404 | |
| `INTERNAL_ERROR` | 500 | cualquier excepción no controlada — se loguea con stack, al cliente solo se le da el código |

---

## 7. Variables de entorno

```
DATABASE_URL=postgresql://user:pass@localhost:5432/support_tickets
JWT_ACCESS_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES=7d
BCRYPT_SALT_ROUNDS=10
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

---

## 8. Estructura de carpetas (nivel de archivo)

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/roles.decorator.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── guards/roles.guard.ts
│   │   ├── interceptors/response.interceptor.ts   # envuelve en { success, data, meta }
│   │   ├── filters/http-exception.filter.ts        # error catalog → respuesta consistente
│   │   └── errors/error-codes.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── dto/
│   ├── users/            (controller, service, dto)
│   ├── customers/        (controller, service, dto)
│   ├── tickets/
│   │   ├── tickets.module.ts
│   │   ├── tickets.controller.ts
│   │   ├── tickets.service.ts        # incluye state machine + scope de §3
│   │   ├── comments/                 # sub-recurso
│   │   └── dto/
│   ├── dashboard/        (controller, service)
│   └── prisma/
│       └── prisma.service.ts
├── prisma/
│   └── schema.prisma
├── test/
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 9. Checklist — ¿ya se puede scaffoldear?

- [x] Entidades y relaciones cerradas (§1)
- [x] Máquina de estados y quién dispara cada transición (§2)
- [x] Alcance de visibilidad por rol, incluyendo el caso ambiguo del
      enunciado (Agente, §3)
- [x] Endpoints, uno por uno, con rol y notas de negocio (§4)
- [x] DTOs (§5)
- [x] Catálogo de errores cerrado (§6)
- [x] Variables de entorno (§7)
- [x] Estructura de archivos (§8)

Con esto, el scaffold en Fase 2b es mecánico: `nest new backend`,
pegar `schema.prisma`, generar los módulos de §8, y cada
controller/service/dto ya tiene su contrato definido — no hay
decisiones de diseño pendientes en el camino.

---

## 11. Ajuste — refresh token vía cookie httpOnly (añadido en Fase 3a)

Al diseñar el consumo desde el frontend (`docs/02-diseno-frontend.md`
§1) se refinó cómo viaja el refresh token: en vez de devolverlo en el
body de `/auth/login` para que el cliente lo guarde, el backend lo
entrega como cookie `httpOnly; Secure; SameSite=Strict;
Path=/api/v1/auth/refresh`. Nunca es accesible desde JavaScript, lo
que cierra el vector de robo por XSS que sí existe si se guarda en
`localStorage`.

Implicaciones para la implementación:
- `cookie-parser` en Nest, y CORS con `credentials: true` + origin
  exacto (nunca `*`).
- El cliente llama con `credentials: 'include'`.
- `SameSite=Strict` ya mitiga CSRF sobre este endpoint sin necesidad
  de un token CSRF adicional, porque el navegador no envía la cookie
  en requests iniciadas desde otro origin.

# Fase 3a — Diseño detallado del frontend

Contrato para el scaffold de Fase 3b. Se apoya directamente en
`docs/01-diseno-api-backend.md` — los tipos, DTOs y códigos de error
son un espejo de ese documento, no una reinterpretación.

---

## 1. Revisión de seguridad de autenticación (ajuste sobre la Fase 2a)

Al diseñar el flujo del lado del cliente se refina la decisión de
manejo de tokens tomada en la Fase 2a:

- **Access token**: vive solo en memoria (store de Zustand), nunca en
  `localStorage`. Se pierde al refrescar la página — y eso es
  intencional; se recupera automáticamente vía refresh.
- **Refresh token**: en vez de viajar en el body de la respuesta (como
  se dejó en la Fase 2a), el backend lo entrega en una **cookie
  httpOnly, Secure, SameSite=Strict**, con `Path=/api/v1/auth/refresh`.
  Nunca es visible para JavaScript — mitiga robo de token por XSS,
  que es el vector más relevante en una SPA.

**Por qué el cambio ahora y no antes**: en la Fase 2a el foco era el
contrato de datos; al bajar al detalle de cómo el cliente realmente
guarda y usa el refresh token, guardarlo en el body y luego en
`localStorage` es la opción más simple pero la más débil frente a XSS.
Vale la pena declarar el cambio explícitamente en vez de dejar la
inconsistencia entre documentos.

**Ajuste correspondiente en el backend** (ver nota al final de
`docs/01-diseno-api-backend.md`):
- `POST /auth/login` responde `{ accessToken, user }` y setea la
  cookie `refresh_token`.
- `POST /auth/refresh` no recibe body — lee la cookie, rota el token
  (nueva fila en `refresh_tokens`, revoca la anterior) y reenvía la
  cookie actualizada.
- `POST /auth/logout` revoca la fila en `refresh_tokens` y limpia la
  cookie.
- CORS del backend debe habilitar `credentials: true` y el origin
  exacto del frontend (no `*`); el cliente hace todas las llamadas con
  `credentials: 'include'`.

---

## 2. Rutas

| Ruta | Vista | Acceso |
|---|---|---|
| `/login` | Inicio de sesión | público (redirige a `/` si ya hay sesión) |
| `/` | Dashboard operativo | autenticado |
| `/tickets` | Listado de tickets | autenticado (scope según rol, lo resuelve el backend) |
| `/tickets/new` | Creación de ticket | Admin, Agente |
| `/tickets/:id` | Detalle de ticket | autenticado |
| `/users` | Gestión de usuarios | Admin |
| `*` | 404 | — |

`RequireAuth` es un wrapper de ruta: sin sesión → redirige a
`/login?next=<ruta>`; con sesión pero rol no autorizado → redirige a
`/` con un toast, no una pantalla de error dura.

**Importante para la sustentación**: ocultar botones/rutas en el
frontend por rol es solo UX. La única fuente de verdad de permisos es
el backend (guards + ownership check) — el frontend nunca es la
barrera de seguridad, solo evita que el usuario intente algo que de
todas formas el backend va a rechazar.

---

## 3. TanStack Query — claves y estrategia de caché

| Query key | Endpoint | Notas |
|---|---|---|
| `['me']` | `GET /auth/me` | se carga una vez al montar la app |
| `['tickets', filters]` | `GET /tickets` | `filters` serializado en la URL (query params), así el listado es bookmarkeable |
| `['ticket', id]` | `GET /tickets/:id` | |
| `['ticket', id, 'history']` | `GET /tickets/:id/history` | |
| `['customers', search]` | `GET /customers` | debounce de 300ms en el input |
| `['users', filters]` | `GET /users` | solo se monta en `/users` |
| `['dashboard-metrics']` | `GET /dashboard/metrics` | `staleTime: 30s`, sin refetch agresivo — el enunciado no pide tiempo real |

Cada mutación (`changeStatus`, `assign`, `addComment`, `updateUserStatus`,
etc.) invalida las query keys afectadas en su `onSuccess` — nunca se
actualiza el cache "a mano" con optimistic updates en el MVP, para no
introducir bugs de sincronización en 8–14h de desarrollo. Se deja
anotado como mejora futura si el volumen de interacciones lo justifica.

---

## 4. Formularios (React Hook Form + Zod)

Los schemas de Zod son el espejo de los DTOs del backend (§5 de
`01-diseno-api-backend.md`), para que la validación del lado cliente
nunca diga "sí" a algo que el servidor va a rechazar:

```ts
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createTicketSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().min(5).max(150),
  description: z.string().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.enum(['BILLING', 'TECHNICAL_SUPPORT', 'ACCESS', 'OTHER']),
});

const changeStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED']),
});

const commentSchema = z.object({
  body: z.string().min(1).max(3000),
  isInternal: z.boolean().optional(),
});
```

Errores de servidor (`VALIDATION_ERROR`, `INVALID_STATUS_TRANSITION`,
etc.) se mapean a mensajes en español vía un diccionario
`ERROR_MESSAGES: Record<ErrorCode, string>` — nunca se le muestra al
usuario el código crudo.

---

## 5. Vistas mínimas — qué contiene cada una

### Inicio de sesión
Formulario (email/password) + manejo de `AUTH_INVALID_CREDENTIALS` y
`AUTH_USER_BLOCKED` con mensajes distintos (el segundo no debe sugerir
que el usuario reintente). Redirección automática si ya hay sesión.

### Dashboard operativo
Tarjetas: total abiertos, vencidos, distribución por prioridad, tiempo
promedio de resolución (30 días). Para Agente, además: "mis tickets" y
la cola de sin asignar. Un widget de "vencidos" enlaza directo al
listado con el filtro `overdue=true` aplicado.

### Listado de tickets
Tabla con paginación por cursor, filtros en la URL (compartibles),
badges de color por estado/prioridad, click en fila → detalle. El
scope de qué tickets aparecen lo decide el backend (§3 de
`01-diseno-api-backend.md`); el frontend no filtra por su cuenta.

### Detalle de ticket
Encabezado (folio, estado, prioridad, cuenta regresiva de SLA
calculada en cliente a partir de `slaDueAt`), datos del ticket,
acciones contextuales (cambiar estado / reasignar / cerrar-reabrir,
mostradas u ocultas según rol y ownership — ver nota de §2), lista de
comentarios (internos visibles solo si el rol lo permite) con
formulario para agregar, e historial en dos pestañas (estado /
reasignaciones).

### Creación de ticket
Formulario con autocomplete de cliente (con opción de alta rápida
inline si no existe), título, descripción, prioridad, categoría.
Redirige al detalle del ticket recién creado.

### Gestión de usuarios (Admin)
No es una vista mínima pedida explícitamente, pero es necesaria para
poder operar el requisito de bloqueo de usuarios (explícito en el
documento de sustentación): tabla de usuarios con toggle
bloquear/desbloquear y alta de usuario nuevo.

---

## 6. Estructura de carpetas

```
frontend/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── routes.tsx
│   │   └── providers.tsx        # QueryClientProvider, AuthProvider
│   ├── lib/
│   │   ├── api-client.ts        # fetch wrapper: credentials include, interceptor de refresh en 401
│   │   └── query-client.ts
│   ├── features/
│   │   ├── auth/                # LoginForm, useAuthStore (Zustand)
│   │   ├── tickets/
│   │   │   ├── TicketsListPage.tsx
│   │   │   ├── TicketDetailPage.tsx
│   │   │   ├── TicketCreatePage.tsx
│   │   │   └── components/      # StatusBadge, PriorityBadge, TicketFilters, SlaCountdown
│   │   ├── dashboard/
│   │   ├── users/                # solo Admin
│   │   └── customers/
│   ├── components/ui/            # primitivos shadcn/ui
│   └── types/                    # interfaces espejo de los DTOs del backend
├── .env.example
├── package.json
└── vite.config.ts
```

---

## 7. Manejo de errores globales

- Interceptor del `api-client`: en un 401 con `AUTH_TOKEN_EXPIRED`,
  intenta `POST /auth/refresh` **una sola vez** y reintenta la request
  original; si el refresh también falla, logout + redirect a
  `/login`.
- 401 con `AUTH_USER_BLOCKED`: logout inmediato, sin reintento, mensaje
  explícito de cuenta bloqueada.
- Cualquier otro error: toast con el mensaje mapeado desde
  `ERROR_MESSAGES`, fallback genérico si el código no está mapeado.

---

## 8. Variables de entorno

```
VITE_API_URL=http://localhost:3000/api/v1
```

---

## 9. Checklist — ¿ya se puede scaffoldear el frontend?

- [x] Rutas y control de acceso por rol (§2)
- [x] Estrategia de manejo de tokens, con el ajuste de seguridad
      documentado y reflejado en el contrato del backend (§1)
- [x] Query keys y estrategia de invalidación (§3)
- [x] Schemas de validación espejo de los DTOs del backend (§4)
- [x] Contenido de cada vista mínima + la vista adicional de usuarios (§5)
- [x] Estructura de archivos (§6)
- [x] Manejo de errores (§7)

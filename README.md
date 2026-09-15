# Plataforma de gestión de tickets de soporte

Prueba técnica Tech Lead Full Stack JS: plataforma interna de gestión de
tickets de soporte con autenticación + RBAC, CRUD de tickets con máquina
de estados y SLA, dashboard, y las consultas SQL requeridas.

- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Frontend: React + TypeScript + Vite + TanStack Query + React Hook Form
  + Zod + shadcn/ui + Tailwind
- Auth: JWT access (15 min) + refresh (7 días, rotado, cookie httpOnly)
  + bcrypt
- Infra objetivo: AWS (S3+CloudFront, ECS Fargate/App Runner, RDS) —
  desarrollo local con Docker Compose

## Estructura del repo

```
support-ticket-platform-docs/
├── backend/           API REST (NestJS)
├── frontend/          SPA (React)
├── docs/              decisiones de arquitectura y diseño detallado
├── docker-compose.yml Postgres local
├── queries.sql        las 8 consultas SQL requeridas
└── README.md          este archivo
```

## Cómo correr el proyecto

Requisitos: Node 20+, npm, y Postgres (vía Docker o instalación nativa).

```bash
# 1. Base de datos
docker compose up -d
# (si Docker no está disponible en tu máquina, cualquier Postgres 14+
#  local sirve — solo ajusta DATABASE_URL en backend/.env)

# 2. Backend
cd backend
cp .env.example .env        # completa JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
npm install
npx prisma migrate dev
npm run seed                 # datos de demo — ver credenciales abajo
npm run start:dev            # http://localhost:3000/api/v1

# 3. Frontend (en otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                  # http://localhost:5173

# 4. Las 8 consultas SQL requeridas
psql "$DATABASE_URL" -f queries.sql
```

### Credenciales de demo (creadas por `npm run seed`)

| Rol        | Email                    | Password        |
|------------|---------------------------|-----------------|
| Admin      | admin@example.com         | Admin123!       |
| Supervisor | supervisor@example.com    | Supervisor123!  |
| Agente     | agent1@example.com        | Agent123!       |
| Agente     | agent2@example.com        | Agent456!       |
| Agente     | agent3@example.com        | Agent789!       |
| Agente     | agent4@example.com        | Agent101!       |
| Agente     | agent5@example.com        | Agent112!       |

El seed genera 20 clientes y 400 tickets con historial de estado y
reasignación simulado a lo largo de 60 días, pensado específicamente
para que las 8 consultas de `queries.sql` devuelvan resultados reales
(tickets vencidos hace >48h, reasignados más de dos veces, etc.).
`npm run seed` es destructivo para tickets/clientes/historial (no toca
usuarios existentes más allá de reactivarlos) — pensado para correr en
un entorno de desarrollo/demo, no en producción.

## Decisiones de arquitectura

El enunciado del reto dejaba deliberadamente varios puntos abiertos
(campos del ticket, estados, prioridades/SLA, filtros, RBAC). Esas
decisiones están tomadas y justificadas en:

- [`docs/00-arquitectura-y-decisiones.md`](docs/00-arquitectura-y-decisiones.md) — Fase 1: modelo de datos, máquina de estados, SLA, seguridad, stack.
- [`docs/01-diseno-api-backend.md`](docs/01-diseno-api-backend.md) — Fase 2a: contrato de la API (endpoints, DTOs, catálogo de errores, RBAC exacto por endpoint).
- [`docs/02-diseno-frontend.md`](docs/02-diseno-frontend.md) — Fase 3a: rutas, manejo de tokens, query keys, vistas.
- [`backend/README-fase2b-notas.md`](backend/README-fase2b-notas.md) — desviaciones menores tomadas al implementar el backend (versión de Prisma, CommonJS vs. ESM, etc.) y por qué.
- [`frontend/README-fase3b-notas.md`](frontend/README-fase3b-notas.md) — idem para el frontend, más dos bugs reales encontrados y corregidos al probar en navegador.

## Uso de IA

Este proyecto se construyó con ayuda de **Claude** (Anthropic)

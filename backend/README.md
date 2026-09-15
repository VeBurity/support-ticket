# Backend — API de gestión de tickets de soporte

NestJS + Prisma + PostgreSQL. Ver el `README.md` en la raíz del repo
para cómo levantar todo el proyecto (Postgres, migraciones, seed,
frontend).

## Requisitos

| Software | Versión | Notas |
|---|---|---|
| Node.js | ≥ 20 LTS (probado con 24.20.0) | `node -v` |
| npm | ≥ 10 (probado con 11.19.0) | viene con Node |
| PostgreSQL | ≥ 14 (probado con 17; `docker-compose.yml` usa `16-alpine`) | vía Docker o instalación nativa |

Dependencias principales (ver `package.json` para la lista completa
con sub-dependencias):

| Paquete | Versión | Rol |
|---|---|---|
| `@nestjs/core` / `@nestjs/common` | ^12.0.1 | framework |
| `@nestjs/config` | ^12.0.0 | variables de entorno |
| `@nestjs/jwt` / `passport` / `passport-jwt` | ^12.0.1 / ^0.7.0 / ^4.0.1 | autenticación JWT |
| `@nestjs/throttler` | ^6.5.0 | rate limiting |
| `@prisma/client` / `prisma` | ^6.19.3 | ORM + CLI de migraciones (fijado, no "latest" — ver notas abajo) |
| `bcrypt` | ^6.0.0 | hash de contraseñas y refresh tokens |
| `class-validator` / `class-transformer` | ^0.15.1 / ^0.5.1 | validación de DTOs |
| `cookie-parser` | ^1.4.7 | cookie httpOnly del refresh token |
| `helmet` | ^8.3.0 | cabeceras HTTP de seguridad |
| `typescript` | ^6.0.2 | (CommonJS, no ESM — ver notas abajo) |
| `vitest` | ^4.1.2 | test runner (scaffoldeado, sin suite escrita) |

`npm install` instala todo lo anterior automáticamente a partir de
`package.json` / `package-lock.json` — esta tabla es solo para saber
qué esperar antes de instalar.

## Comandos

```bash
npm install
npx prisma migrate dev
npm run start:dev      # http://localhost:3000/api/v1
npm run seed           # datos de demo (resetea tickets/clientes)
npm run build
npm test
```

## Documentación

- Contrato de la API (endpoints, DTOs, catálogo de errores, RBAC):
  `../docs/01-diseno-api-backend.md`
- Decisiones y desviaciones tomadas al implementar: `README-fase2b-notas.md`

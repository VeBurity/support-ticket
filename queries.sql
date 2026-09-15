-- ============================================================================
-- queries.sql — Consultas SQL requeridas
-- Plataforma interna de gestión de tickets de soporte
-- ============================================================================
--
-- Motor: PostgreSQL (ver docs/00-arquitectura-y-decisiones.md §3 para la
-- justificación de la elección).
--
-- Notas sobre el esquema:
--   - Las tablas están en snake_case (`tickets`, `ticket_status_history`,
--     `ticket_assignment_history`, `customers`, `users`) vía @@map en
--     Prisma (docs/01-diseno-api-backend.md).
--   - Las COLUMNAS conservan el nombre camelCase declarado en schema.prisma
--     (no se agregó @map por campo, para no desviarse del contrato) — por
--     eso van entre comillas dobles en todas las consultas: "customerId",
--     "assignedToId", "createdAt", "updatedAt", "closedAt", "changedAt",
--     "toStatus", "fromStatus", "toUserId", "fromUserId", etc.
--   - Ninguna de estas 8 consultas necesita parámetros externos (son
--     reportes de negocio fijos: umbral de 48h, ventana de 30 días, top 5,
--     etc.), así que no hay valores de usuario que concatenar. Si alguna
--     se expusiera como endpoint parametrizable, los literales de intervalo
--     (INTERVAL '48 hours', INTERVAL '30 days', LIMIT 5) se reemplazarían
--     por parámetros nombrados (ej. :umbral_horas, :dias, :top_n) — se deja
--     indicado en el comentario de cada consulta afectada.
--   - Se evita SELECT * en todas partes (docs §7, pensado para volumen).
--
-- Para ejecutar contra la base local (ver backend/.env.example):
--   psql "$DATABASE_URL" -f queries.sql
--
-- Para generar datos de prueba que hagan estas consultas demostrables:
--   cd backend && npm run seed
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Cantidad de tickets por estado para cada cliente
-- ----------------------------------------------------------------------------
SELECT
  c.id                    AS customer_id,
  c.name                  AS customer_name,
  t.status,
  COUNT(*)                AS ticket_count
FROM customers c
JOIN tickets t
  ON t."customerId" = c.id
GROUP BY c.id, c.name, t.status
ORDER BY c.name, t.status;


-- ----------------------------------------------------------------------------
-- 2. Los cinco clientes con mayor cantidad de tickets de prioridad alta o
--    crítica
-- ----------------------------------------------------------------------------
-- Nota: LIMIT 5 es literal por el enunciado ("los cinco clientes"); si se
-- necesitara un top-N variable, sería el único parámetro real de esta consulta.
SELECT
  c.id                          AS customer_id,
  c.name                        AS customer_name,
  COUNT(*)                      AS high_or_critical_count
FROM customers c
JOIN tickets t
  ON t."customerId" = c.id
WHERE t.priority IN ('HIGH', 'CRITICAL')
GROUP BY c.id, c.name
ORDER BY high_or_critical_count DESC, c.name
LIMIT 5;


-- ----------------------------------------------------------------------------
-- 3. Tickets que llevan más de 48 horas sin actualización y que no están
--    cerrados
-- ----------------------------------------------------------------------------
-- El umbral de 48 horas sería el parámetro named :umbral si esta consulta se
-- expusiera parametrizada (ej. $1 en lugar de INTERVAL '48 hours').
SELECT
  t.id,
  t.folio,
  t.status,
  t.priority,
  t."updatedAt",
  NOW() - t."updatedAt"  AS time_since_update
FROM tickets t
WHERE t.status <> 'CLOSED'
  AND t."updatedAt" < NOW() - INTERVAL '48 hours'
ORDER BY t."updatedAt" ASC;


-- ----------------------------------------------------------------------------
-- 4. El usuario con mayor cantidad de tickets resueltos durante el último
--    mes
-- ----------------------------------------------------------------------------
-- "Resuelto" se toma como la transición de estado a RESOLVED (no CLOSED),
-- registrada en ticket_status_history — es el evento de auditoría que el
-- propio modelo de datos define para esto (ver docs/00 §5 y §6). El "usuario"
-- es quien ejecutó esa transición (`changedById`), no necesariamente el
-- agente actualmente asignado al ticket.
SELECT
  u.id      AS user_id,
  u.name    AS user_name,
  COUNT(*)  AS resolved_count
FROM ticket_status_history h
JOIN users u
  ON u.id = h."changedById"
WHERE h."toStatus" = 'RESOLVED'
  AND h."changedAt" >= NOW() - INTERVAL '1 month'
GROUP BY u.id, u.name
ORDER BY resolved_count DESC
LIMIT 1;


-- ----------------------------------------------------------------------------
-- 5. El tiempo promedio de resolución de tickets por prioridad
-- ----------------------------------------------------------------------------
-- "Tiempo de resolución" = desde la creación del ticket hasta su primera
-- transición a RESOLVED (no hasta el cierre, que es un paso posterior y
-- opcional). Se usa DISTINCT ON con window ordering para quedarse con la
-- primera vez que cada ticket llegó a RESOLVED, tal como justifica el uso
-- de PostgreSQL en docs/00-arquitectura-y-decisiones.md §3 ("window
-- functions útiles para las consultas de promedios/rankings pedidas").
WITH first_resolution AS (
  SELECT DISTINCT ON (h."ticketId")
    h."ticketId",
    h."changedAt" AS resolved_at
  FROM ticket_status_history h
  WHERE h."toStatus" = 'RESOLVED'
  ORDER BY h."ticketId", h."changedAt" ASC
)
SELECT
  t.priority,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (fr.resolved_at - t."createdAt")) / 3600.0),
    2
  ) AS avg_resolution_hours,
  COUNT(*) AS resolved_ticket_count
FROM first_resolution fr
JOIN tickets t
  ON t.id = fr."ticketId"
GROUP BY t.priority
ORDER BY t.priority;


-- ----------------------------------------------------------------------------
-- 6. La cantidad de tickets abiertos por agente
-- ----------------------------------------------------------------------------
-- "Abiertos" = no RESOLVED ni CLOSED (backlog operativo activo), la misma
-- definición que usa el dashboard de la aplicación (ver
-- backend/src/dashboard/dashboard.service.ts) — no el valor literal del
-- enum OPEN, que sería solo el estado inicial. LEFT JOIN para que los
-- agentes sin tickets abiertos aparezcan igual con 0, en vez de omitirse.
SELECT
  u.id                        AS agent_id,
  u.name                      AS agent_name,
  COUNT(t.id)                 AS open_ticket_count
FROM users u
LEFT JOIN tickets t
  ON t."assignedToId" = u.id
  AND t.status NOT IN ('RESOLVED', 'CLOSED')
WHERE u.role = 'AGENT'
GROUP BY u.id, u.name
ORDER BY open_ticket_count DESC, u.name;


-- ----------------------------------------------------------------------------
-- 7. Los tickets que han sido reasignados más de dos veces
-- ----------------------------------------------------------------------------
-- Usa la columna desnormalizada tickets.reassignmentCount, que existe
-- exactamente para evitar tener que agregar sobre
-- ticket_assignment_history en cada consulta de este tipo (docs/00 §2.1).
SELECT
  t.id,
  t.folio,
  t.title,
  t."reassignmentCount"
FROM tickets t
WHERE t."reassignmentCount" > 2
ORDER BY t."reassignmentCount" DESC, t."createdAt" DESC;


-- ----------------------------------------------------------------------------
-- 8. El porcentaje de tickets cerrados frente al total de tickets creados
--    en los últimos 30 días
-- ----------------------------------------------------------------------------
-- La ventana de 30 días sería el parámetro named :dias si se expusiera
-- parametrizada. Se usa FILTER (sintaxis nativa de PostgreSQL) en vez de un
-- CASE dentro de COUNT, y NULLIF para evitar división por cero si no hay
-- tickets creados en la ventana.
SELECT
  COUNT(*) FILTER (WHERE status = 'CLOSED')  AS closed_count,
  COUNT(*)                                    AS total_created_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'CLOSED') / NULLIF(COUNT(*), 0),
    2
  ) AS closed_percentage
FROM tickets
WHERE "createdAt" >= NOW() - INTERVAL '30 days';

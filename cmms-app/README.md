# CMMS/EAM — Backend

Implementación funcional del backend descripto en [`../cmms-pm-architecture`](../cmms-pm-architecture) (arquitectura, modelo de datos y motor de simulación). Este paquete es la aplicación real: **Next.js full-stack** (API vía Route Handlers) sobre **PostgreSQL**, pensada para desplegarse en Vercel.

Fase actual: **backend completo** (los 8 módulos de la API funcionando de punta a punta, verificados con un smoke test real). El frontend (grillas, dashboard, Gantt de simulación) es la siguiente fase.

## Stack

- **Next.js 16** (App Router, Route Handlers) — Turbopack por defecto en `dev`/`build`.
- **Prisma 7** + `@prisma/adapter-pg` — Prisma 7 requiere un *driver adapter* explícito (ya no alcanza con `DATABASE_URL` solo); el cliente se genera en `src/generated/prisma` (gitignored, se regenera con `prisma generate` — ver `postinstall`).
- **PostgreSQL** — el esquema canónico vive en `../cmms-pm-architecture/database/schema.sql` y está congelado como migración baseline en `prisma/migrations/0001_init/migration.sql`. Ese archivo SQL (no `schema.prisma`) es la fuente de verdad para tipos, constraints, triggers y vistas; `schema.prisma` se generó por introspección (`prisma db pull`) a partir de él.
- **NextAuth v5 (Auth.js)** — Credentials provider + sesión JWT, con rol (`ADMIN`/`PLANNER`/`TECHNICIAN`/`WAREHOUSE`) y `work_center_id` embebidos en el token.
- **Zod** para validación de payloads.

> Nota: este proyecto corre sobre una versión de Next.js con cambios de ruptura respecto a versiones anteriores (ver `AGENTS.md` en la raíz del paquete, generado por el propio `next dev`). Antes de tocar código de la app, conviene revisar `node_modules/next/dist/docs/` si algo no se comporta como se espera.

## Setup

```bash
cp .env.example .env
# completar DATABASE_URL y generar AUTH_SECRET:
openssl rand -base64 32

npm install                # corre `prisma generate` vía postinstall
npm run db:migrate         # aplica prisma/migrations/0001_init (schema + triggers + vistas)
npm run db:seed            # crea usuarios de prueba (ver abajo)
npm run dev
```

Usuarios de prueba creados por `db:seed` (solo entornos de desarrollo):

| Email | Password | Rol |
|---|---|---|
| admin@cmms.local | Admin123! | ADMIN |
| planificador@cmms.local | Planner123! | PLANNER |
| tecnico@cmms.local | Tecnico123! | TECHNICIAN |

## Verificar que todo funciona

Con el servidor de desarrollo corriendo (`npm run dev`):

```bash
npm run smoke-test
```

Ejercita la cadena completa contra la API real: login → maestros (ubicación, equipo, material, hoja de ruta) → plan de mantenimiento → simulación → liberación de llamado → verificación de que el trigger SQL copió operaciones/componentes a la orden → consumo de repuesto → verificación de stock → aviso correctivo → RBAC (un Técnico no puede crear plantas) → KPIs del dashboard. Es idempotente (usa un sufijo por timestamp) y se puede correr repetidas veces.

## Módulos de la API

| Módulo | Rutas principales |
|---|---|
| Auth | `POST /api/auth/callback/credentials` (vía NextAuth), `GET /api/me` |
| Maestros | `/api/plants`, `/api/cost-centers`, `/api/work-centers`, `/api/warehouses`, `/api/functional-locations[/:id]`, `/api/equipment[/:id][/bom]`, `/api/materials[/:id]` |
| Hojas de ruta | `/api/task-lists[/:id][/operations[/:opId/components]]` |
| Planes de mantenimiento | `/api/maintenance-strategies`, `/api/maintenance-plans[/:id][/items]`, `/api/maintenance-plans/simulate`, `/api/measuring-points[/:id/readings]` |
| Simulación/Calendario | `/api/maintenance-calls`, `/api/maintenance-calls/:id/release` |
| Avisos y Órdenes | `/api/notifications[/:id][/convert-to-work-order]`, `/api/work-orders[/:id][/status\|/operations\|/components]`, `/api/work-orders/:id/operations/:opId/time-confirmations`, `/api/work-orders/:id/components/:componentId/withdraw` |
| Inventario y Compras | `/api/stock`, `/api/stock-movements`, `/api/purchase-requisitions`, `/api/purchase-orders[/:id/items/:itemId/receive]` |
| Dashboard | `/api/dashboard/kpis` (backlog, cumplimiento preventivo, MTBF/MTTR/disponibilidad) |

Todas las rutas de listado soportan `page`, `pageSize`, `search` (búsqueda parcial vía `ILIKE`, apoyada en los índices `pg_trgm` del esquema), y filtros específicos por recurso — pensado para alimentar las grillas del frontend descriptas en el documento de arquitectura.

El detalle completo de relaciones, roles y la lógica del motor de simulación está documentado en `../cmms-pm-architecture/docs/`.

## Decisiones y gaps conocidos

- **DELETE no implementado en maestros**: se prioriza desactivar (`status`/`active`) en vez de borrar, evitando romper integridad referencial — igual que SAP marca objetos "para borrado" en vez de eliminarlos físicamente.
- **Un plan → una hoja de ruta por ítem, una orden por llamado y por ítem**: si un plan tiene varios `maintenance_items`, liberar un llamado genera una orden por ítem; `maintenance_calls.work_order_id` guarda la primera (por diseño del esquema), y la respuesta de `/release` devuelve todas.
- **Frontend**: no implementado en esta fase (se acordó backend completo primero). La carpeta `cmms-pm-architecture/docs/03-arquitectura-frontend.md` define el plan para la siguiente fase (React/Next UI sobre esta misma API).

# CMMS/EAM — Arquitectura de Gestión de Mantenimiento de Planta

Documento técnico de diseño para un ERP modular de Gestión de Mantenimiento de Planta (CMMS/EAM), basado en las estructuras y mejores prácticas de **SAP PM / S/4HANA**.

## Contenido

1. **[Modelo de Datos](docs/01-modelo-datos.md)** — Diagrama Entidad-Relación, mapeo funcional con objetos SAP PM (IFLOT, EQUI, MPLA, AUFK...) y explicación de la cadena crítica **Plan → Hoja de Ruta → Orden → Repuestos**.
2. **[Arquitectura de Backend](docs/02-arquitectura-backend.md)** — Módulos de dominio, stack recomendado (NestJS + PostgreSQL + Redis + RabbitMQ/Kafka), diseño de API REST/GraphQL y seguridad por roles.
3. **[Arquitectura de Frontend](docs/03-arquitectura-frontend.md)** — React + TypeScript, estructura de componentes, grillas estilo Excel (filtros, búsqueda parcial, exportación), vista Gantt/calendario de simulación y navegación por rol.
4. **[Motor de Simulación de Planes](docs/04-motor-simulacion.md)** — Lógica de negocio core: algoritmos de programación por tiempo, por contador y por estrategia multi-ciclo, con implementación y pruebas ejecutadas.

## Artefactos técnicos

- **[`database/schema.sql`](database/schema.sql)** — Esquema relacional completo en PostgreSQL (tipos, tablas, índices, triggers y vistas de KPI). **Ejecutado y verificado** contra PostgreSQL 16, incluyendo un smoke test funcional de punta a punta (creación de plan → orden → consumo de repuesto → confirmación de horas).
- **[`backend/simulation-engine/simulation-engine.ts`](backend/simulation-engine/simulation-engine.ts)** — Motor de simulación en TypeScript, puro y testeable de forma aislada. **Compilado con `tsc --strict` y ejecutado** contra tres escenarios (tiempo, contador, estrategia combinada) en [`simulation-engine.smoke-test.ts`](backend/simulation-engine/simulation-engine.smoke-test.ts).

## Resumen de la cadena funcional core

```
Ubicación Técnica ─┬─ Equipo ─┬─ BOM (repuestos recomendados)
                    │          ├─ Hoja de Ruta (operaciones + repuestos + especialidad)
                    │          └─ Punto de Medición (contador)
                    │
Plan de Mantenimiento ── Ítem de Mantenimiento ── Hoja de Ruta
        │
        ▼ (motor de simulación)
Llamado Proyectado (maintenance_calls) ── ¿dentro del horizonte de llamado? ──► Orden de Trabajo
                                                                                     │
                                                                    (trigger SQL) copia Operaciones
                                                                    y Componentes desde la Hoja de Ruta
                                                                                     │
                                                                    Consumo de repuestos ──► Movimiento
                                                                    de stock ──► actualiza inventario
```

## Roles del sistema

| Rol | Alcance |
|---|---|
| **Administrador** | Acceso total al sistema. |
| **Planificador** | Crea planes y hojas de ruta, aprueba/libera órdenes, gestiona compras y reposición. |
| **Técnico** | Visualiza sus órdenes asignadas, notifica horas trabajadas y consume materiales. |

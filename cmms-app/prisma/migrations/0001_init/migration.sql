-- =====================================================================
-- CMMS / EAM — ESQUEMA DE BASE DE DATOS RELACIONAL
-- Inspirado en las estructuras de datos de SAP PM / S/4HANA EAM
-- Motor objetivo: PostgreSQL 14+
--
-- Convención: cada tabla indica en comentario su equivalente conceptual
-- en SAP PM para facilitar el mapeo funcional (IFLOT, EQUI, MPLA, etc).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- búsqueda de texto parcial en grillas

-- =====================================================================
-- 0. TIPOS ENUMERADOS
-- =====================================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'PLANNER', 'TECHNICIAN', 'WAREHOUSE', 'VIEWER');

CREATE TYPE fl_status AS ENUM ('ACTIVE', 'INACTIVE', 'DECOMMISSIONED');
CREATE TYPE equipment_status AS ENUM ('ACTIVE', 'INACTIVE', 'IN_MAINTENANCE', 'DECOMMISSIONED', 'SCRAPPED');

CREATE TYPE material_type AS ENUM ('SPARE_PART', 'CONSUMABLE', 'TOOL', 'RAW_MATERIAL');

CREATE TYPE task_list_type AS ENUM ('EQUIPMENT', 'FUNCTIONAL_LOCATION', 'GENERAL');
CREATE TYPE control_key AS ENUM ('PM01_INTERNAL', 'PM02_EXTERNAL', 'PM03_INSPECTION_ONLY');

CREATE TYPE plan_type AS ENUM ('TIME_BASED', 'COUNTER_BASED', 'MULTIPLE_COUNTER', 'CONDITION_BASED');
CREATE TYPE cycle_unit AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR', 'HOUR_METER', 'KM', 'CYCLE_COUNT');
CREATE TYPE scheduling_indicator AS ENUM ('TIME_BASED', 'COMPLETION_BASED');
CREATE TYPE plan_status AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');
CREATE TYPE call_status AS ENUM ('SIMULATED', 'SCHEDULED', 'CALLED', 'SKIPPED', 'COMPLETED');

CREATE TYPE notification_type AS ENUM ('M1_MALFUNCTION', 'M2_REQUEST', 'M3_ACTIVITY_REPORT');
CREATE TYPE notification_status AS ENUM ('CREATED', 'IN_PROCESS', 'COMPLETED', 'CLOSED');
CREATE TYPE priority_level AS ENUM ('1_EMERGENCY', '2_HIGH', '3_MEDIUM', '4_LOW');

CREATE TYPE order_type AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'IMPROVEMENT');
CREATE TYPE order_status AS ENUM ('CREATED', 'RELEASED', 'IN_PROCESS', 'COMPLETED', 'TECHNICALLY_COMPLETED', 'CLOSED', 'CANCELLED');
CREATE TYPE reservation_status AS ENUM ('OPEN', 'PARTIALLY_WITHDRAWN', 'WITHDRAWN', 'RETURNED');

CREATE TYPE movement_type AS ENUM (
  'GR_101_PURCHASE',      -- Ingreso por compra
  'GI_261_CONSUMPTION',   -- Salida por consumo en OT
  'GI_262_RETURN',        -- Devolución a almacén desde OT
  'TR_311_TRANSFER',      -- Transferencia entre almacenes
  'ADJ_701_POSITIVE',     -- Ajuste de inventario positivo
  'ADJ_702_NEGATIVE'      -- Ajuste de inventario negativo
);
CREATE TYPE purchase_status AS ENUM ('REQUESTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- =====================================================================
-- 1. ORGANIZACIÓN Y SEGURIDAD
-- =====================================================================

CREATE TABLE plants (                          -- SAP: Werk (Centro)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  UNIQUE (plant_id, code)
);

CREATE TABLE work_centers (                    -- SAP: CRHD (Puesto de trabajo)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  specialty VARCHAR(50) NOT NULL,              -- Mecánico, Eléctrico, Instrumentista...
  cost_center_id UUID REFERENCES cost_centers(id),
  capacity_hours_per_day NUMERIC(5,2) DEFAULT 8,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (plant_id, code)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'TECHNICIAN',
  specialty VARCHAR(50),
  work_center_id UUID REFERENCES work_centers(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 2. UBICACIONES TÉCNICAS Y EQUIPOS
-- =====================================================================

CREATE TABLE functional_locations (            -- SAP: IFLOT
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  code VARCHAR(60) NOT NULL,                   -- Ej: PLANTA1-SECTA-SALA2-LINEA3
  description VARCHAR(255) NOT NULL,
  parent_id UUID REFERENCES functional_locations(id) ON DELETE RESTRICT,
  category VARCHAR(30),                        -- Planta / Sector / Sala / Línea
  level INT NOT NULL DEFAULT 0,
  materialized_path VARCHAR(2000),             -- ids concatenados; permite queries rápidas de subárbol
  status fl_status NOT NULL DEFAULT 'ACTIVE',
  cost_center_id UUID REFERENCES cost_centers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);
CREATE INDEX idx_fl_parent ON functional_locations(parent_id);
CREATE INDEX idx_fl_description_trgm ON functional_locations USING GIN (description gin_trgm_ops);

-- Mantiene materialized_path/level automáticamente al insertar/mover un nodo del árbol
CREATE OR REPLACE FUNCTION fn_set_fl_path() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
    NEW.materialized_path := NEW.id::text;
  ELSE
    SELECT level + 1, materialized_path || '.' || NEW.id::text
      INTO NEW.level, NEW.materialized_path
      FROM functional_locations WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fl_path
BEFORE INSERT OR UPDATE OF parent_id ON functional_locations
FOR EACH ROW EXECUTE FUNCTION fn_set_fl_path();

CREATE TABLE equipment (                       -- SAP: EQUI / EQUZ (instalación)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  code VARCHAR(40) NOT NULL,
  description VARCHAR(255) NOT NULL,
  functional_location_id UUID REFERENCES functional_locations(id),
  parent_equipment_id UUID REFERENCES equipment(id),   -- jerarquía equipo / subequipo
  equipment_category VARCHAR(30),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(100),
  manufacture_date DATE,
  acquisition_date DATE,
  acquisition_value NUMERIC(14,2),
  warranty_start_date DATE,
  warranty_end_date DATE,
  cost_center_id UUID REFERENCES cost_centers(id),
  status equipment_status NOT NULL DEFAULT 'ACTIVE',
  criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),  -- 1=baja, 5=crítica (prioriza backlog)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);
CREATE INDEX idx_equipment_fl ON equipment(functional_location_id);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_description_trgm ON equipment USING GIN (description gin_trgm_ops);

-- Historial de instalación: un equipo puede reubicarse entre ubicaciones técnicas en el tiempo
CREATE TABLE equipment_installation_history (  -- SAP: EQUZ histórico
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  functional_location_id UUID NOT NULL REFERENCES functional_locations(id),
  installed_from TIMESTAMPTZ NOT NULL,
  installed_to TIMESTAMPTZ,
  CONSTRAINT chk_install_period CHECK (installed_to IS NULL OR installed_to > installed_from)
);

-- =====================================================================
-- 3. INVENTARIO BASE (Almacenes, Materiales, Stock)
-- =====================================================================

CREATE TABLE warehouses (                      -- SAP: Almacén / Pañol
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  code VARCHAR(20) NOT NULL,
  description VARCHAR(150) NOT NULL,
  UNIQUE (plant_id, code)
);

CREATE TABLE materials (                       -- SAP: MARA/MARC — Maestro de repuestos
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  material_type material_type NOT NULL DEFAULT 'SPARE_PART',
  material_group VARCHAR(50),
  unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UN',
  unit_cost NUMERIC(14,4) DEFAULT 0,
  criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_materials_description_trgm ON materials USING GIN (description gin_trgm_ops);

CREATE TABLE stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity_on_hand NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_point NUMERIC(12,3) NOT NULL DEFAULT 0,
  max_stock NUMERIC(12,3),
  UNIQUE (material_id, warehouse_id)
);
-- Índice parcial: acelera el listado de "materiales bajo punto de pedido"
CREATE INDEX idx_stock_below_reorder ON stock(warehouse_id)
  WHERE quantity_on_hand <= reorder_point;

-- =====================================================================
-- 4. LISTA DE MATERIALES POR EQUIPO (BOM)
-- =====================================================================

CREATE TABLE equipment_bom_headers (           -- SAP: STKO
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  bom_usage VARCHAR(30) NOT NULL DEFAULT 'MAINTENANCE',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (equipment_id, bom_usage)
);

CREATE TABLE equipment_bom_items (             -- SAP: STPO
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_header_id UUID NOT NULL REFERENCES equipment_bom_headers(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UN',
  item_category VARCHAR(20) NOT NULL DEFAULT 'RECOMMENDED',  -- RECOMMENDED / MANDATORY
  notes VARCHAR(255)
);
CREATE INDEX idx_bomitem_material ON equipment_bom_items(material_id);

-- =====================================================================
-- 5. HOJAS DE RUTA (TASK LISTS)
-- =====================================================================

CREATE TABLE task_lists (                      -- SAP: PLKO
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code VARCHAR(40) NOT NULL,
  group_counter INT NOT NULL DEFAULT 1,
  description VARCHAR(255) NOT NULL,
  task_list_type task_list_type NOT NULL DEFAULT 'EQUIPMENT',
  equipment_id UUID REFERENCES equipment(id),
  functional_location_id UUID REFERENCES functional_locations(id),
  status VARCHAR(20) NOT NULL DEFAULT 'RELEASED',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_code, group_counter),
  CONSTRAINT chk_task_list_object CHECK (
    (task_list_type = 'EQUIPMENT' AND equipment_id IS NOT NULL) OR
    (task_list_type = 'FUNCTIONAL_LOCATION' AND functional_location_id IS NOT NULL) OR
    (task_list_type = 'GENERAL')
  )
);

CREATE TABLE task_list_operations (            -- SAP: PLPO
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  operation_number INT NOT NULL,               -- 0010, 0020...
  description VARCHAR(255) NOT NULL,
  work_center_id UUID NOT NULL REFERENCES work_centers(id),
  control_key control_key NOT NULL DEFAULT 'PM01_INTERNAL',
  duration_value NUMERIC(8,2) NOT NULL,
  duration_unit VARCHAR(10) NOT NULL DEFAULT 'HOUR',
  number_of_workers INT NOT NULL DEFAULT 1,
  UNIQUE (task_list_id, operation_number)
);

CREATE TABLE task_list_components (            -- Repuestos requeridos por operación de la hoja de ruta
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_list_operation_id UUID NOT NULL REFERENCES task_list_operations(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UN'
);
CREATE INDEX idx_tlc_material ON task_list_components(material_id);

-- =====================================================================
-- 6. PUNTOS DE MEDICIÓN Y CONTADORES (para planes por rendimiento)
-- =====================================================================

CREATE TABLE measuring_points (                -- SAP: IMPTT
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID REFERENCES equipment(id),
  functional_location_id UUID REFERENCES functional_locations(id),
  code VARCHAR(40) NOT NULL,
  description VARCHAR(150) NOT NULL,
  unit_of_measure VARCHAR(10) NOT NULL,        -- HR, KM, CYCLES...
  is_cumulative BOOLEAN NOT NULL DEFAULT TRUE, -- horómetro (solo crece) vs gauge
  CONSTRAINT chk_measuring_point_object CHECK (equipment_id IS NOT NULL OR functional_location_id IS NOT NULL)
);

CREATE TABLE measurement_documents (           -- SAP: IMRC — Lecturas de contador
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measuring_point_id UUID NOT NULL REFERENCES measuring_points(id),
  reading_date TIMESTAMPTZ NOT NULL,
  counter_reading NUMERIC(14,3) NOT NULL,
  reading_difference NUMERIC(14,3),
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_measurement_point_date ON measurement_documents(measuring_point_id, reading_date DESC);

-- =====================================================================
-- 7. ESTRATEGIAS Y PLANES DE MANTENIMIENTO
-- =====================================================================

CREATE TABLE maintenance_strategies (          -- SAP: T351 — Estrategia (combina varios ciclos)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(150) NOT NULL
);

CREATE TABLE maintenance_packages (            -- SAP: T351P — Paquetes/ciclos de la estrategia (1M,3M,6M,1A)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES maintenance_strategies(id) ON DELETE CASCADE,
  package_key VARCHAR(10) NOT NULL,
  cycle_value INT NOT NULL,
  cycle_unit cycle_unit NOT NULL,
  UNIQUE (strategy_id, package_key)
);

CREATE TABLE maintenance_plans (                -- SAP: MPLA
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  plan_type plan_type NOT NULL,
  maintenance_strategy_id UUID REFERENCES maintenance_strategies(id),  -- plan multi-ciclo
  cycle_value INT,                              -- plan de ciclo único (sin estrategia)
  cycle_unit cycle_unit,
  measuring_point_id UUID REFERENCES measuring_points(id),  -- obligatorio si es por contador
  start_date DATE NOT NULL,
  scheduling_indicator scheduling_indicator NOT NULL DEFAULT 'TIME_BASED',
  shift_factor_early_pct NUMERIC(5,2) NOT NULL DEFAULT 10,  -- tolerancia de adelanto
  shift_factor_late_pct NUMERIC(5,2) NOT NULL DEFAULT 10,   -- tolerancia de atraso
  call_horizon_pct NUMERIC(5,2) NOT NULL DEFAULT 90,        -- % del ciclo transcurrido que dispara la OT
  planned_completion_offset_days INT NOT NULL DEFAULT 0,    -- duración estimada de la OT generada
  factory_calendar_id VARCHAR(20) NOT NULL DEFAULT 'STD',
  status plan_status NOT NULL DEFAULT 'ACTIVE',
  last_call_date DATE,                -- ancla para el próximo ciclo (fecha)
  last_call_counter NUMERIC(14,3),    -- ancla para el próximo ciclo (contador)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_plan_cycle CHECK (
    maintenance_strategy_id IS NOT NULL OR (cycle_value IS NOT NULL AND cycle_unit IS NOT NULL)
  ),
  CONSTRAINT chk_plan_counter CHECK (
    plan_type NOT IN ('COUNTER_BASED', 'MULTIPLE_COUNTER') OR measuring_point_id IS NOT NULL
  )
);

CREATE TABLE maintenance_items (                -- SAP: MPOS — objeto(s) cubiertos por el plan
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_plan_id UUID NOT NULL REFERENCES maintenance_plans(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id),
  functional_location_id UUID REFERENCES functional_locations(id),
  task_list_id UUID NOT NULL REFERENCES task_lists(id),
  description VARCHAR(255),
  priority priority_level NOT NULL DEFAULT '3_MEDIUM',
  order_type order_type NOT NULL DEFAULT 'PREVENTIVE',
  planner_group VARCHAR(50),
  sort_field VARCHAR(50),
  CONSTRAINT chk_item_object CHECK (equipment_id IS NOT NULL OR functional_location_id IS NOT NULL)
);
CREATE INDEX idx_mi_plan ON maintenance_items(maintenance_plan_id);
CREATE INDEX idx_mi_equipment ON maintenance_items(equipment_id);

-- Paquetes de la estrategia efectivamente asignados a cada ítem del plan
CREATE TABLE maintenance_item_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_item_id UUID NOT NULL REFERENCES maintenance_items(id) ON DELETE CASCADE,
  maintenance_package_id UUID NOT NULL REFERENCES maintenance_packages(id),
  UNIQUE (maintenance_item_id, maintenance_package_id)
);

-- Registro de llamados: histórico + proyección. Es la salida del motor de simulación.
CREATE TABLE maintenance_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_plan_id UUID NOT NULL REFERENCES maintenance_plans(id),
  maintenance_package_id UUID REFERENCES maintenance_packages(id),  -- NULL si es plan de ciclo único
  call_number INT NOT NULL,
  scheduled_date DATE NOT NULL,
  due_counter_reading NUMERIC(14,3),
  status call_status NOT NULL DEFAULT 'SIMULATED',
  work_order_id UUID,   -- FK agregada más abajo, tras crear work_orders
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (maintenance_plan_id, maintenance_package_id, call_number)
);
CREATE INDEX idx_calls_plan_date ON maintenance_calls(maintenance_plan_id, scheduled_date);
CREATE INDEX idx_calls_status ON maintenance_calls(status);

-- =====================================================================
-- 8. AVISOS DE MANTENIMIENTO (NOTIFICATIONS)
-- =====================================================================

CREATE TABLE notifications (                   -- SAP: QMEL/QMIH
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  notification_type notification_type NOT NULL DEFAULT 'M2_REQUEST',
  equipment_id UUID REFERENCES equipment(id),
  functional_location_id UUID REFERENCES functional_locations(id),
  description VARCHAR(255) NOT NULL,
  long_text TEXT,
  reported_by UUID NOT NULL REFERENCES users(id),
  reported_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  required_start TIMESTAMPTZ,
  required_end TIMESTAMPTZ,
  priority priority_level NOT NULL DEFAULT '3_MEDIUM',
  status notification_status NOT NULL DEFAULT 'CREATED',
  is_breakdown BOOLEAN NOT NULL DEFAULT FALSE,
  malfunction_start TIMESTAMPTZ,
  malfunction_end TIMESTAMPTZ,                 -- se completa al cerrar -> insumo para MTTR/MTBF
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_notif_object CHECK (equipment_id IS NOT NULL OR functional_location_id IS NOT NULL)
);
CREATE INDEX idx_notif_status ON notifications(status);
CREATE INDEX idx_notif_equipment ON notifications(equipment_id);

-- =====================================================================
-- 9. ÓRDENES DE TRABAJO
-- =====================================================================

CREATE TABLE work_orders (                     -- SAP: AUFK / CAUFVD
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  order_type order_type NOT NULL,
  origin_notification_id UUID REFERENCES notifications(id),
  origin_maintenance_call_id UUID REFERENCES maintenance_calls(id),
  equipment_id UUID REFERENCES equipment(id),
  functional_location_id UUID REFERENCES functional_locations(id),
  task_list_id UUID REFERENCES task_lists(id),  -- hoja de ruta origen; dispara la copia de operaciones/componentes
  description VARCHAR(255) NOT NULL,
  priority priority_level NOT NULL DEFAULT '3_MEDIUM',
  status order_status NOT NULL DEFAULT 'CREATED',
  planner_group VARCHAR(50),
  work_center_responsible_id UUID REFERENCES work_centers(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  basic_start_date DATE,
  basic_end_date DATE,
  scheduled_start_date DATE,
  scheduled_end_date DATE,
  actual_start_date TIMESTAMPTZ,
  actual_end_date TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  technically_completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_wo_object CHECK (equipment_id IS NOT NULL OR functional_location_id IS NOT NULL)
);
CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_equipment ON work_orders(equipment_id);
CREATE INDEX idx_wo_dates ON work_orders(basic_start_date, basic_end_date);
CREATE INDEX idx_wo_description_trgm ON work_orders USING GIN (description gin_trgm_ops);

ALTER TABLE maintenance_calls
  ADD CONSTRAINT fk_calls_wo FOREIGN KEY (work_order_id) REFERENCES work_orders(id);

CREATE TABLE work_order_operations (           -- SAP: AFVC
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  operation_number INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  work_center_id UUID NOT NULL REFERENCES work_centers(id),
  control_key control_key NOT NULL DEFAULT 'PM01_INTERNAL',
  duration_planned NUMERIC(8,2) NOT NULL,
  duration_actual NUMERIC(8,2) NOT NULL DEFAULT 0,
  number_of_workers INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN / IN_PROCESS / CONFIRMED
  UNIQUE (work_order_id, operation_number)
);

CREATE TABLE work_order_components (           -- SAP: RESB — Reserva de materiales
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_operation_id UUID REFERENCES work_order_operations(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  warehouse_id UUID REFERENCES warehouses(id),
  quantity_required NUMERIC(12,3) NOT NULL,
  quantity_withdrawn NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UN',
  status reservation_status NOT NULL DEFAULT 'OPEN'
);
CREATE INDEX idx_woc_material ON work_order_components(material_id);

CREATE TABLE time_confirmations (              -- SAP: AFRU — Confirmaciones de tiempo
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_operation_id UUID NOT NULL REFERENCES work_order_operations(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES users(id),
  work_date DATE NOT NULL,
  actual_hours NUMERIC(6,2) NOT NULL CHECK (actual_hours > 0),
  is_final_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  notes VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_timeconf_technician ON time_confirmations(technician_id, work_date);

-- Al confirmar tiempo, refleja la duración real acumulada en la operación
CREATE OR REPLACE FUNCTION fn_apply_time_confirmation() RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_order_operations
    SET duration_actual = duration_actual + NEW.actual_hours,
        status = CASE WHEN NEW.is_final_confirmation THEN 'CONFIRMED' ELSE 'IN_PROCESS' END
    WHERE id = NEW.work_order_operation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_time_confirmation
AFTER INSERT ON time_confirmations
FOR EACH ROW EXECUTE FUNCTION fn_apply_time_confirmation();

-- ---------------------------------------------------------------------
-- LÓGICA CLAVE: al crear una Orden de Trabajo con task_list_id, se copian
-- automáticamente las Operaciones y Componentes de la Hoja de Ruta.
-- Esto garantiza que Plan -> Item -> Hoja de Ruta -> Orden -> Repuestos
-- queden encadenados sin intervención manual.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_populate_work_order_from_task_list() RETURNS TRIGGER AS $$
DECLARE
  op RECORD;
  new_op_id UUID;
BEGIN
  IF NEW.task_list_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR op IN
    SELECT * FROM task_list_operations
    WHERE task_list_id = NEW.task_list_id
    ORDER BY operation_number
  LOOP
    INSERT INTO work_order_operations (
      work_order_id, operation_number, description, work_center_id,
      control_key, duration_planned, number_of_workers
    ) VALUES (
      NEW.id, op.operation_number, op.description, op.work_center_id,
      op.control_key, op.duration_value, op.number_of_workers
    ) RETURNING id INTO new_op_id;

    INSERT INTO work_order_components (
      work_order_id, work_order_operation_id, material_id, quantity_required, unit_of_measure
    )
    SELECT NEW.id, new_op_id, tlc.material_id, tlc.quantity, tlc.unit_of_measure
    FROM task_list_components tlc
    WHERE tlc.task_list_operation_id = op.id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wo_from_task_list
AFTER INSERT ON work_orders
FOR EACH ROW EXECUTE FUNCTION fn_populate_work_order_from_task_list();

-- =====================================================================
-- 10. COMPRAS (reposición de repuestos por punto de pedido)
-- =====================================================================

CREATE TABLE purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  work_order_id UUID REFERENCES work_orders(id),   -- opcional: reposición disparada por una OT
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status purchase_status NOT NULL DEFAULT 'REQUESTED'
);

CREATE TABLE purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_requisition_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  quantity NUMERIC(12,3) NOT NULL,
  needed_by DATE
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  supplier_name VARCHAR(150) NOT NULL,
  status purchase_status NOT NULL DEFAULT 'ORDERED',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  purchase_requisition_item_id UUID REFERENCES purchase_requisition_items(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  quantity_ordered NUMERIC(12,3) NOT NULL,
  quantity_received NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14,4)
);

-- =====================================================================
-- 11. MOVIMIENTOS DE STOCK
-- =====================================================================

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  movement_type movement_type NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(14,4),
  total_cost NUMERIC(14,2),
  work_order_id UUID REFERENCES work_orders(id),             -- consumo/devolución
  purchase_order_item_id UUID REFERENCES purchase_order_items(id),  -- ingreso por compra
  performed_by UUID REFERENCES users(id),
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes VARCHAR(255)
);
CREATE INDEX idx_stockmov_material_wh ON stock_movements(material_id, warehouse_id, movement_date DESC);

-- Aplica el movimiento al stock físico/reservado y actualiza la reserva de la OT
CREATE OR REPLACE FUNCTION fn_apply_stock_movement() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO stock (material_id, warehouse_id, quantity_on_hand)
  VALUES (NEW.material_id, NEW.warehouse_id, 0)
  ON CONFLICT (material_id, warehouse_id) DO NOTHING;

  IF NEW.movement_type IN ('GR_101_PURCHASE', 'GI_262_RETURN', 'ADJ_701_POSITIVE') THEN
    UPDATE stock SET quantity_on_hand = quantity_on_hand + NEW.quantity
      WHERE material_id = NEW.material_id AND warehouse_id = NEW.warehouse_id;
  ELSIF NEW.movement_type IN ('GI_261_CONSUMPTION', 'ADJ_702_NEGATIVE') THEN
    UPDATE stock SET quantity_on_hand = quantity_on_hand - NEW.quantity
      WHERE material_id = NEW.material_id AND warehouse_id = NEW.warehouse_id;
  END IF;

  IF NEW.movement_type = 'GI_261_CONSUMPTION' AND NEW.work_order_id IS NOT NULL THEN
    UPDATE work_order_components
      SET quantity_withdrawn = quantity_withdrawn + NEW.quantity,
          status = CASE WHEN quantity_withdrawn + NEW.quantity >= quantity_required
                        THEN 'WITHDRAWN'::reservation_status ELSE 'PARTIALLY_WITHDRAWN'::reservation_status END
      WHERE work_order_id = NEW.work_order_id
        AND material_id = NEW.material_id
        AND status IN ('OPEN', 'PARTIALLY_WITHDRAWN');
  END IF;

  IF NEW.movement_type = 'GI_262_RETURN' AND NEW.work_order_id IS NOT NULL THEN
    UPDATE work_order_components
      SET quantity_withdrawn = quantity_withdrawn - NEW.quantity,
          status = 'RETURNED'::reservation_status
      WHERE work_order_id = NEW.work_order_id AND material_id = NEW.material_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_movement
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_apply_stock_movement();

-- =====================================================================
-- 12. VISTAS PARA DASHBOARD Y KPIs
-- =====================================================================

-- Backlog de mantenimiento: OTs vencidas y no cerradas
CREATE VIEW vw_maintenance_backlog AS
SELECT wo.*, (CURRENT_DATE - wo.basic_end_date) AS days_overdue
FROM work_orders wo
WHERE wo.status NOT IN ('CLOSED', 'CANCELLED', 'TECHNICALLY_COMPLETED')
  AND wo.basic_end_date < CURRENT_DATE;

-- Cumplimiento del plan preventivo (%) por mes
CREATE VIEW vw_preventive_compliance AS
SELECT
  date_trunc('month', mc.scheduled_date) AS period,
  COUNT(*) FILTER (WHERE mc.status = 'COMPLETED') AS completed,
  COUNT(*) AS total_due,
  ROUND(100.0 * COUNT(*) FILTER (WHERE mc.status = 'COMPLETED') / NULLIF(COUNT(*), 0), 2) AS compliance_pct
FROM maintenance_calls mc
WHERE mc.scheduled_date <= CURRENT_DATE
GROUP BY 1;

-- MTTR (Mean Time To Repair) por equipo, a partir de avisos de falla (M1)
CREATE VIEW vw_mttr_by_equipment AS
SELECT
  n.equipment_id,
  AVG(EXTRACT(EPOCH FROM (n.malfunction_end - n.malfunction_start)) / 3600.0) AS mttr_hours
FROM notifications n
WHERE n.notification_type = 'M1_MALFUNCTION' AND n.malfunction_end IS NOT NULL
GROUP BY n.equipment_id;

-- MTBF (Mean Time Between Failures) por equipo
CREATE VIEW vw_mtbf_by_equipment AS
WITH failures AS (
  SELECT equipment_id, malfunction_start,
         LAG(malfunction_end) OVER (PARTITION BY equipment_id ORDER BY malfunction_start) AS prev_end
  FROM notifications
  WHERE notification_type = 'M1_MALFUNCTION' AND malfunction_start IS NOT NULL
)
SELECT equipment_id,
       AVG(EXTRACT(EPOCH FROM (malfunction_start - prev_end)) / 3600.0) AS mtbf_hours
FROM failures
WHERE prev_end IS NOT NULL
GROUP BY equipment_id;

-- Disponibilidad de equipo (%) aproximada: 1 - (tiempo parado / horizonte) usando MTBF y MTTR
CREATE VIEW vw_equipment_availability AS
SELECT
  b.equipment_id,
  b.mtbf_hours,
  r.mttr_hours,
  ROUND(100.0 * b.mtbf_hours / NULLIF(b.mtbf_hours + r.mttr_hours, 0), 2) AS availability_pct
FROM vw_mtbf_by_equipment b
JOIN vw_mttr_by_equipment r USING (equipment_id);

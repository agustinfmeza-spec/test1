/**
 * Smoke test end-to-end contra el backend real (servidor Next.js corriendo + Postgres).
 * Ejercita la cadena completa: Auth -> Maestros -> Hoja de Ruta -> Plan -> Simulación ->
 * Liberación de Orden -> Consumo de repuesto -> Correctivo -> KPIs -> RBAC.
 *
 * Uso: BASE_URL=http://localhost:3000 npx tsx scripts/e2e-smoke-test.ts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SUFFIX = Date.now().toString(36);

let failures = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`OK   ${msg}`);
  } else {
    console.error(`FAIL ${msg}`);
    failures++;
  }
}

async function login(email: string, password: string) {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookie = csrfRes.headers.getSetCookie().map((c) => c.split(";")[0]);

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: csrfCookie.join("; ") },
    body: new URLSearchParams({ csrfToken, email, password, json: "true" }),
    redirect: "manual",
  });
  const allCookies = [...csrfCookie, ...loginRes.headers.getSetCookie().map((c) => c.split(";")[0])];
  const sessionCookie = allCookies.filter((c, i, arr) => arr.findIndex((x) => x.split("=")[0] === c.split("=")[0]) === i).join("; ");
  return sessionCookie;
}

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  return { status: res.status, json };
}

async function main() {
  console.log(`Smoke test contra ${BASE_URL} (sufijo de datos: ${SUFFIX})\n`);

  // --- Auth ---
  const adminCookie = await login("admin@cmms.local", "Admin123!");
  const me = await api(adminCookie, "GET", "/me");
  assert(me.status === 200 && me.json.role === "ADMIN", "login admin + /api/me devuelve rol ADMIN");

  const noAuth = await api("", "GET", "/me");
  assert(noAuth.status === 401, "sin cookie de sesión /api/me devuelve 401");

  // --- Maestros ---
  const plant = await api(adminCookie, "POST", "/plants", { code: `P-${SUFFIX}`, name: "Planta Smoke Test" });
  assert(plant.status === 201, "crear planta");

  const fl = await api(adminCookie, "POST", "/functional-locations", {
    plant_id: plant.json.id,
    code: `FL-${SUFFIX}`,
    description: "Linea de prueba",
  });
  assert(fl.status === 201, "crear ubicación técnica");

  const wc = await api(adminCookie, "POST", "/work-centers", {
    plant_id: plant.json.id,
    code: `WC-${SUFFIX}`,
    name: "Taller de prueba",
    specialty: "Mecanico",
  });
  assert(wc.status === 201, "crear puesto de trabajo");

  const equipment = await api(adminCookie, "POST", "/equipment", {
    plant_id: plant.json.id,
    code: `EQ-${SUFFIX}`,
    description: "Equipo de prueba",
    functional_location_id: fl.json.id,
  });
  assert(equipment.status === 201, "crear equipo");

  const material = await api(adminCookie, "POST", "/materials", {
    code: `MAT-${SUFFIX}`,
    description: "Repuesto de prueba",
    unit_cost: 10,
  });
  assert(material.status === 201, "crear material");

  const warehouse = await api(adminCookie, "POST", "/warehouses", {
    plant_id: plant.json.id,
    code: `WH-${SUFFIX}`,
    description: "Almacén de prueba",
  });
  assert(warehouse.status === 201, "crear almacén");

  const bom = await api(adminCookie, "POST", `/equipment/${equipment.json.id}/bom`, {
    material_id: material.json.id,
    quantity: 1,
  });
  assert(bom.status === 201, "agregar repuesto al BOM del equipo");

  const taskList = await api(adminCookie, "POST", "/task-lists", {
    group_code: `HR-${SUFFIX}`,
    description: "Hoja de ruta de prueba",
    task_list_type: "EQUIPMENT",
    equipment_id: equipment.json.id,
    operations: [
      {
        operation_number: 10,
        description: "Operación de prueba",
        work_center_id: wc.json.id,
        duration_value: 1,
        components: [{ material_id: material.json.id, quantity: 3 }],
      },
    ],
  });
  assert(taskList.status === 201 && taskList.json.task_list_operations.length === 1, "crear hoja de ruta con operación y componente anidados");

  // --- Plan de mantenimiento + simulación + liberación ---
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28); // fuerza un llamado dentro del horizonte de 3 dias
  const plan = await api(adminCookie, "POST", "/maintenance-plans", {
    code: `PLAN-${SUFFIX}`,
    description: "Plan de prueba 30 dias",
    plan_type: "TIME_BASED",
    cycle_value: 30,
    cycle_unit: "DAY",
    start_date: startDate.toISOString().slice(0, 10),
  });
  assert(plan.status === 201, "crear plan de mantenimiento");

  const item = await api(adminCookie, "POST", `/maintenance-plans/${plan.json.id}/items`, {
    equipment_id: equipment.json.id,
    task_list_id: taskList.json.id,
  });
  assert(item.status === 201, "asociar ítem de mantenimiento al plan");

  const sim = await api(adminCookie, "POST", "/maintenance-plans/simulate", { planIds: [plan.json.id], horizonMonths: 6 });
  assert(sim.status === 200 && sim.json.dueNowCount >= 1, "simulación genera al menos un llamado vencido (dueNow)");

  const calls = await api(adminCookie, "GET", `/maintenance-calls?planId=${plan.json.id}&status=SCHEDULED`);
  assert(calls.status === 200 && calls.json.length >= 1, "GET /maintenance-calls devuelve el llamado SCHEDULED");
  const callId = calls.json[0]?.id;

  const release = await api(adminCookie, "POST", `/maintenance-calls/${callId}/release`);
  assert(release.status === 201 && release.json.createdOrders.length === 1, "liberar llamado genera Orden de Trabajo");
  const workOrderId = release.json.createdOrders[0].id;

  const woDetail = await api(adminCookie, "GET", `/work-orders/${workOrderId}`);
  assert(
    woDetail.status === 200 && woDetail.json.work_order_operations.length === 1 && woDetail.json.work_order_components.length === 1,
    "el trigger SQL copió operación y componente de la hoja de ruta a la orden",
  );

  // --- Inventario: ingreso, consumo, stock ---
  const stockIn = await api(adminCookie, "POST", "/stock-movements", {
    material_id: material.json.id,
    warehouse_id: warehouse.json.id,
    movement_type: "GR_101_PURCHASE",
    quantity: 10,
  });
  assert(stockIn.status === 201, "ingreso de stock por compra");

  const componentId = woDetail.json.work_order_components[0].id;
  const withdraw = await api(adminCookie, "POST", `/work-orders/${workOrderId}/components/${componentId}/withdraw`, {
    warehouse_id: warehouse.json.id,
    quantity: 3,
  });
  assert(withdraw.status === 201 && withdraw.json.component.status === "WITHDRAWN", "consumo de repuesto marca el componente como WITHDRAWN");

  const stockAfter = await api(adminCookie, "GET", `/stock?warehouseId=${warehouse.json.id}`);
  const qty = Number(stockAfter.json.data[0]?.quantity_on_hand);
  assert(qty === 7, `stock descontado correctamente (esperado 7, obtenido ${qty})`);

  // --- Correctivo desde aviso ---
  const notif = await api(adminCookie, "POST", "/notifications", {
    code: `AV-${SUFFIX}`,
    notification_type: "M1_MALFUNCTION",
    equipment_id: equipment.json.id,
    description: "Falla de prueba",
    is_breakdown: true,
  });
  assert(notif.status === 201, "crear aviso de avería");

  const convert = await api(adminCookie, "POST", `/notifications/${notif.json.id}/convert-to-work-order`, {});
  assert(convert.status === 201 && convert.json.order_type === "CORRECTIVE", "convertir aviso en orden correctiva");

  // --- RBAC: técnico no puede crear plantas ---
  const techCookie = await login("tecnico@cmms.local", "Tecnico123!");
  const forbiddenPlant = await api(techCookie, "POST", "/plants", { code: `X-${SUFFIX}`, name: "no debería crearse" });
  assert(forbiddenPlant.status === 403, "un Técnico no puede crear plantas (403)");

  // --- KPIs ---
  const kpis = await api(adminCookie, "GET", "/dashboard/kpis");
  assert(kpis.status === 200 && typeof kpis.json.backlog.count === "number", "dashboard KPIs responde con backlog numérico");

  console.log(`\n${failures === 0 ? "SMOKE TEST OK" : `SMOKE TEST FALLÓ (${failures} aserciones)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Error inesperado en el smoke test:", err);
  process.exit(1);
});

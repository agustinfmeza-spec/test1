/**
 * Smoke test de UI end-to-end con Playwright, contra el servidor real (dev o build).
 * Complementa a e2e-smoke-test.ts (que ejercita solo la API): este valida que
 * la interfaz realmente funcione en un navegador — login, grilla, filtros,
 * modo oscuro, detalle de orden, transición de estado y carga de horas.
 *
 * Uso: BASE_URL=http://localhost:3000 npx tsx scripts/e2e-ui-smoke-test.ts
 * Requiere el backend con datos de ../e2e-smoke-test.ts o del seed ya corridos
 * (usa las órdenes PLAN-*-C1 generadas por el smoke test de API).
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`OK   ${msg}`);
  } else {
    console.error(`FAIL ${msg}`);
    failures++;
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // --- redirect sin sesion ---
  await page.goto(`${BASE_URL}/work-orders`);
  assert(page.url().includes("/login"), "sin sesión, /work-orders redirige a /login");

  // --- login ---
  await page.fill("#email", "admin@cmms.local");
  await page.fill("#password", "Admin123!");
  await page.click('button[type=submit]');
  await page.waitForURL("**/work-orders", { timeout: 10000 });
  assert(true, "login exitoso, redirige a /work-orders");

  // --- grilla carga datos ---
  await page.waitForSelector(".ag-row", { timeout: 10000 }).catch(() => null);
  const rowCount = await page.locator(".ag-row").count();
  assert(rowCount > 0, `la grilla de órdenes muestra filas (${rowCount})`);

  // --- busqueda filtra ---
  await page.fill('input[placeholder*="Buscar"]', "PLAN");
  await page.waitForTimeout(600);
  const filteredCount = await page.locator(".ag-row").count();
  assert(filteredCount > 0 && filteredCount <= rowCount, `la búsqueda 'PLAN' filtra filas (${filteredCount} de ${rowCount})`);
  await page.fill('input[placeholder*="Buscar"]', "");
  await page.waitForTimeout(400);

  // --- modo oscuro ---
  await page.click('button[title="Cambiar a modo oscuro"]');
  await page.waitForTimeout(300);
  const themeAttr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  assert(themeAttr === "dark", "el toggle de tema setea data-theme=dark en <html>");
  await page.click('button[title="Cambiar a modo claro"]');
  await page.waitForTimeout(200);

  // --- detalle + transicion de estado ---
  const link = page.locator('a[href^="/work-orders/"]').first();
  const code = await link.innerText();
  await link.click();
  await page.waitForURL("**/work-orders/*", { timeout: 10000 });
  assert(true, `navega al detalle de la orden ${code}`);

  const statusBefore = await page.locator("h1").locator("~ span").first().innerText();
  const actionButton = page.locator("button").filter({ hasText: /Liberada|Cancelada|proceso|Completada|Cierre técnico|Cerrada/ }).first();
  if (await actionButton.count()) {
    const label = await actionButton.innerText();
    await actionButton.click();
    await page.waitForTimeout(600);
    const statusAfter = await page.locator("h1").locator("~ span").first().innerText();
    assert(statusAfter !== statusBefore, `transición de estado ('${label}') cambia el badge de estado (${statusBefore} -> ${statusAfter})`);
  } else {
    console.log("SKIP transición de estado (orden sin transiciones disponibles para este rol/estado)");
  }

  // --- carga de horas (si hay operaciones) ---
  const hoursInput = page.locator('input[type=number]').first();
  if (await hoursInput.count()) {
    await hoursInput.fill("0.5");
    await page.click('button:text("Cargar")');
    await page.waitForTimeout(600);
    const confirmMsg = await page.locator("text=Horas registradas.").count();
    assert(confirmMsg > 0, "notificar horas muestra confirmación");
  } else {
    console.log("SKIP carga de horas (orden sin operaciones)");
  }

  assert(pageErrors.length === 0, `sin errores de JS en consola del navegador (${pageErrors.length} encontrados: ${pageErrors.join("; ")})`);

  await browser.close();

  console.log(`\n${failures === 0 ? "UI SMOKE TEST OK" : `UI SMOKE TEST FALLÓ (${failures} aserciones)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Error inesperado en el smoke test de UI:", err);
  process.exit(1);
});

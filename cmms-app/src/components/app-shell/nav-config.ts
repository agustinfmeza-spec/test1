export interface NavItem {
  label: string;
  href: string;
}

/**
 * Navegación del shell autenticado. Se agrega un ítem por cada pantalla a
 * medida que se construye — mantenerla mínima evita links a rutas 404.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Órdenes de Trabajo", href: "/work-orders" },
  { label: "Avisos", href: "/notifications" },
  { label: "Planes de Mantenimiento", href: "/maintenance-plans" },
  { label: "Calendario de Simulación", href: "/scheduling" },
  { label: "Ubicaciones y Equipos", href: "/locations" },
  { label: "Materiales", href: "/materials" },
  { label: "Hojas de Ruta", href: "/task-lists" },
  { label: "Inventario", href: "/inventory/stock" },
  { label: "Movimientos de Stock", href: "/inventory/movements" },
  { label: "Compras", href: "/purchasing/orders" },
];

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Navegación del shell autenticado. Se agrega un ítem por cada pantalla a
 * medida que se construye — mantenerla mínima evita links a rutas 404.
 */
export const NAV_ITEMS: NavItem[] = [{ label: "Órdenes de Trabajo", href: "/work-orders" }];

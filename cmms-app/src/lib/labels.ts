export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  PLANNER: "Planificador",
  TECHNICIAN: "Técnico",
  WAREHOUSE: "Depósito",
  VIEWER: "Solo lectura",
};

export const OPERATION_STATUS_LABELS: Record<string, string> = {
  OPEN: "Pendiente",
  IN_PROCESS: "En proceso",
  CONFIRMED: "Confirmada",
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Correctivo",
  PREVENTIVE: "Preventivo",
  PREDICTIVE: "Predictivo",
  INSPECTION: "Inspección",
  IMPROVEMENT: "Mejora",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  CREATED: "Creada",
  RELEASED: "Liberada",
  IN_PROCESS: "En proceso",
  COMPLETED: "Completada",
  TECHNICALLY_COMPLETED: "Cierre técnico",
  CLOSED: "Cerrada",
  CANCELLED: "Cancelada",
};

export const PRIORITY_LABELS: Record<string, string> = {
  EMERGENCY: "Emergencia",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

/** Tono semántico por estado de OT, usado por StatusBadge (mapea a las variables --success/--warning/etc). */
export const ORDER_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  CREATED: "neutral",
  RELEASED: "info",
  IN_PROCESS: "warning",
  COMPLETED: "success",
  TECHNICALLY_COMPLETED: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
};

export const PRIORITY_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  EMERGENCY: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "neutral",
};

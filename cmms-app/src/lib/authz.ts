import { auth } from "@/auth";
import { forbidden, unauthorized } from "@/lib/api-error";

export type Role = "ADMIN" | "PLANNER" | "TECHNICIAN" | "WAREHOUSE" | "VIEWER";

export interface AuthedSession {
  userId: string;
  role: Role;
  workCenterId: string | null;
}

/** Obtiene la sesión actual o lanza 401. Usar al inicio de todo route handler protegido. */
export async function requireSession(): Promise<AuthedSession> {
  const session = await auth();
  if (!session?.user) {
    throw unauthorized();
  }
  return {
    userId: session.user.id,
    role: session.user.role as Role,
    workCenterId: session.user.workCenterId,
  };
}

/** Exige que la sesión tenga uno de los roles indicados; ADMIN siempre pasa. */
export async function requireRole(...allowed: Role[]): Promise<AuthedSession> {
  const session = await requireSession();
  if (session.role === "ADMIN") return session;
  if (!allowed.includes(session.role)) {
    throw forbidden(`Esta acción requiere el rol: ${allowed.join(" o ")}`);
  }
  return session;
}

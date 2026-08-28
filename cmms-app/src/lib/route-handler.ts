import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-error";

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * Envuelve un Route Handler para centralizar el manejo de errores:
 * ApiError (401/403/404/400/409), errores de validación Zod (400) y
 * errores conocidos de Prisma (unicidad, FK, not found) mapeados a HTTP.
 */
export function withHandler<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Datos inválidos", details: err.flatten() }, { status: 400 });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          return NextResponse.json({ error: "Ya existe un registro con esos valores únicos", meta: err.meta }, { status: 409 });
        }
        if (err.code === "P2003") {
          return NextResponse.json({ error: "Referencia inválida a otro recurso", meta: err.meta }, { status: 400 });
        }
        if (err.code === "P2025") {
          return NextResponse.json({ error: "Recurso no encontrado" }, { status: 404 });
        }
        if (err.code === "P2000" || err.code === "23514") {
          return NextResponse.json({ error: "Valor fuera de rango permitido", meta: err.meta }, { status: 400 });
        }
      }
      // Restricciones CHECK de Postgres (no representadas en Prisma) llegan como error crudo
      if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23514") {
        return NextResponse.json({ error: "Violación de restricción de datos", meta: (err as { meta?: unknown }).meta }, { status: 400 });
      }

      console.error("Unhandled API error:", err);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
  };
}

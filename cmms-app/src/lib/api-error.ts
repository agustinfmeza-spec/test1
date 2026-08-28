export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const unauthorized = (message = "No autenticado") => new ApiError(401, message);
export const forbidden = (message = "No tiene permisos para esta acción") => new ApiError(403, message);
export const notFound = (message = "Recurso no encontrado") => new ApiError(404, message);
export const badRequest = (message = "Solicitud inválida", details?: unknown) => new ApiError(400, message, details);
export const conflict = (message = "Conflicto con el estado actual del recurso") => new ApiError(409, message);

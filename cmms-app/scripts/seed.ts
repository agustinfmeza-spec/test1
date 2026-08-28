import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function upsertUser(email: string, fullName: string, role: "ADMIN" | "PLANNER" | "TECHNICIAN", password: string) {
  const password_hash = await bcrypt.hash(password, 10);
  return prisma.users.upsert({
    where: { email },
    update: { password_hash, role, full_name: fullName, active: true },
    create: { email, password_hash, role, full_name: fullName },
  });
}

async function main() {
  const admin = await upsertUser("admin@cmms.local", "Administrador CMMS", "ADMIN", "Admin123!");
  const planner = await upsertUser("planificador@cmms.local", "Ana Planificadora", "PLANNER", "Planner123!");
  const technician = await upsertUser("tecnico@cmms.local", "Juan Técnico", "TECHNICIAN", "Tecnico123!");

  console.log("Usuarios de prueba creados/actualizados:");
  console.log({ admin: admin.email, planner: planner.email, technician: technician.email });
  console.log("\nContraseñas (solo para entorno de desarrollo):");
  console.log("  admin@cmms.local        / Admin123!");
  console.log("  planificador@cmms.local / Planner123!");
  console.log("  tecnico@cmms.local      / Tecnico123!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fallo el seed:", err);
    process.exit(1);
  });

import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const plantCount = await prisma.plants.count();
  const modelNames = Object.keys(prisma).filter((k) => !k.startsWith("_") && !k.startsWith("$"));
  console.log("Conexion OK. plants count:", plantCount);
  console.log("Modelos disponibles:", modelNames.length);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FALLO conectividad Prisma:", err);
    process.exit(1);
  });

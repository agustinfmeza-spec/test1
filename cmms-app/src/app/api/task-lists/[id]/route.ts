import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";
import { notFound } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withHandler<Ctx>(async (_req, ctx) => {
  await requireSession();
  const { id } = await ctx.params;
  const taskList = await prisma.task_lists.findUnique({
    where: { id },
    include: {
      equipment: true,
      functional_locations: true,
      task_list_operations: {
        orderBy: { operation_number: "asc" },
        include: { work_centers: true, task_list_components: { include: { materials: true } } },
      },
    },
  });
  if (!taskList) throw notFound("Hoja de ruta no encontrada");
  return NextResponse.json(taskList);
});

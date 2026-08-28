import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { withHandler } from "@/lib/route-handler";

export const GET = withHandler(async () => {
  const session = await requireSession();
  return NextResponse.json(session);
});

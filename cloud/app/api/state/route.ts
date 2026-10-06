import { NextResponse } from "next/server";
import { authUser } from "@/src/lib/auth";
import { userState } from "@/src/lib/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await userState(user));
}

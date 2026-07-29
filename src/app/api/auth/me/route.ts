import { NextResponse } from "next/server";
import { getCurrentUser } from "@/auth/currentUser";
import { toPublicUser } from "@/types/user";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? toPublicUser(user) : null });
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import ChatShell from "./components/chat/ChatShell";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ChatShell userName={user.name} />;
}

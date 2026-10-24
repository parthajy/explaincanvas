import { getSessionUser } from "@/lib/auth/session";
import { ChatView } from "@/components/ChatView";
import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

/** Visitors see the landing page; signed-in parents and students land in the chat. */
export default async function Home() {
  const user = await getSessionUser();
  if (!user) return <Landing />;
  return <ChatView chatId={null} />;
}

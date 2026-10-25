import { getSessionUser } from "@/lib/auth/session";
import { ChatView } from "@/components/ChatView";
import { Landing } from "@/components/Landing";
import { AppOnboarding } from "@/components/AppOnboarding";
import { isAppMode } from "@/lib/appmode";

export const dynamic = "force-dynamic";

/** Visitors see the landing page; inside the Android app they see the onboarding screens; signed-in users land in the chat. */
export default async function Home() {
  const user = await getSessionUser();
  if (!user) return (await isAppMode()) ? <AppOnboarding /> : <Landing />;
  return <ChatView chatId={null} />;
}

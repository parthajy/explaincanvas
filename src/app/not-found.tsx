import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight">That page is not here</h1>
      <p className="mt-2 text-muted">The link may be old, or the lesson may not be published yet.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary">
          Go home
        </Link>
        <Link href="/library" className="rounded-xl border border-border px-4 py-2 text-sm">
          Browse the library
        </Link>
      </div>
    </div>
  );
}

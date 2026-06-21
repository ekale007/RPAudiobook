import Link from "next/link";

export default function DevImageGeneratorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium text-zinc-200">Not in public repo</h1>
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">
        Local GPU image tooling was removed from the open-source tree. Library batch
        covers: <code className="text-zinc-300">npm run covers:missing</code>
      </p>
      <Link href="/" className="text-sm text-accent underline">
        Home
      </Link>
    </main>
  );
}

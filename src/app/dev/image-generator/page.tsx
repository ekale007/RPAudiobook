import Link from "next/link";

export default function DevImageGeneratorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-lg font-medium text-zinc-200">Bildstudio ausgelagert</h1>
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">
        Die GUI für lokale GPU-Bilder liegt im eigenständigen Ordner{" "}
        <code className="text-zinc-300">image-studio/</code> — später als eigenes
        Repo nutzbar.
      </p>
      <pre className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 text-left text-xs text-zinc-400">
        {`cd image-studio
.\\scripts\\install.ps1
npm install
npm run dev`}
      </pre>
      <p className="text-xs text-zinc-500">
        Batch-Cover für die Bibliothek: weiterhin{" "}
        <code className="text-zinc-400">npm run covers:missing</code>
      </p>
      <Link href="/" className="text-sm text-accent underline">
        Startseite
      </Link>
    </main>
  );
}

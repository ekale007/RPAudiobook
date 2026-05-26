export function formatAuthError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err);

  if (/rate limit/i.test(msg)) {
    return (
      "Supabase email limit reached for this project (only a few auth emails per hour " +
      "on the free plan). Wait about an hour or configure custom SMTP in Supabase."
    );
  }

  if (/invalid login credentials/i.test(msg)) {
    return "Wrong email or password. Use Sign up if you have no account yet.";
  }

  if (/email not confirmed/i.test(msg)) {
    return (
      "Email not confirmed. In Supabase disable “Confirm email” for dev, or confirm via mail."
    );
  }

  return msg;
}

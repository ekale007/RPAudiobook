import { redirect } from "next/navigation";
import { isInviteOnlyBeta } from "@/lib/auth/betaAuth";
import SignUpPageContent from "./SignUpPageContent";

// Server-side guard: invite-only visitors never see the signup form.
// Defense-in-depth — Supabase also rejects signUp() server-side, but
// this avoids the round-trip and prevents accidental 403s in the UI.
export default function SignUpPage() {
  if (isInviteOnlyBeta()) {
    redirect("/login");
  }

  return <SignUpPageContent />;
}

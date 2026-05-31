/** Invite-only beta: no public sign-up; guests need a Supabase invite. */
export function isInviteOnlyBeta(): boolean {
  const flag = process.env.NEXT_PUBLIC_BETA_INVITE_ONLY?.trim();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function showAnonymousDevLogin(): boolean {
  return process.env.NODE_ENV === "development" && !isInviteOnlyBeta();
}

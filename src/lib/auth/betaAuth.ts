/** Invite-only when NEXT_PUBLIC_BETA_INVITE_ONLY=1 — otherwise public e-mail sign-up is allowed. */
export function isInviteOnlyBeta(): boolean {
  const flag = process.env.NEXT_PUBLIC_BETA_INVITE_ONLY?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function showAnonymousDevLogin(): boolean {
  return process.env.NODE_ENV === "development" && !isInviteOnlyBeta();
}

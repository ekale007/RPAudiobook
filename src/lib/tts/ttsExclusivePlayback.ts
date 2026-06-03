/** Which assistant turn may output audio right now (autoplay queue). */
let exclusiveTurnId: string | null = null;

export function setExclusiveTtsTurn(turnId: string | null): void {
  exclusiveTurnId = turnId;
}

export function getExclusiveTtsTurn(): string | null {
  return exclusiveTurnId;
}

export function isExclusiveTtsTurn(turnId: string): boolean {
  return exclusiveTurnId === turnId;
}

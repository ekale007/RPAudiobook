const DISMISS_KEY = "rp-audiobook.pwa-install-dismissed";

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && webkit && notOther;
}

export function isMobileUa(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

export function wasInstallDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

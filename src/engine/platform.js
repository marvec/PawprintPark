// Runtime platform questions (CLAUDE.md: one bundle, every platform; never branch on build flags).
// The web bundle has no npm dependency on Capacitor; inside the apps it talks to the bridge Capacitor injects.

/** True inside the iOS or Android app. */
export const isNative = () => !!globalThis.Capacitor?.isNativePlatform?.();

/** 'ios' | 'android' | 'web' */
export const os = () => globalThis.Capacitor?.getPlatform?.() ?? 'web';

/** A coarse pointer: phones and tablets. */
export const isTouch = () => !!globalThis.matchMedia?.('(pointer: coarse)').matches;

/** The player asked the OS for less motion. */
export const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A Capacitor plugin by name, or null on the web. */
export const plugin = (name) => globalThis.Capacitor?.Plugins?.[name] ?? null;

/**
 * Calls fn(active) when the app goes to the background or comes back.
 * @param {(active: boolean) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onAppState(fn) {
  const app = plugin('App');
  if (app?.addListener) {
    const handle = app.addListener('appStateChange', ({ isActive }) => fn(isActive));
    return () => handle?.remove?.();
  }
  const listener = () => fn(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

/** Classes on <html> for CSS: data-platform, touch. */
export function initPlatform() {
  const html = document.documentElement;
  html.dataset.platform = os();
  html.classList.toggle('touch', isTouch());
}

import { useEffect } from 'react';

// Shared focus management for the existing modal layouts, including portaled
// Wiki autocomplete controls. Each dialog retains its own save/cancel handlers.
export function DialogAccessibility() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    const visibleDialogs = () => Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).filter(el => el.getClientRects().length);
    const update = () => {
      const next = visibleDialogs().at(-1) || null;
      if (next === active) return;
      if (next) {
        if (!active) previous = document.activeElement as HTMLElement;
        active = next;
        (next.querySelector<HTMLElement>('input:not([type="file"]):not([type="hidden"]), textarea, button, [tabindex="0"]') || next).focus();
      } else { active = null; previous?.isConnected && previous.focus(); previous = null; }
    };
    const observer = new MutationObserver(update); observer.observe(document.body, { childList: true, subtree: true }); update();
    const keydown = (event: KeyboardEvent) => {
      if (!active || event.key !== 'Tab') return;
      const roots = [active, ...document.querySelectorAll<HTMLElement>('.entity-selector-dropdown')];
      const controls = roots.flatMap(root => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'))).filter(el => el.getClientRects().length);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (!controls.length) { event.preventDefault(); active.focus(); }
      else if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)!.focus(); }
      else if (!event.shiftKey && (index === controls.length - 1 || index < 0)) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { observer.disconnect(); document.removeEventListener('keydown', keydown); };
  }, []);
  return null;
}

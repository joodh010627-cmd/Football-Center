/**
 * The phone's 뒤로 가기, wired to the in-app navigation stack.
 *
 * The app has no router — navigation is a stack of screens in React state — so
 * to the browser the whole thing is one page, and Android's back button meant
 * "leave the app" no matter how deep you were. A coach four screens into a
 * student profile pressed the button they press everywhere else and lost the
 * session. This keeps a shadow of the stack in `window.history`: one entry per
 * open screen, so the system's 뒤로 pops one screen instead of closing the tab.
 *
 * Tab switches are deliberately *not* history entries. The bottom bar empties a
 * tab's stack on tap, so a back that "undid" a tab tap would land you on a tab
 * whose screens had already been thrown away. Back means one screen up within
 * the tab you are on, and nothing else.
 *
 * Both directions are handled, because the app pops itself too — 완료 on the
 * register, a tab tap that drops three screens at once. Whenever the real depth
 * falls below what history is holding, we walk history back by the difference
 * and ignore the `popstate` that answers, so the two never drift.
 *
 * Leaving is a two-press gesture. The entries above are stacked on a *guard*
 * entry pushed at mount, so a 뒤로 at the top of a tab lands on the guard rather
 * than off the end of the app: we catch it, put the guard back, and say so. Only
 * a second press inside `EXIT_WINDOW` is allowed through. Without the guard
 * there is nothing to catch — the page is already unloading by the time any
 * handler could run, which is exactly the "너무 갑자기 나가진다" the coaches hit:
 * one stray thumb on a 60px bar and the evening's work was gone.
 */

import { useEffect, useRef } from 'react';

/** How long the second press counts as "yes, I meant it". */
export const EXIT_WINDOW = 2000;

export function useSystemBack(depth: number, onBack: () => void, onExitPrompt: () => void) {
  // Read through refs: both callbacks close over the current route and are new
  // functions every render, but the listener is attached once.
  const back = useRef(onBack);
  back.current = onBack;
  const prompt = useRef(onExitPrompt);
  prompt.current = onExitPrompt;

  /** Entries we have pushed to stand for open screens, above the guard. */
  const held = useRef(0);
  /** `history.go` calls we made ourselves and must not read as a user 뒤로. */
  const ours = useRef(0);
  /** When the "한 번 더" offer lapses. */
  const armedUntil = useRef(0);
  /** StrictMode remounts this effect; the guard must still be pushed once. */
  const guarded = useRef(false);

  useEffect(() => {
    if (!guarded.current) {
      guarded.current = true;
      window.history.pushState({ guard: true }, '');
    }

    const onPopState = () => {
      if (ours.current > 0) {
        ours.current -= 1;
        return;
      }

      if (held.current > 0) {
        held.current -= 1;
        back.current();
        return;
      }

      // Off the top of a tab: this was an attempt to leave, and we are now
      // standing on the entry the user arrived from.
      if (Date.now() < armedUntil.current) {
        armedUntil.current = 0;
        window.history.back();
        return;
      }

      window.history.pushState({ guard: true }, '');
      armedUntil.current = Date.now() + EXIT_WINDOW;
      prompt.current();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (depth > held.current) {
      // A cross-tab jump can land two deep at once, hence the loop.
      for (let i = held.current; i < depth; i += 1) {
        window.history.pushState({ depth: i + 1 }, '');
      }
      held.current = depth;
    } else if (depth < held.current) {
      const steps = held.current - depth;
      held.current = depth;
      // One `go` produces one `popstate` however far it travels.
      ours.current += 1;
      window.history.go(-steps);
    }
  }, [depth]);
}

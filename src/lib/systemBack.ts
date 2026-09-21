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
 */

import { useEffect, useRef } from 'react';

export function useSystemBack(depth: number, onBack: () => void) {
  // Read through a ref: `onBack` closes over the current route and is a new
  // function every render, but the listener is attached once.
  const back = useRef(onBack);
  back.current = onBack;

  /** Entries we have pushed to stand for open screens. */
  const held = useRef(0);
  /** `history.go` calls we made ourselves and must not read as a user 뒤로. */
  const ours = useRef(0);

  useEffect(() => {
    const onPopState = () => {
      if (ours.current > 0) {
        ours.current -= 1;
        return;
      }
      if (held.current === 0) return;
      held.current -= 1;
      back.current();
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

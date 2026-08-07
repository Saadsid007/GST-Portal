"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body.
 *
 * This is not optional polish. An ancestor with `filter`, `backdrop-filter`,
 * `transform`, `perspective`, `contain: paint` or `will-change` on those
 * becomes the containing block for `position: fixed` descendants — so a
 * `fixed inset-0` overlay stops meaning "the viewport" and starts meaning
 * "that ancestor's box".
 *
 * The app header carries `backdrop-blur-xl`. Measured: an overlay rendered
 * inside it resolved to 64px tall (the header) instead of the full 720px
 * viewport, which is why the command palette appeared crushed against the top
 * of the screen. Portalling to body escapes the containing block entirely.
 *
 * Radix's own menus portal for exactly this reason; anything hand-rolled has to
 * do the same.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  // document does not exist during SSR, so the portal can only be created after
  // mount. useSyncExternalStore keeps the first client paint identical to the
  // server HTML instead of setting state inside an effect.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) return null;
  return createPortal(children, document.body);
}

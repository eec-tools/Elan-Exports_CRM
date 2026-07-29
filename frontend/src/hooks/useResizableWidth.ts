import { useCallback, useEffect, useState } from "react";

/**
 * Draggable-width state for a left-hand panel whose resize handle sits on its
 * right edge (dragging right grows the panel). Width persists per `storageKey`.
 */
export function useResizableWidth(storageKey: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const parsed = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : initial;
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      function onMove(ev: MouseEvent) {
        const next = startWidth + (ev.clientX - startX);
        setWidth(Math.min(max, Math.max(min, next)));
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, min, max],
  );

  return { width, setWidth, onMouseDown };
}

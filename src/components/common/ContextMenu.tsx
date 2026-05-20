"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ContextMenuEntry =
  | {
      id: string;
      type?: "item";
      label: string;
      disabled?: boolean;
      tone?: "default" | "danger";
      onSelect?: () => void;
      children?: ContextMenuEntry[];
    }
  | {
      id: string;
      type: "separator";
    };

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

const ROOT_MENU_WIDTH = 272;
const SUBMENU_WIDTH = 336;
const VIEWPORT_PADDING = 12;
const MAX_MENU_HEIGHT = 560;

function estimateMenuHeight(items: ContextMenuEntry[]) {
  return items.reduce((height, item) => {
    if (item.type === "separator") {
      return height + 12;
    }

    return height + 38;
  }, 12);
}

function resolveMenuHeight(items: ContextMenuEntry[]) {
  return Math.min(
    estimateMenuHeight(items),
    Math.max(180, window.innerHeight - VIEWPORT_PADDING * 2),
    MAX_MENU_HEIGHT,
  );
}

function clampMenuPosition(x: number, y: number, width: number, height: number): MenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const nextLeft =
    x + width > viewportWidth - VIEWPORT_PADDING
      ? Math.max(VIEWPORT_PADDING, x - width)
      : x;
  const nextTop = Math.min(
    Math.max(VIEWPORT_PADDING, y),
    Math.max(VIEWPORT_PADDING, viewportHeight - height - VIEWPORT_PADDING),
  );

  return {
    left: nextLeft,
    top: nextTop,
  };
}

function buildSubmenuPosition(
  anchorRect: DOMRect,
  items: ContextMenuEntry[],
  rootPosition: MenuPosition,
): MenuPosition {
  const height = resolveMenuHeight(items);
  const openLeft =
    anchorRect.right + SUBMENU_WIDTH > window.innerWidth - VIEWPORT_PADDING;
  const left = openLeft
    ? Math.max(VIEWPORT_PADDING, anchorRect.left - SUBMENU_WIDTH - 4)
    : Math.min(anchorRect.right + 4, window.innerWidth - SUBMENU_WIDTH - VIEWPORT_PADDING);
  const top = Math.min(
    Math.max(VIEWPORT_PADDING, anchorRect.top),
    Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING),
  );

  if (Number.isNaN(left) || Number.isNaN(top)) {
    return rootPosition;
  }

  return { left, top };
}

export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [submenu, setSubmenu] = useState<{
    parentId: string;
    items: ContextMenuEntry[];
    anchorRect: DOMRect;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      const timeout = window.setTimeout(() => setSubmenu(null), 0);
      return () => window.clearTimeout(timeout);
    }

    return;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
      }
    },
    [],
  );

  const rootPosition = useMemo(() => {
    if (!open || typeof window === "undefined") {
      return { left: x, top: y };
    }

    return clampMenuPosition(x, y, ROOT_MENU_WIDTH, resolveMenuHeight(items));
  }, [items, open, x, y]);

  const submenuPosition = useMemo(() => {
    if (!submenu || typeof window === "undefined") {
      return null;
    }

    return buildSubmenuPosition(submenu.anchorRect, submenu.items, rootPosition);
  }, [rootPosition, submenu]);

  const rootMenuHeight =
    open && typeof window !== "undefined" ? resolveMenuHeight(items) : estimateMenuHeight(items);
  const submenuHeight =
    submenu && typeof window !== "undefined"
      ? resolveMenuHeight(submenu.items)
      : submenu
        ? estimateMenuHeight(submenu.items)
        : 0;

  if (!open || typeof document === "undefined") {
    return null;
  }

  function queueSubmenuOpen(
    entry: Extract<ContextMenuEntry, { type?: "item" }>,
    target: EventTarget & HTMLButtonElement,
  ) {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }

    if (!entry.children?.length || entry.disabled) {
      setSubmenu(null);
      return;
    }

    const anchorRect = target.getBoundingClientRect();
    hoverTimeoutRef.current = window.setTimeout(() => {
      setSubmenu({
        parentId: entry.id,
        items: entry.children ?? [],
        anchorRect,
      });
    }, 100);
  }

  function clearHoverTimeout() {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }

  function renderItems(menuItems: ContextMenuEntry[], level: "root" | "submenu") {
    return menuItems.map((entry) => {
      if (entry.type === "separator") {
        return (
          <div key={entry.id} className="px-2 py-1">
            <div className="border-t border-[var(--border-secondary)]" />
          </div>
        );
      }

      const hasChildren = Boolean(entry.children?.length);
      const isActiveSubmenu = submenu?.parentId === entry.id;
      const textColor =
        entry.tone === "danger" ? "text-[var(--state-danger)]" : "text-[var(--foreground)]";

      return (
        <button
          key={`${level}-${entry.id}`}
          type="button"
          disabled={entry.disabled}
          onClick={() => {
            if (entry.disabled || hasChildren || !entry.onSelect) {
              return;
            }

            entry.onSelect();
            onClose();
          }}
          onMouseEnter={(event) => queueSubmenuOpen(entry, event.currentTarget)}
          onMouseLeave={() => {
            if (!hasChildren) {
              clearHoverTimeout();
            }
          }}
          className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[12px] transition ${
            entry.disabled
              ? "cursor-not-allowed text-[var(--muted)] opacity-50"
              : isActiveSubmenu
                ? "bg-[var(--paper-secondary)]"
                : "hover:bg-[var(--paper-secondary)]"
          }`}
        >
          <span className={`min-w-0 flex-1 whitespace-normal leading-5 ${textColor}`}>
            {entry.label}
          </span>
          {hasChildren ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-tertiary)]" />
          ) : null}
        </button>
      );
    });
  }

  return createPortal(
    <div ref={containerRef} className="fixed inset-0 z-[80] pointer-events-none">
      <div
        className="pointer-events-auto fixed overflow-hidden rounded-[14px] border border-[var(--border-primary)] bg-[var(--paper-primary)] p-2 shadow-[0_16px_40px_rgba(12,12,18,0.16)]"
        style={{
          left: rootPosition.left,
          top: rootPosition.top,
          width: ROOT_MENU_WIDTH,
          maxHeight: rootMenuHeight,
        }}
      >
        <div
          style={{
            maxHeight: rootMenuHeight - 16,
            overflowY: estimateMenuHeight(items) > rootMenuHeight ? "auto" : "visible",
          }}
        >
          {renderItems(items, "root")}
        </div>
      </div>

      {submenu && submenuPosition ? (
        <div
          className="pointer-events-auto fixed overflow-hidden rounded-[14px] border border-[var(--border-primary)] bg-[var(--paper-primary)] p-2 shadow-[0_16px_40px_rgba(12,12,18,0.16)]"
          style={{
            left: submenuPosition.left,
            top: submenuPosition.top,
            width: SUBMENU_WIDTH,
            maxHeight: submenuHeight,
          }}
          onMouseEnter={clearHoverTimeout}
        >
          <div
            style={{
              maxHeight: submenuHeight - 16,
              overflowY:
                estimateMenuHeight(submenu.items) > submenuHeight ? "auto" : "visible",
            }}
          >
            {renderItems(submenu.items, "submenu")}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

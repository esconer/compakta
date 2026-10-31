/**
 * Premium UI microinteractions:
 * 1. Cursor-tracked spotlight coordinates (--mouse-x, --mouse-y) for cards.
 * 2. Staggered entrance indices (--stagger-i) for dynamic card lists.
 * 3. Responsive narrow-viewport pane switching synced with the Context Rail.
 */

import { state } from "./state";

const SPOTLIGHT_SELECTOR =
  ".format-card, .stat.tile, .preflight-tile, .plan-hero";

const STAGGER_CONTAINERS = [
  "#formatCards",
  "#moreFormats",
  "#healthBody",
];

export function initMicrointeractions(): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1. Cursor-tracked radial spotlight across cards and hero surfaces
  if (!reducedMotion) {
    document.addEventListener(
      "pointermove",
      (event: PointerEvent) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
          SPOTLIGHT_SELECTOR,
        );
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        target.style.setProperty("--mouse-x", `${x.toFixed(0)}px`);
        target.style.setProperty("--mouse-y", `${y.toFixed(0)}px`);
      },
      { passive: true },
    );
  }

  // 2. Staggered entrance indices for dynamic card lists
  const applyStagger = (): void => {
    if (state.running || state.starting) return;
    for (const selector of STAGGER_CONTAINERS) {
      const container = document.querySelector<HTMLElement>(selector);
      if (!container) continue;
      const children = Array.from(container.children) as HTMLElement[];
      children.forEach((child, index) => {
        child.style.setProperty("--stagger-i", String(Math.min(index, 14)));
      });
    }
  };

  applyStagger();

  // Re-apply stagger indices whenever dynamic lists re-render
  const workspace = document.getElementById("workspace");
  if (workspace && "MutationObserver" in window) {
    let rafId = 0;
    const mo = new MutationObserver(() => {
      if (state.running || state.starting) return;
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        applyStagger();
      });
    });
    mo.observe(workspace, { childList: true, subtree: true });
  }

  // 3. Responsive narrow-viewport (<920px) pane switching via Context Rail
  if (workspace) {
    workspace.dataset.mobilePane = "library";
    const rail = document.getElementById("contextRail");
    rail?.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".rail-step");
      const step = btn?.dataset.step;
      if (!step) return;
      if (step === "source" || step === "select") {
        workspace.dataset.mobilePane = "library";
      } else if (step === "output") {
        workspace.dataset.mobilePane = "recipe";
      } else if (step === "review" || step === "run") {
        workspace.dataset.mobilePane = "plan";
      }
    });
  }
}

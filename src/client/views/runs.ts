/**
 * Runs (history) view — every manifest the server still knows about.
 *
 * A manifest is the only durable record of a run and the only thing undo can
 * target, so the table keeps destination, format, and counts visible together.
 */
import { api } from "../api";
import { $, escapeHtml, fmt, relativeTime } from "../dom";
import { state } from "../state";
import type { ManifestItem, ManifestsResponse } from "../types";
import type { ViewActions } from "./shared";
import { emptyState } from "./shared";

export type RunsViewController = {
  open: () => void;
  refresh: () => Promise<void>;
};

export function createRunsView(actions: ViewActions): RunsViewController {
  let busy = false;
  let lastManifests: ManifestItem[] = [];

  const row = (manifest: ManifestItem): string => {
    const spec = state.formatSpecs[manifest.outputFormat];
    const format = spec?.shortLabel ?? manifest.outputFormat;
    const quality = manifest.quality.length ? manifest.quality.join(", ") : "—";
    const inBytes = manifest.summary.inBytes;
    let sizeCell = fmt(manifest.summary.bytes);
    if (inBytes != null && inBytes > 0) {
      const saved = inBytes - manifest.summary.bytes;
      const pct = (saved / inBytes) * 100;
      sizeCell = `${fmt(manifest.summary.bytes)} <span class="muted" title="Original: ${fmt(inBytes)} (${saved >= 0 ? "saved" : "increased by"} ${fmt(Math.abs(saved))})">(${pct >= 0 ? "−" : "+"}${Math.abs(pct).toFixed(0)}%)</span>`;
    }
    return `<tr>
      <td class="run-id">${escapeHtml(manifest.id)}</td>
      <td title="${new Date(manifest.createdAt).toLocaleString()}">${escapeHtml(relativeTime(manifest.createdAt))}</td>
      <td>${escapeHtml(format)} <span class="muted">q${escapeHtml(quality)}</span></td>
      <td class="num">${manifest.summary.converted.toLocaleString()}</td>
      <td class="num">${manifest.summary.copied.toLocaleString()}</td>
      <td class="num"${manifest.summary.failed ? ' style="color:var(--status-danger)"' : ""}>${manifest.summary.failed.toLocaleString()}</td>
      <td class="num">${sizeCell}</td>
      <td><span class="run-destination" title="${escapeHtml(manifest.destination)}">${escapeHtml(manifest.destination)}</span></td>
      <td class="actions-cell">
        <button class="btn ghost sm" type="button" data-open-dest="${escapeHtml(manifest.destination)}" title="Open destination folder in file manager">Open</button>
        <button class="btn ghost sm" type="button" data-undo-id="${escapeHtml(manifest.id)}">Undo</button>
      </td>
    </tr>`;
  };

  const refresh = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    $("runsBody").innerHTML = `<p class="empty-note">Loading run records…</p>`;
    try {
      const data = await api<ManifestsResponse>("manifests");
      const manifests = data.manifests ?? [];
      lastManifests = manifests;
      $("runsCount").textContent = `${manifests.length.toLocaleString()} recorded`;
      if (!manifests.length) {
        $("runsBody").innerHTML = emptyState(
          "history",
          "No runs recorded yet",
          "Finish a conversion and its manifest will appear here for safe undo.",
        );
        return;
      }
      $("runsBody").innerHTML = `<div class="runs-table-wrap"><table class="data-table">
        <thead><tr><th>Run</th><th>When</th><th>Format</th><th>Converted</th><th>Copied</th><th>Failed</th><th>Size</th><th>Destination</th><th></th></tr></thead>
        <tbody>${manifests.map(row).join("")}</tbody>
      </table></div>`;
    } catch (error) {
      $("runsBody").innerHTML = `<p class="inline-msg">${escapeHtml((error as Error).message)}</p>`;
    } finally {
      busy = false;
    }
  };

  $("runsBody").addEventListener("click", (event) => {
    const openBtn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-open-dest]");
    if (openBtn?.dataset.openDest) {
      void actions.openDestination?.(openBtn.dataset.openDest);
      return;
    }

    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-undo-id]");
    if (!button?.dataset.undoId) return;
    const id = button.dataset.undoId;
    const summary = lastManifests.find((m) => m.id === id)?.summary;
    void actions.undoManifest(id, summary).then(refresh);
  });

  $("runsRefresh").addEventListener("click", () => void refresh());

  const open = (): void => {
    actions.switchView("runs");
    void refresh();
  };

  return { open, refresh };
}

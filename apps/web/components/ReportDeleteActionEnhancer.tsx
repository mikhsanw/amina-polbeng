"use client";

import { useEffect } from "react";
import { api } from "../lib/api";

const REPORT_LINK_SELECTOR =
  'a[href*="/audit-flow/print-documents/"][href*="download=1"]';

function enhanceReportDeleteLinks() {
  document.querySelectorAll<HTMLAnchorElement>(REPORT_LINK_SELECTOR).forEach((link) => {
    if (link.dataset.reportDeleteReady === "1") return;

    const match = link.href.match(/\/print-documents\/([^/]+)\/file/);
    const documentId = match?.[1];
    if (!documentId) return;

    link.dataset.reportDeleteReady = "1";
    link.textContent = "Hapus";
    link.classList.add("danger");
    link.setAttribute("href", "#");
    link.setAttribute("role", "button");
    link.setAttribute("aria-label", "Hapus permanen versi laporan");

    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const row = link.closest("tr");
      const fileName = row?.querySelector("td:nth-child(2)")?.textContent?.trim() ||
        "versi laporan ini";
      if (
        !window.confirm(
          `Hapus permanen ${fileName}? Dokumen tidak dapat dipulihkan.`,
        )
      ) {
        return;
      }

      link.setAttribute("aria-disabled", "true");
      link.textContent = "Menghapus…";
      try {
        await api(`/audit-flow/print-documents/${documentId}`, {
          method: "DELETE",
        });
        window.location.reload();
      } catch (reason: any) {
        link.removeAttribute("aria-disabled");
        link.textContent = "Hapus";
        window.alert(reason?.message || "Versi laporan gagal dihapus.");
      }
    });
  });
}

export function ReportDeleteActionEnhancer() {
  useEffect(() => {
    enhanceReportDeleteLinks();
    const observer = new MutationObserver(enhanceReportDeleteLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

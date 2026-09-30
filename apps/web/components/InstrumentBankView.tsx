"use client";

import { useState } from "react";
import { InstrumentManagementView } from "./InstrumentManagementView";
import { InstrumentExcelPanel } from "./InstrumentExcelPanel";
import { StandardsManagementView } from "./StandardsManagementView";

export function InstrumentBankView({ user }: { user: any }) {
  const [tab, setTab] = useState<"questions" | "references">("questions");
  const [version, setVersion] = useState(0);
  const canManage = user.roles?.some((role: string) =>
    ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP"].includes(role),
  );

  return (
    <div className="instrument-bank-view">
      <div className="bank-tabs" aria-label="Bagian Bank Instrumen">
        <button
          type="button"
          className={tab === "questions" ? "active" : ""}
          onClick={() => setTab("questions")}
        >
          Bank Soal Instrumen
        </button>
        {canManage && (
          <button
            type="button"
            className={tab === "references" ? "active" : ""}
            onClick={() => setTab("references")}
          >
            Referensi ISO &amp; SPMI
          </button>
        )}
      </div>

      {tab === "questions" ? (
        <>
          {canManage && (
            <InstrumentExcelPanel
              onImported={() => setVersion((value) => value + 1)}
            />
          )}
          <InstrumentManagementView key={version} user={user} />
        </>
      ) : (
        <div className="embedded-reference-view">
          <StandardsManagementView />
        </div>
      )}

      <style jsx>{`
        .bank-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding: 0.35rem;
          border: 1px solid #dbe4ee;
          border-radius: 12px;
          background: #f8fafc;
          width: max-content;
          max-width: 100%;
        }
        .bank-tabs button {
          border: 0;
          background: transparent;
          padding: 0.7rem 1rem;
          border-radius: 9px;
          font-weight: 700;
          color: #475569;
        }
        .bank-tabs button.active {
          background: #1d4ed8;
          color: #fff;
          box-shadow: 0 4px 14px rgba(29, 78, 216, 0.22);
        }
      `}</style>
      <style jsx global>{`
        .instrument-bank-view .form-panel label:has(input[type="number"]) {
          display: none;
        }
      `}</style>
    </div>
  );
}

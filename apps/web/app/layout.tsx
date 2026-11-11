import "./globals.css";
import "./transaction.css";
import "./ami-workspace.css";
import "./instrument-review.css";
import "./assessment-workflow.css";
import "./activity-evaluation.css";
import "./deadline-workflow.css";
import "./institutional-recap.css";
import { ReportDeleteActionEnhancer } from "../components/ReportDeleteActionEnhancer";

export const metadata = {
  title: "AMINA POLBENG",
  description: "Audit Mutu Internal Nonakademik Politeknik Negeri Bengkalis",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <ReportDeleteActionEnhancer />
      </body>
    </html>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "../../components/Shell";
import { ModuleView } from "../../components/ModuleView";
import { PlanningView } from "../../components/PlanningView";
import { UserManagementViewSecure } from "../../components/UserManagementViewSecure";
import { InstrumentBankView } from "../../components/InstrumentBankView";
import { InstrumentUnitMappingView } from "../../components/InstrumentUnitMappingView";
import { UnitManagementView } from "../../components/UnitManagementView";
import { ActivityEvaluationView } from "../../components/ActivityEvaluationView";
import { SignedReportLibraryView } from "../../components/SignedReportLibraryView";
import { InstitutionalRecapView } from "../../components/InstitutionalRecapView";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default async function Section({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const cookieStore = await cookies();
  const response = await fetch(API + "/auth/me", {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 401) redirect("/");
  const user = await response.json();

  return (
    <Shell user={user}>
      {section === "audit-programs" ? (
        <PlanningView />
      ) : section === "users" ? (
        <UserManagementViewSecure currentUser={user} />
      ) : section === "questions" || section === "standards" ? (
        <InstrumentBankView user={user} />
      ) : section === "instrument-mapping" ? (
        <InstrumentUnitMappingView />
      ) : section === "units" ? (
        <UnitManagementView />
      ) : section === "activity-evaluation" ? (
        <ActivityEvaluationView />
      ) : section === "reports" ? (
        <SignedReportLibraryView />
      ) : section === "recap" ? (
        <InstitutionalRecapView />
      ) : (
        <ModuleView section={section} user={user} />
      )}
    </Shell>
  );
}

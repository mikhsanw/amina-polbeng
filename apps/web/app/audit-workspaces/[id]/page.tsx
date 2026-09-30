import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "../../../components/Shell";
import { DeadlineAwareWorkspace } from "../../../components/DeadlineAwareWorkspace";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const response = await fetch(`${API}/auth/me`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 401) redirect("/");
  const user = await response.json();
  return (
    <Shell user={user}>
      <DeadlineAwareWorkspace id={id} user={user} />
    </Shell>
  );
}

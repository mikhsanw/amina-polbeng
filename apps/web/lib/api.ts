export const API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

/**
 * Endpoints master lama mengembalikan array, sedangkan backend baru memakai
 * objek paginasi. Halaman lama masih banyak menggunakan `.filter()` dan
 * `.map()` langsung. Normalisasi dilakukan di satu tempat agar transisi tidak
 * mematahkan setiap halaman satu per satu.
 */
function normalizeResponse(path: string, payload: any) {
  const pathname = path.split("?")[0];
  const legacyListPaths = new Set(["/master/questions", "/legacy/questions"]);

  if (
    legacyListPaths.has(pathname) &&
    payload &&
    !Array.isArray(payload) &&
    Array.isArray(payload.data)
  ) {
    return payload.data;
  }

  return payload;
}

export async function api(path: string, init?: RequestInit) {
  // Jalur lama bertabrakan dengan route dinamis `/audit-flow/:id`, sehingga
  // `signed-reports` dibaca sebagai ID workspace. Arahkan ke endpoint khusus
  // yang tidak mungkin ditangkap route workspace tersebut.
  if (path === "/audit-flow/signed-reports") {
    path = "/report-library/signed";
  }

  if (
    init?.method === "POST" &&
    /^\/audit-workspaces\/[^/]+\/findings$/.test(path)
  ) {
    path = path.replace("/audit-workspaces/", "/audit-flow/workspaces/");
  }

  const headers = new Headers(init?.headers);
  const isFormData = init?.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? "Permintaan gagal");
  }

  return normalizeResponse(path, payload);
}

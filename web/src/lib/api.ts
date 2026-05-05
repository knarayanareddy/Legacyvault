web/src/lib/api.ts

import { WEB } from "./env";

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("lv_token") : null;
  const headers = new Headers(opts.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${WEB.apiBase}${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "API error");
  return json;
}

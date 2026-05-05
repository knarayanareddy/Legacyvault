web/src/app/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

export default function DashboardPage() {
  const [vaults, setVaults] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/v1/vaults")
      .then((r) => setVaults(r.vaults))
      .catch(() => setVaults([]));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <ul>
        {vaults.map(v => (
          <li key={v.vaultPubkey}>
            <Link href={`/vault/${v.vaultPubkey}`}>{v.vaultPubkey}</Link> — {v.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

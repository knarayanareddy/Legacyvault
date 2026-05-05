web/src/components/Navbar.tsx

"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #eee" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/">Home</Link>
        <Link href="/signin">Sign in</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>
      <WalletMultiButton />
    </div>
  );
}

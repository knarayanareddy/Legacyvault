web/src/app/signin/page.tsx

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { siwsSignIn } from "../../lib/auth";

export default function SignInPage() {
  const wallet = useWallet();

  return (
    <div>
      <h2>Sign in</h2>
      <p>This uses SIWS-style message signing.</p>

      <button
        disabled={!wallet.connected || !wallet.signMessage}
        onClick={async () => {
          const res = await siwsSignIn({ wallet: wallet as any });
          alert(`Signed in. Expires: ${res.expiresAt}`);
        }}
      >
        Sign in with wallet
      </button>

      {!wallet.signMessage && <p>Your wallet does not support signMessage.</p>}
    </div>
  );
}

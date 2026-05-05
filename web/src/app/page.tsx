export default function HomePage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", padding: "40px 20px" }}>
      <div style={{ display: "inline-block", backgroundColor: "#ffeb3b", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: "bold", marginBottom: 16 }}>
        BETA RELEASE
      </div>
      <h1 style={{ fontSize: "2.5rem", marginBottom: 16 }}>LegacyVault</h1>
      <p style={{ fontSize: "1.2rem", color: "#666", marginBottom: 40 }}>
        Digital estate vaults on Solana. Secure your assets for the next generation.
      </p>

      <div style={{ backgroundColor: "#fdf2f2", border: "1px solid #fbd5d5", borderRadius: 8, padding: 24, textAlign: "left" }}>
        <h3 style={{ color: "#9b1c1c", marginTop: 0 }}>⚠️ Usage Notice & Disclaimer</h3>
        <p style={{ fontSize: 14, color: "#771d1d", lineHeight: 1.5 }}>
          LegacyVault is currently in <strong>Public Beta</strong>. The protocol has not yet undergone a formal security audit. 
          Use at your own risk. Digital assets stored in vaults are subject to the logic of the smart contract and the 
          unpredictability of decentralized networks. 
        </p>
        <p style={{ fontSize: 14, color: "#771d1d", marginBottom: 0 }}>
          By using this application, you agree that LegacyVault is not responsible for any loss of funds.
        </p>
      </div>

      <div style={{ marginTop: 40 }}>
        <a href="/dashboard" style={{ display: "inline-block", backgroundColor: "#1a1a1a", color: "#fff", padding: "12px 32px", borderRadius: 6, textDecoration: "none", fontWeight: "bold" }}>
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

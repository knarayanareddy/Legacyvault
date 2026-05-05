"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../lib/api";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { legacyvaultPdas as pdas } from "@legacyvault/sdk";
import { discoverTokenHoldingsByOwner, type TokenHolding } from "../../../lib/discovery";

type TxBuildResp = {
  ok: boolean;
  txBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  meta?: any;
};

function Input({ label, value, onChange, placeholder }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <input
        style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function VaultPage() {
  const params = useParams();
  const vaultPubkey = params.vault as string;

  const { connection } = useConnection();
  const wallet = useWallet();

  const [state, setState] = useState<any>(null);
  const [lastSig, setLastSig] = useState<string>("");

  // Setup plan form
  const [guardianPk, setGuardianPk] = useState("");
  const [guardianRole, setGuardianRole] = useState<"0" | "1">("0");
  const [threshold, setThreshold] = useState("2");

  const [beneficiaryPk, setBeneficiaryPk] = useState("");
  const [shareBps, setShareBps] = useState("5000");
  const [beneficiaryLabel, setBeneficiaryLabel] = useState("Spouse");
  const [beneficiaryActive, setBeneficiaryActive] = useState(true);

  // Unlock/dispute
  const [unlockPk, setUnlockPk] = useState("");
  const [noteHashHex, setNoteHashHex] = useState("".padEnd(64, "0"));

  // Distribution
  const [solBatchSize, setSolBatchSize] = useState("10");
  const [solStartIndex, setSolStartIndex] = useState("0");

  const [splBatchSize, setSplBatchSize] = useState("5");
  const [splStartIndex, setSplStartIndex] = useState("0");
  const [createMissingAtas, setCreateMissingAtas] = useState(false);

  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [selectedMints, setSelectedMints] = useState<Record<string, boolean>>({});

  const programId = useMemo(() => {
    const pid = process.env.NEXT_PUBLIC_LEGACYVAULT_PROGRAM_ID!;
    return new PublicKey(pid);
  }, []);

  async function refresh() {
    try {
      const r = await apiFetch(`/v1/vaults/${vaultPubkey}/full`);
      setState(r);
      // if there’s an active unlock in response, set it
      const latestUnlock = r?.vault?.unlockSessions?.[0]?.unlockPubkey;
      if (latestUnlock && !unlockPk) setUnlockPk(latestUnlock);
    } catch (e: any) {
      setState({ ok: false, error: e.message });
    }
  }

  useEffect(() => { refresh(); }, [vaultPubkey]);

  async function signAndSendBuiltTx(resp: TxBuildResp) {
    if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not ready (need signTransaction).");

    const tx = Transaction.from(Buffer.from(resp.txBase64, "base64"));
    const sig = await wallet.sendTransaction(tx, connection, { skipPreflight: false });
    await connection.confirmTransaction(
      { signature: sig, blockhash: resp.blockhash, lastValidBlockHeight: resp.lastValidBlockHeight },
      "confirmed"
    );
    setLastSig(sig);
    await refresh();
    return sig;
  }

  async function runTx(endpoint: string, body: any) {
    const resp = await apiFetch(endpoint, { method: "POST", body: JSON.stringify(body) }) as TxBuildResp;
    if (!resp.ok) throw new Error("tx build failed");
    const sig = await signAndSendBuiltTx(resp);
    if (resp.meta?.unlock) setUnlockPk(resp.meta.unlock);
    return { sig, meta: resp.meta };
  }

  async function discoverVaultMints() {
    // Discover SPL token mints held by vault authority (vault_auth PDA)
    const vault = new PublicKey(vaultPubkey);
    const [vaultAuth] = pdas.vaultAuthPda(programId, vault);

    const hs = await discoverTokenHoldingsByOwner(connection, vaultAuth);
    setHoldings(hs);

    const mintList = hs.map(h => h.mint);
    const sel: Record<string, boolean> = {};
    for (const m of mintList) sel[m] = selectedMints[m] ?? true;
    setSelectedMints(sel);
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2>Vault: {vaultPubkey}</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <button onClick={refresh}>Refresh</button>
        {lastSig && (
          <div style={{ fontSize: 12 }}>
            Last tx: <code>{lastSig}</code>
          </div>
        )}
      </div>

      <Section title="0) Status / Debug">
        <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(state, null, 2)}
        </pre>
      </Section>

      <Section title="1) Setup plan (Owner)">
        <h4>Guardians</h4>
        <Input label="Guardian pubkey" value={guardianPk} onChange={setGuardianPk} placeholder="..." />
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <label>
            Role:
            <select value={guardianRole} onChange={(e) => setGuardianRole(e.target.value as any)}>
              <option value="0">Personal</option>
              <option value="1">Professional</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            disabled={!wallet.publicKey || !guardianPk}
            onClick={() => runTx("/v1/tx/add-guardian", { vault: vaultPubkey, guardian: guardianPk, role: Number(guardianRole) })}
          >
            Add guardian
          </button>

          <button
            disabled={!wallet.publicKey || !guardianPk}
            onClick={() => runTx("/v1/tx/remove-guardian", { vault: vaultPubkey, guardian: guardianPk })}
          >
            Remove guardian
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <Input label="Guardian threshold (M)" value={threshold} onChange={setThreshold} placeholder="2" />
          <button
            disabled={!wallet.publicKey}
            onClick={() => runTx("/v1/tx/set-guardian-threshold", { vault: vaultPubkey, threshold: Number(threshold) })}
          >
            Set threshold
          </button>
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h4>Beneficiaries</h4>
        <Input label="Beneficiary pubkey" value={beneficiaryPk} onChange={setBeneficiaryPk} placeholder="..." />
        <Input label="Share bps (0..10000)" value={shareBps} onChange={setShareBps} placeholder="5000" />
        <Input label="Label (<=16 chars)" value={beneficiaryLabel} onChange={setBeneficiaryLabel} placeholder="Spouse" />
        <div style={{ marginBottom: 12 }}>
          <label>
            Active:
            <input type="checkbox" checked={beneficiaryActive} onChange={(e) => setBeneficiaryActive(e.target.checked)} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            disabled={!wallet.publicKey || !beneficiaryPk}
            onClick={() =>
              runTx("/v1/tx/add-beneficiary", {
                vault: vaultPubkey,
                beneficiary: beneficiaryPk,
                shareBps: Number(shareBps),
                label: beneficiaryLabel
              })
            }
          >
            Add beneficiary
          </button>

          <button
            disabled={!wallet.publicKey || !beneficiaryPk}
            onClick={() =>
              runTx("/v1/tx/update-beneficiary", {
                vault: vaultPubkey,
                beneficiary: beneficiaryPk,
                shareBps: Number(shareBps),
                label: beneficiaryLabel,
                active: beneficiaryActive
              })
            }
          >
            Update beneficiary
          </button>

          <button
            disabled={!wallet.publicKey || !beneficiaryPk}
            onClick={() => runTx("/v1/tx/remove-beneficiary", { vault: vaultPubkey, beneficiary: beneficiaryPk })}
          >
            Remove beneficiary
          </button>

          <button
            disabled={!wallet.publicKey}
            onClick={() => runTx("/v1/tx/assert-beneficiary-total-10k", { vault: vaultPubkey })}
          >
            Assert shares sum to 10,000 bps
          </button>
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h4>Liveness</h4>
        <button disabled={!wallet.publicKey} onClick={() => runTx("/v1/tx/check-in", { vault: vaultPubkey })}>
          Check in (Owner)
        </button>
      </Section>

      <Section title="2) Unlock (Guardians + Owner override)">
        <Input label="Unlock pubkey (auto-filled after initiate)" value={unlockPk} onChange={setUnlockPk} placeholder="..." />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button disabled={!wallet.publicKey} onClick={() => runTx("/v1/tx/initiate-unlock", { vault: vaultPubkey })}>
            Initiate unlock (as guardian wallet)
          </button>

          <button
            disabled={!wallet.publicKey || !unlockPk}
            onClick={() => runTx("/v1/tx/approve-unlock", { vault: vaultPubkey, unlock: unlockPk })}
          >
            Approve unlock (as guardian wallet)
          </button>

          <button
            disabled={!wallet.publicKey || !unlockPk}
            onClick={() => runTx("/v1/tx/cancel-unlock", { vault: vaultPubkey, unlock: unlockPk })}
          >
            Cancel unlock (Owner)
          </button>
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h4>Disputes (optional)</h4>
        <Input label="noteHashHex (64 hex chars)" value={noteHashHex} onChange={setNoteHashHex} placeholder="..." />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            disabled={!wallet.publicKey || !unlockPk || noteHashHex.length !== 64}
            onClick={() => runTx("/v1/tx/open-dispute", { vault: vaultPubkey, unlock: unlockPk, noteHashHex })}
          >
            Open dispute
          </button>

          <button
            disabled={!wallet.publicKey || !unlockPk}
            onClick={() => runTx("/v1/tx/resolve-dispute-cancel", { vault: vaultPubkey, unlock: unlockPk })}
          >
            Resolve dispute: cancel (arbiter)
          </button>

          <button
            disabled={!wallet.publicKey || !unlockPk}
            onClick={() => runTx("/v1/tx/resolve-dispute-proceed", { vault: vaultPubkey, unlock: unlockPk })}
          >
            Resolve dispute: proceed (arbiter)
          </button>
        </div>
      </Section>

      <Section title="3) Distribute (after approvals + timelock)">
        <p style={{ color: "#555" }}>
          Distribution requires: unlock approved + timelock elapsed. This UI helps you run SOL + SPL batches and then finalize.
        </p>

        <h4>SOL</h4>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button disabled={!wallet.publicKey || !unlockPk} onClick={() => runTx("/v1/tx/init-dist-sol", { vault: vaultPubkey, unlock: unlockPk })}>
            Init SOL distribution session
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <Input label="startIndex" value={solStartIndex} onChange={setSolStartIndex} placeholder="0" />
          <Input label="batchSize" value={solBatchSize} onChange={setSolBatchSize} placeholder="10" />
        </div>

        <button
          disabled={!wallet.publicKey || !unlockPk}
          onClick={() =>
            runTx("/v1/tx/exec-dist-sol-batch", {
              vault: vaultPubkey,
              unlock: unlockPk,
              startIndex: Number(solStartIndex),
              batchSize: Number(solBatchSize)
            })
          }
        >
          Execute SOL batch
        </button>

        <hr style={{ margin: "24px 0" }} />

        <h4>SPL</h4>
        <button disabled={!wallet.publicKey} onClick={discoverVaultMints}>
          Discover vault SPL mints
        </button>

        {holdings.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#555" }}>Select mints to distribute (non-zero balances):</div>
            {holdings.map((h) => (
              <label key={h.mint} style={{ display: "block", marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={selectedMints[h.mint] ?? true}
                  onChange={(e) => setSelectedMints({ ...selectedMints, [h.mint]: e.target.checked })}
                />
                <code style={{ marginLeft: 8 }}>{h.mint}</code>
                <span style={{ marginLeft: 10, fontSize: 12, color: "#444" }}>
                  balance: {h.uiAmountString} (decimals {h.decimals}) · program:{" "}
                  {h.programId === TOKEN_2022_PROGRAM_ID.toBase58() ? "Token-2022" : "Token"}
                </span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <Input label="SPL startIndex" value={splStartIndex} onChange={setSplStartIndex} placeholder="0" />
          <Input label="SPL batchSize" value={splBatchSize} onChange={setSplBatchSize} placeholder="5" />
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={createMissingAtas}
            onChange={(e) => setCreateMissingAtas(e.target.checked)}
          />
          <span style={{ marginLeft: 8 }}>
            Create missing beneficiary ATAs in the same tx (may hit tx size limits for large batches)
          </span>
        </label>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {holdings.filter((h) => selectedMints[h.mint]).slice(0, 6).map((h) => (
            <div key={h.mint} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, color: "#555" }}>Mint ({h.uiAmountString})</div>
              <code style={{ fontSize: 12 }}>{h.mint}</code>

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  disabled={!wallet.publicKey || !unlockPk}
                  onClick={() => runTx("/v1/tx/init-dist-spl", { vault: vaultPubkey, unlock: unlockPk, mint: h.mint })}
                >
                  Init SPL session
                </button>

                <button
                  disabled={!wallet.publicKey || !unlockPk}
                  onClick={() =>
                    runTx("/v1/tx/exec-dist-spl-batch", {
                      vault: vaultPubkey,
                      unlock: unlockPk,
                      mint: h.mint,
                      startIndex: Number(splStartIndex),
                      batchSize: Number(splBatchSize),
                      createMissingAtas
                    })
                  }
                >
                  Exec SPL batch
                </button>
              </div>
            </div>
          ))}
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h4>Finalize</h4>
        <button
          disabled={!wallet.publicKey || !unlockPk}
          onClick={() => {
            const splMints = holdings.filter((h) => selectedMints[h.mint]).map(h => h.mint);
            return runTx("/v1/tx/finalize-unlock", { vault: vaultPubkey, unlock: unlockPk, splMints });
          }}
        >
          Finalize unlock (requires all dist sessions done)
        </button>
      </Section>
    </div>
  );
}

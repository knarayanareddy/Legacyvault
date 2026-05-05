
import express from "express";
import { z } from "zod";
import { buildSiwsMessage, defaultStatement } from "../siws";
import { createSession, createJwt, verifySignature } from "../auth";
import { env } from "../env";

export const authRouter = express.Router();

const NonceResp = z.object({ nonce: z.string(), issuedAt: z.string(), message: z.string() });

authRouter.post("/nonce", express.json(), async (req, res) => {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const issuedAt = new Date().toISOString();

  // client will rebuild message too; server returns canonical message to reduce mismatch
  const message = buildSiwsMessage({
    domain: env.API_DOMAIN,
    address: "WALLET_ADDRESS_PLACEHOLDER",
    statement: defaultStatement(),
    uri: env.API_ORIGIN,
    version: "1",
    chainId: "solana:devnet",
    nonce,
    issuedAt
  });

  res.json(NonceResp.parse({ nonce, issuedAt, message }));
});

authRouter.post("/verify", express.json(), async (req, res) => {
  const Body = z.object({
    wallet: z.string(),
    message: z.string(),
    signatureBase58: z.string(),
    nonce: z.string(),
    issuedAt: z.string()
  });
  const body = Body.parse(req.body);

  // verify signature
  const ok = await verifySignature({
    message: body.message,
    signatureBase58: body.signatureBase58,
    publicKey: body.wallet
  });
  if (!ok) return res.status(401).json({ ok: false });

  // create session
  const ttl = Number(env.API_SESSION_TTL_SECS);
  const { jti, expiresAt } = await createSession(body.wallet, ttl);
  const token = createJwt({ wallet: body.wallet, jti, expSec: ttl });

  res.json({ ok: true, token, expiresAt: expiresAt.toISOString() });
});

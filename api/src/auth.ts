
import jwt from "jsonwebtoken";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { env } from "./env";
import { prisma } from "./db";

export function createJwt(args: { wallet: string; jti: string; expSec: number }) {
  return jwt.sign(
    { sub: args.wallet, jti: args.jti },
    env.API_JWT_SECRET,
    { expiresIn: args.expSec }
  );
}

export function verifyJwt(token: string): { wallet: string; jti: string } {
  const decoded = jwt.verify(token, env.API_JWT_SECRET) as any;
  return { wallet: decoded.sub, jti: decoded.jti };
}

export async function verifySignature(args: { message: string; signatureBase58: string; publicKey: string }) {
  const sig = bs58.decode(args.signatureBase58);
  const pub = new PublicKey(args.publicKey);
  const ok = nacl.sign.detached.verify(
    new TextEncoder().encode(args.message),
    sig,
    pub.toBytes()
  );
  return ok;
}

export async function getOrCreateUser(wallet: string) {
  return prisma.user.upsert({
    where: { wallet },
    create: { wallet },
    update: {}
  });
}

export async function createSession(wallet: string, ttlSecs: number) {
  const user = await getOrCreateUser(wallet);
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlSecs * 1000);

  await prisma.session.create({
    data: { userId: user.id, jti, expiresAt }
  });

  return { jti, expiresAt };
}

export async function requireAuth(req: any, res: any, next: any) {
  try {
    const h = req.headers["authorization"];
    if (!h?.startsWith("Bearer ")) return res.status(401).json({ ok: false });
    const token = h.slice("Bearer ".length);
    const { wallet, jti } = verifyJwt(token);

    const session = await prisma.session.findUnique({ where: { jti } });
    if (!session || session.expiresAt < new Date()) return res.status(401).json({ ok: false });

    req.user = { wallet, jti };
    next();
  } catch {
    res.status(401).json({ ok: false });
  }
}


import express from "express";
export const healthRouter = express.Router();
healthRouter.get("/", (_, res) => res.json({ ok: true }));

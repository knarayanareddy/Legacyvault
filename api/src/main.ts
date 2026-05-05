
import express from "express";
import { env } from "./env";
import { logger } from "./logger";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { vaultsRouter } from "./routes/vaults";
import { txRouter } from "./routes/tx";

async function main() {
  const app = express();

  app.use("/health", healthRouter);
  app.use("/v1/auth", authRouter);
  app.use("/v1/vaults", vaultsRouter);
  app.use("/v1/tx", txRouter);

  app.listen(env.API_HTTP_PORT, () => {
    logger.info({ port: env.API_HTTP_PORT }, "api http listening");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { analysisRouter } from "./routes/analysis.js";
import { chatRouter } from "./routes/chat.js";
import { fieldsRouter } from "./routes/fields.js";
import { imageryOutputDir } from "./services/satelliteAnalysis.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.use("/imagery", express.static(imageryOutputDir));


  app.use("/fields", fieldsRouter);
  app.use("/fields/:id", analysisRouter);
  app.use("/chat", chatRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Validation failed", details: err.issues });
        return;
      }

      if (err instanceof Error) {
        const clientErrors = [
          "No recent clear satellite",
          "No clear satellite",
          "Could not compute greenness",
          "Satellite analysis failed",
          "Failed to start Python",
        ];
        if (clientErrors.some((msg) => err.message.includes(msg))) {
          res.status(422).json({ error: err.message });
          return;
        }
      }

      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}

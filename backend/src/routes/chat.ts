import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { chatWithAgent } from "../services/llmAgent.js";

const historyTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  fieldId: z.string().uuid().optional(),
  activeFieldName: z.string().max(120).optional(),
  history: z.array(historyTurnSchema).max(12).optional(),
});

export const chatRouter = Router();

chatRouter.post("/", async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);

    if (!env.GROQ_API_KEY) {
      res.status(503).json({
        error: "Chat unavailable",
        message: "Add GROQ_API_KEY to backend/.env to enable the assistant.",
      });
      return;
    }

    const reply = await chatWithAgent(body.message, {
      fieldId: body.fieldId,
      activeFieldName: body.activeFieldName,
      history: body.history,
    });
    res.json({ reply, fieldId: body.fieldId ?? null });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Groq API error 401")) {
      res.status(503).json({
        error: "Invalid Groq API key",
        message:
          "Your GROQ_API_KEY in backend/.env is invalid. Create a new key at console.groq.com and restart the backend.",
      });
      return;
    }
    if (err instanceof Error && err.message.includes("Groq API error")) {
      res.status(502).json({
        error: "Assistant temporarily unavailable",
        message: "The AI service returned an error. Try again in a moment.",
      });
      return;
    }
    next(err);
  }
});

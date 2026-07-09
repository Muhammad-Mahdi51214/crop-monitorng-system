import { env } from "../config/env.js";
import { getCropPlaybook } from "./cropKnowledge.js";
import { buildLlmFieldContext } from "./indexInterpretation.js";
import {
  findFields,
  getFieldHistory,
  getFieldInfo,
  getFieldStatus,
  listFieldsSummary,
} from "./fieldData.js";

type ChatRole = "system" | "user" | "assistant" | "tool";

type ChatMessage = {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatAgentOptions = {
  fieldId?: string;
  activeFieldName?: string;
  history?: ChatHistoryTurn[];
};

const SYSTEM_PROMPT = `You are AgroAI, a precise crop advisor for this farmer's named fields.
Always use tools to load real satellite data before giving numbers — never invent stats.

LANGUAGE
- Plain farmer language: "greenness", "leaf vigor", "water stress" — not NDVI/NDRE/NDWI unless asked.
- Be specific to the field name and crop type in every answer.

FIELD RESOLUTION (critical)
1. Each field has a unique name (e.g. GIS_02, North Wheat). Satellite stats belong to ONE named field only.
2. If the farmer names a field (GIS_02, "Shaf's Field", etc.) → call find_fields with that name, then get_field_analysis for the matching id.
3. If they ask about a crop type only ("tell me about maize", "how is my wheat") → call find_fields with crop_type. If MORE THAN ONE field matches, do NOT give a full analysis. Ask which exact field name they mean and list the options.
4. If they say "my field" or "this field" → use the map-selected field from context (if provided).
5. Never blend stats from two different fields in one answer.

QUESTION TYPES
- Field health / stress / recommendations → find the right field → get_field_analysis → answer using fieldName, cropType, plainSummary, adviceFocus, and cropPlaybook from tool data.
- Trends over time → get_field_history for that field.
- General crop education without a field → get_crop_playbook, then ask which of their named fields they want satellite details for.
- "What fields do I have?" → list_all_fields.

ACTIONABLE ADVICE
When they ask what to do or what's wrong:
1. get_field_analysis for the resolved field.
2. Lead with the field name and crop type.
3. Cite hectares and % from the breakdown for the biggest problem zone.
4. Give 2–4 crop-specific steps from adviceFocus and cropPlaybook.
5. End with one action they can take today.`;

const tools = [
  {
    type: "function",
    function: {
      name: "list_all_fields",
      description:
        "List every field the farmer has: id, name, crop type, and latest health status",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "find_fields",
      description:
        "Find fields by partial name (e.g. GIS_02) and/or crop type (wheat, rice, cotton, maize, other). Use before analysis when the farmer names a field or crop.",
      parameters: {
        type: "object",
        properties: {
          name_query: {
            type: "string",
            description: "Partial or full field name, case-insensitive",
          },
          crop_type: {
            type: "string",
            description: "Crop type filter: wheat, rice, cotton, maize, or other",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_crop_playbook",
      description:
        "General crop knowledge (watch-fors and typical actions) — use with field-specific data, not instead of it",
      parameters: {
        type: "object",
        properties: {
          crop_type: {
            type: "string",
            description: "wheat, rice, cotton, maize, or other",
          },
        },
        required: ["crop_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_field_info",
      description: "Basic info about one field (name, crop type, when added)",
      parameters: {
        type: "object",
        properties: {
          field_id: { type: "string", description: "UUID of the field" },
        },
        required: ["field_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_field_analysis",
      description:
        "Full satellite analysis for ONE field: health, hectares, zone breakdowns, crop playbook, and advice focus",
      parameters: {
        type: "object",
        properties: {
          field_id: { type: "string", description: "UUID of the field" },
        },
        required: ["field_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_field_status",
      description: "Short health color, label, and status message for one field",
      parameters: {
        type: "object",
        properties: {
          field_id: { type: "string", description: "UUID of the field" },
        },
        required: ["field_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_field_history",
      description: "Greenness, chlorophyll, and water trend over recent weeks for one field",
      parameters: {
        type: "object",
        properties: {
          field_id: { type: "string", description: "UUID of the field" },
        },
        required: ["field_id"],
      },
    },
  },
];

function buildAnalysisPayload(status: NonNullable<Awaited<ReturnType<typeof getFieldStatus>>>) {
  const context = buildLlmFieldContext(
    status.spatial_stats,
    status.crop_type,
    {
      ndvi: status.ndvi_mean,
      ndre: status.ndre_mean,
      ndwi: status.ndwi_mean,
    },
  );

  return {
    fieldName: status.name,
    cropType: status.crop_type,
    color: status.status_color,
    label: status.status_label,
    message: status.status_message,
    analyzedAt: status.analyzed_at,
    captureDate: status.scene_datetime,
    satellite: status.platform,
    ...context,
  };
}

function formatFieldList(
  rows: Awaited<ReturnType<typeof listFieldsSummary>>,
) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    cropType: row.crop_type,
    latestHealth: row.status_label
      ? { color: row.status_color, label: row.status_label }
      : null,
    lastAnalyzedAt: row.analyzed_at,
  }));
}

async function runTool(
  name: string,
  args: Record<string, string | undefined>,
) {
  switch (name) {
    case "list_all_fields": {
      const rows = await listFieldsSummary();
      return { fields: formatFieldList(rows), count: rows.length };
    }
    case "find_fields": {
      const rows = await findFields({
        nameQuery: args.name_query,
        cropType: args.crop_type,
      });
      return {
        matches: rows.map((row) => ({
          id: row.id,
          name: row.name,
          cropType: row.crop_type,
          latestHealth: row.status_label
            ? { color: row.status_color, label: row.status_label }
            : null,
        })),
        count: rows.length,
        needsDisambiguation: rows.length > 1,
      };
    }
    case "get_crop_playbook": {
      const cropType = args.crop_type ?? "other";
      return getCropPlaybook(cropType);
    }
    case "get_field_info": {
      const fieldId = args.field_id;
      if (!fieldId) return { error: "field_id required" };
      const info = await getFieldInfo(fieldId);
      return info
        ? {
            id: info.id,
            name: info.name,
            cropType: info.crop_type,
            createdAt: info.created_at,
          }
        : { error: "Field not found" };
    }
    case "get_field_analysis":
    case "get_field_status": {
      const fieldId = args.field_id;
      if (!fieldId) return { error: "field_id required" };
      const status = await getFieldStatus(fieldId);
      if (!status) return { error: "Field not found" };
      if (!status.status_color) {
        return {
          fieldName: status.name,
          cropType: status.crop_type,
          message:
            "No satellite check yet — suggest the farmer tap Refresh satellite for this field.",
        };
      }
      if (name === "get_field_status") {
        return {
          fieldName: status.name,
          cropType: status.crop_type,
          color: status.status_color,
          label: status.status_label,
          message: status.status_message,
          analyzedAt: status.analyzed_at,
        };
      }
      return buildAnalysisPayload(status);
    }
    case "get_field_history": {
      const fieldId = args.field_id;
      if (!fieldId) return { error: "field_id required" };
      const info = await getFieldInfo(fieldId);
      const rows = await getFieldHistory(fieldId);
      return {
        fieldName: info?.name ?? null,
        cropType: info?.crop_type ?? null,
        points: rows.map((row) => ({
          date: row.analyzed_at,
          greennessScore: row.ndvi_mean,
          chlorophyllScore: row.ndre_mean,
          waterScore: row.ndwi_mean,
          color: row.status_color,
        })),
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function groqChat(messages: ChatMessage[]) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.35,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Groq API error ${res.status}: ${body}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<{
    choices: Array<{ message: ChatMessage; finish_reason: string }>;
  }>;
}

async function buildFarmContext() {
  const rows = await listFieldsSummary();
  if (!rows.length) {
    return "The farmer has no fields saved yet.";
  }

  const lines = rows.map(
    (row) =>
      `- "${row.name}" (${row.crop_type}) id=${row.id}${
        row.status_label ? ` — latest: ${row.status_label}` : " — no satellite data yet"
      }`,
  );

  return `Farmer's fields (${rows.length}):\n${lines.join("\n")}`;
}

export async function chatWithAgent(message: string, options: ChatAgentOptions = {}) {
  const { fieldId, activeFieldName, history = [] } = options;

  const farmCatalog = await buildFarmContext();

  const contextNote = fieldId
    ? `Map-selected field: "${activeFieldName ?? "unknown"}" (id: ${fieldId}). Use this ONLY when they say "my field", "this field", or don't name another field.`
    : "No field selected on the map — resolve the field by name or crop using find_fields.";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${farmCatalog}\n\n${contextNote}`,
    },
    ...history.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: message },
  ];

  for (let step = 0; step < 6; step++) {
    const completion = await groqChat(messages);
    const assistantMsg = completion.choices[0]?.message;

    if (!assistantMsg) {
      throw new Error("Empty response from Groq");
    }

    messages.push(assistantMsg);

    if (!assistantMsg.tool_calls?.length) {
      return (
        assistantMsg.content ??
        "I'm here to help — tell me a field name (like GIS_02) or ask about one of your crops."
      );
    }

    for (const call of assistantMsg.tool_calls) {
      const args = JSON.parse(call.function.arguments || "{}") as Record<
        string,
        string | undefined
      >;

      const needsFieldId = [
        "get_field_info",
        "get_field_analysis",
        "get_field_status",
        "get_field_history",
      ].includes(call.function.name);

      if (needsFieldId && !args.field_id && fieldId) {
        args.field_id = fieldId;
      }

      const result = await runTool(call.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      });
    }
  }

  return "I checked your field data — could you name the exact field (e.g. GIS_02) and ask again?";
}

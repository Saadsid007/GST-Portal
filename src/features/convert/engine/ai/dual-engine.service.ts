import { env } from "@/lib/env";
import { CANONICAL_FIELDS } from "@/features/convert/engine/universal/canonical-fields";
import type { ColumnMappingDict } from "@/features/convert/engine/universal/canonical-fields";

export interface SingleHeaderMapping {
  excelHeader: string;
  canonicalKey: string | null;
  explanation: string;
}

export interface AiMappingProposal {
  modelName: string;
  mappings: SingleHeaderMapping[];
}

export interface AiColumnMappingResult {
  mapping: ColumnMappingDict; // canonicalKey -> excelHeader
  headerToKeyMap: Record<string, string | null>; // excelHeader -> canonicalKey
  explanations: Record<string, string>; // excelHeader -> explanation
  activeModels: string[];
  synthesisUsed: boolean;
}

const CANONICAL_FIELDS_PROMPT_SUMMARY = CANONICAL_FIELDS.map(
  (f) => `- ${f.key} (${f.label}): ${f.description}`
).join("\n");

/**
 * Single prompt builder for standard AI evaluation.
 */
function buildEvaluationPrompt(headers: string[], sampleRows: Record<string, string>[]): string {
  const sampleRowsJson = JSON.stringify(sampleRows.slice(0, 5), null, 2);

  return `You are an expert Indian GST compliance software AI consultant.
Your job is to examine an uploaded commerce/ERP Excel sheet header list and sample rows, then match each Excel column header to the correct GST Canonical Field.

CANONICAL GST FIELDS:
${CANONICAL_FIELDS_PROMPT_SUMMARY}

EXCEL COLUMN HEADERS TO MAP:
${JSON.stringify(headers)}

SAMPLE ROWS (first 5 rows):
${sampleRowsJson}

RULES:
1. Examine column headers and sample data values carefully.
2. Bind each header to at most ONE canonical field key. If a header is irrelevant or does not fit any field, set canonicalKey to null.
3. Keep explanation super concise (max 10-15 words).
4. Never assign eco_gstin / supplier GSTIN to buyer_gstin or tax amounts.
5. Return strictly a JSON object with key "mappings" containing an array of objects with keys: "excelHeader", "canonicalKey", "explanation".

JSON Output Format:
{
  "mappings": [
    { "excelHeader": "string", "canonicalKey": "string | null", "explanation": "string" }
  ]
}`;
}

/**
 * Call Gemini API using native fetch
 */
async function callGemini(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<AiMappingProposal | null> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = buildEvaluationPrompt(headers, sampleRows);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.mappings)) return null;

    return {
      modelName: `Gemini (${model})`,
      mappings: parsed.mappings,
    };
  } catch (_err) {
    return null;
  }
}

/**
 * Call Grok API (OpenAI Compatible) using native fetch
 */
async function callGrok(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<AiMappingProposal | null> {
  const apiKey = env.GROK_API_KEY;
  if (!apiKey) return null;

  const model = env.GROK_MODEL || "openai/gpt-oss-120b";
  const url = "https://api.groq.com/openai/v1/chat/completions";

  const prompt = buildEvaluationPrompt(headers, sampleRows);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert Indian GST compliance AI consultant. Respond strictly in JSON format.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.mappings)) return null;

    return {
      modelName: `Grok (${model})`,
      mappings: parsed.mappings,
    };
  } catch (_err) {
    return null;
  }
}

/**
 * Synthesis Pass: Gemini synthesizes Proposal A (Gemini) + Proposal B (Grok)
 */
async function callGeminiSynthesis(
  headers: string[],
  sampleRows: Record<string, string>[],
  proposalA: AiMappingProposal,
  proposalB: AiMappingProposal
): Promise<AiMappingProposal | null> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return proposalA; // Fallback to Proposal A directly if no synthesis key

  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `You are an expert Chief GST AI Architect. Two AI models evaluated an Excel sheet's headers for Indian GST GSTR-1 compliance column mapping.

CANONICAL GST FIELDS:
${CANONICAL_FIELDS_PROMPT_SUMMARY}

PROPOSAL A (${proposalA.modelName}):
${JSON.stringify(proposalA.mappings, null, 2)}

PROPOSAL B (${proposalB.modelName}):
${JSON.stringify(proposalB.mappings, null, 2)}

SAMPLE ROWS (first 5 rows):
${JSON.stringify(sampleRows.slice(0, 5), null, 2)}

YOUR TASK:
Compare both proposals. Resolve any conflicting mapping proposals. Select the best, most accurate canonical field mapping for each header.
Ensure strict compliance with Indian GST rules (e.g. Taxable Value vs Total Invoice Amount, IGST vs CGST/SGST, TCS/ECO GSTIN).

Return strictly JSON format:
{
  "mappings": [
    { "excelHeader": "string", "canonicalKey": "string | null", "explanation": "string" }
  ]
}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) return proposalA;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return proposalA;

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.mappings)) return proposalA;

    return {
      modelName: `Gemini Consensus (${proposalA.modelName} + ${proposalB.modelName})`,
      mappings: parsed.mappings,
    };
  } catch (_error) {
    return proposalA;
  }
}

/**
 * Main Entry Point for Dual AI Mapping Evaluation
 */
export async function evaluateDualAiMapping(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<AiColumnMappingResult | null> {
  // Execute Gemini and Grok in parallel
  const [resA, resB] = await Promise.allSettled([
    callGemini(headers, sampleRows),
    callGrok(headers, sampleRows),
  ]);

  const proposalA = resA.status === "fulfilled" ? resA.value : null;
  const proposalB = resB.status === "fulfilled" ? resB.value : null;

  if (!proposalA && !proposalB) {
    // Both AI services omitted or failed
    return null;
  }

  let finalProposal: AiMappingProposal;
  let activeModels: string[] = [];
  let synthesisUsed = false;

  if (proposalA && proposalB) {
    activeModels = [proposalA.modelName, proposalB.modelName];
    synthesisUsed = true;
    const synthesized = await callGeminiSynthesis(headers, sampleRows, proposalA, proposalB);
    finalProposal = synthesized || proposalA;
  } else if (proposalA) {
    activeModels = [proposalA.modelName];
    finalProposal = proposalA;
  } else {
    activeModels = [proposalB!.modelName];
    finalProposal = proposalB!;
  }

  const mapping: ColumnMappingDict = {};
  const headerToKeyMap: Record<string, string | null> = {};
  const explanations: Record<string, string> = {};

  for (const item of finalProposal.mappings) {
    headerToKeyMap[item.excelHeader] = item.canonicalKey;
    explanations[item.excelHeader] = item.explanation;
    if (item.canonicalKey) {
      mapping[item.canonicalKey] = item.excelHeader;
    }
  }

  return {
    mapping,
    headerToKeyMap,
    explanations,
    activeModels,
    synthesisUsed,
  };
}

import {
  assertEquals,
  assertExists,
  assert,
  assertStringIncludes,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildEnrichedIndicators,
  OPENAI_REQUEST_DEFAULTS,
  parseAnalysisResponse,
  resolveFinalResolutionStatus,
  SYSTEM_PROMPT,
} from "./_lib.ts";

// ────────────────────────────────────────────────────────────────────
// parseAnalysisResponse
// ────────────────────────────────────────────────────────────────────

Deno.test("parseAnalysisResponse: parses plain JSON", () => {
  const out = parseAnalysisResponse(`{"foo":"bar"}`);
  assertEquals(out.foo, "bar");
});

Deno.test("parseAnalysisResponse: strips ```json fences", () => {
  const raw = "```json\n{\"foo\":1}\n```";
  const out = parseAnalysisResponse(raw);
  assertEquals(out.foo, 1);
});

Deno.test("parseAnalysisResponse: strips bare ``` fences and whitespace", () => {
  const raw = "  ```\n{\"foo\":\"baz\"}\n```  ";
  const out = parseAnalysisResponse(raw);
  assertEquals(out.foo, "baz");
});

Deno.test("parseAnalysisResponse: throws on invalid JSON", () => {
  assertThrows(() => parseAnalysisResponse("not json at all"));
});

// ────────────────────────────────────────────────────────────────────
// buildEnrichedIndicators
// ────────────────────────────────────────────────────────────────────

Deno.test("buildEnrichedIndicators: non-sales conversation → sales=null", () => {
  const out = buildEnrichedIndicators({
    conversation_context: { type: "support" },
    customer_satisfaction: { indicators: ["agradeceu"] },
  });
  assertEquals(out.indicators, ["agradeceu"]);
  assertEquals(out.sales, null);
});

Deno.test("buildEnrichedIndicators: sales with closed_won populates sub-object", () => {
  const out = buildEnrichedIndicators({
    conversation_context: {
      type: "sales",
      sales_stage: "closed_won",
      buying_signals: ["pediu pix"],
      objections: [],
      loss_reason: null,
    },
    customer_satisfaction: { indicators: ["confirmou pedido"] },
  });
  assertEquals(out.indicators, ["confirmou pedido"]);
  assertExists(out.sales);
  assertEquals(out.sales!.stage, "closed_won");
  assertEquals(out.sales!.buying_signals, ["pediu pix"]);
  assertEquals(out.sales!.objections, []);
  assertEquals(out.sales!.loss_reason, null);
});

Deno.test("buildEnrichedIndicators: closed_lost with loss_reason", () => {
  const out = buildEnrichedIndicators({
    conversation_context: {
      type: "sales",
      sales_stage: "closed_lost",
      loss_reason: "preço",
    },
  });
  assertEquals(out.sales!.stage, "closed_lost");
  assertEquals(out.sales!.loss_reason, "preço");
  assertEquals(out.sales!.buying_signals, []);
  assertEquals(out.sales!.objections, []);
});

Deno.test("buildEnrichedIndicators: invalid sales_stage value → sales=null", () => {
  const out = buildEnrichedIndicators({
    conversation_context: {
      type: "sales",
      sales_stage: "totally_made_up_stage",
    },
  });
  assertEquals(out.sales, null);
});

Deno.test("buildEnrichedIndicators: missing conversation_context entirely", () => {
  const out = buildEnrichedIndicators({});
  assertEquals(out.indicators, []);
  assertEquals(out.sales, null);
});

Deno.test("buildEnrichedIndicators: indicators not an array → coerced to []", () => {
  const out = buildEnrichedIndicators({
    customer_satisfaction: { indicators: "oops a string" },
  });
  assertEquals(out.indicators, []);
});

Deno.test("buildEnrichedIndicators: returned object always has keys (jsonb shape lock)", () => {
  const out = buildEnrichedIndicators({});
  // Both keys must always exist so SQL consumers can rely on the shape.
  assert("indicators" in out);
  assert("sales" in out);
});

// ────────────────────────────────────────────────────────────────────
// resolveFinalResolutionStatus
// ────────────────────────────────────────────────────────────────────

Deno.test("resolveFinalResolutionStatus: sales+closed_won → resolved (overrides AI)", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales", sales_stage: "closed_won" },
    resolution_status: "pending", // AI was wrong; we override
  });
  assertEquals(out, "resolved");
});

Deno.test("resolveFinalResolutionStatus: sales+abandoned → unresolved", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales", sales_stage: "abandoned" },
    resolution_status: "pending",
  });
  assertEquals(out, "unresolved");
});

Deno.test("resolveFinalResolutionStatus: sales+closed_lost → unresolved", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales", sales_stage: "closed_lost" },
    resolution_status: "resolved",
  });
  assertEquals(out, "unresolved");
});

Deno.test("resolveFinalResolutionStatus: sales+negotiating → pending", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales", sales_stage: "negotiating" },
    resolution_status: "resolved",
  });
  assertEquals(out, "pending");
});

Deno.test("resolveFinalResolutionStatus: sales+cold_lead → pending", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales", sales_stage: "cold_lead" },
  });
  assertEquals(out, "pending");
});

Deno.test("resolveFinalResolutionStatus: non-sales → keep AI value", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "support" },
    resolution_status: "resolved",
  });
  assertEquals(out, "resolved");
});

Deno.test("resolveFinalResolutionStatus: sales without stage → keep AI value", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales" },
    resolution_status: "partially_resolved",
  });
  assertEquals(out, "partially_resolved");
});

Deno.test("resolveFinalResolutionStatus: sales with invalid stage → keep AI value", () => {
  const out = resolveFinalResolutionStatus({
    conversation_context: { type: "sales", sales_stage: "garbage" },
    resolution_status: "unresolved",
  });
  assertEquals(out, "unresolved");
});

// ────────────────────────────────────────────────────────────────────
// Regression guards on prompt + OpenAI request defaults
// (catch accidental edits that would degrade quality)
// ────────────────────────────────────────────────────────────────────

Deno.test("OPENAI_REQUEST_DEFAULTS: max_tokens >= 2000 (prompt grew, must not truncate)", () => {
  assert(
    OPENAI_REQUEST_DEFAULTS.max_tokens >= 2000,
    `max_tokens dropped to ${OPENAI_REQUEST_DEFAULTS.max_tokens}; the new prompt requires >= 2000`,
  );
});

Deno.test("OPENAI_REQUEST_DEFAULTS: low temperature for classification stability", () => {
  assert(
    OPENAI_REQUEST_DEFAULTS.temperature <= 0.3,
    `temperature ${OPENAI_REQUEST_DEFAULTS.temperature} is too high for classification — keep <= 0.3`,
  );
});

Deno.test("SYSTEM_PROMPT: declares all 5 sales stages", () => {
  for (const stage of [
    "cold_lead",
    "negotiating",
    "closed_won",
    "closed_lost",
    "abandoned",
  ]) {
    assertStringIncludes(SYSTEM_PROMPT, stage);
  }
});

Deno.test("SYSTEM_PROMPT: keeps the bilateral-intent rule for sales", () => {
  // Without this rule the AI starts marking every price quote as 'sales'.
  assertStringIncludes(SYSTEM_PROMPT, "intenção bilateral");
});

Deno.test("SYSTEM_PROMPT: keeps the 'vou pensar = abandoned' rule", () => {
  assertStringIncludes(SYSTEM_PROMPT, "Vou pensar");
  assertStringIncludes(SYSTEM_PROMPT, "abandoned");
});

Deno.test("SYSTEM_PROMPT: keeps the closed_won textual-evidence rule", () => {
  assertStringIncludes(SYSTEM_PROMPT, "EVIDÊNCIA TEXTUAL");
});

Deno.test("SYSTEM_PROMPT: declares all loss_reason buckets", () => {
  for (const reason of [
    "preço",
    "prazo",
    "concorrência",
    "produto_indisponível",
    "sem_resposta",
    "outro",
  ]) {
    assertStringIncludes(SYSTEM_PROMPT, reason);
  }
});

Deno.test("SYSTEM_PROMPT: instructs JSON-only output", () => {
  assertStringIncludes(SYSTEM_PROMPT, "SOMENTE o JSON");
});

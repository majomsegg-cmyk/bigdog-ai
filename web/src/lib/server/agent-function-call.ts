import { normalizeCreativeFoundation, normalizeCreativeReview, type CreativeReview } from "@/lib/creative-agent-contract";
import type { CreativeGenerationMode } from "@/lib/creative-runtime-contract";
import type { TextPlanningProtocol } from "./text-planning-runtime";
import { validateAgentPlan, validateAgentPlanGenerationMode, type AgentPlan } from "./agent-run-validation";
import { strictJsonObjectText } from "./structured-model-output";

export type AgentFunctionCallResult = { arguments: string; protocol?: TextPlanningProtocol; elapsedMs?: number; pointsCost?: number; pointsRemaining?: number; pointsRecordId?: string };

export async function parseAgentPlanCall(
    call: AgentFunctionCallResult,
    onInvalid: () => Promise<unknown>,
    conversationFallback?: { objective: string; reply?: string },
    options?: { allowProjectHandoff?: boolean; requiredGenerationMode?: CreativeGenerationMode },
): Promise<AgentPlan> {
    try {
        const raw = parsePlanArguments(call.arguments, conversationFallback);
        const conversation = Boolean(conversationFallback) || raw.intent === "conversation";
        const objective = conversationFallback?.objective || (typeof raw.objective === "string" && raw.objective.trim() ? raw.objective : "普通对话");
        const plan: unknown = {
            ...raw,
            ...(options?.allowProjectHandoff === false ? { projectHandoff: undefined } : {}),
            ...(conversation
                ? {
                      intent: "conversation",
                      objective,
                      reply: typeof raw.reply === "string" && raw.reply.trim() ? raw.reply : conversationFallback?.reply,
                      decisions: [],
                      deliverables: [],
                      projectHandoff: undefined,
                  }
                : {}),
            foundation: normalizeCreativeFoundation(raw.foundation, objective),
        };
        validateAgentPlan(plan);
        validateAgentPlanGenerationMode(plan, options?.requiredGenerationMode);
        return plan;
    } catch (error) {
        await onInvalid();
        throw error;
    }
}

function parsePlanArguments(value: string, conversationFallback?: { objective: string; reply?: string }) {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("模型返回的创作计划无效");
        return parsed as Record<string, unknown>;
    } catch (error) {
        // 容忍模型在计划 JSON 之后附带额外文字（重复输出、收尾说明等）导致 JSON.parse 失败：
        // 尝试提取第一个完整 JSON 对象再解析，成功则使用该计划。
        const recovered = strictJsonObjectText(value);
        if (recovered) {
            try {
                const parsed = JSON.parse(recovered) as unknown;
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
            } catch {
                // 继续走下面的对话回退或抛出原始错误
            }
        }
        const reply = value.trim();
        if (conversationFallback && reply && !reply.startsWith("{") && !reply.startsWith("[")) return { intent: "conversation", objective: conversationFallback.objective, reply };
        throw error;
    }
}

export async function parseReviewCall(call: AgentFunctionCallResult, validIds: Set<string>, onInvalid: () => Promise<unknown>): Promise<CreativeReview | null> {
    try {
        const review = normalizeCreativeReview(JSON.parse(call.arguments), validIds);
        if (!review) throw new Error("模型返回的复盘结构无效");
        return review;
    } catch {
        await onInvalid();
        return null;
    }
}

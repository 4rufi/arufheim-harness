import { z } from "zod";

export const RISK_CLASSES = ["R0", "R1", "R2", "R3"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export const permissionPolicySchema = z.object({
  mode: z.enum(["always_allow", "always_ask", "allow_list"]).default(
    "always_allow",
  ),
  allowedTools: z.array(z.string()).default([]),
  allowedRisk: z.array(z.enum(RISK_CLASSES)).default([]),
});

export type PermissionPolicy = z.infer<typeof permissionPolicySchema>;

export function normalizePermissionPolicy(
  policy: PermissionPolicy,
): PermissionPolicy {
  return {
    mode: policy.mode,
    allowedTools: Array.from(
      new Set(policy.allowedTools.map((entry) => entry.trim()).filter(Boolean)),
    ),
    allowedRisk: Array.from(new Set(policy.allowedRisk)),
  };
}

export function summarizePermissionPolicy(
  policy: PermissionPolicy,
): Record<string, unknown> {
  return {
    mode: policy.mode,
    allowedTools: policy.allowedTools,
    allowedRisk: policy.allowedRisk,
  };
}

export function enforcePermissionPolicy(
  policy: PermissionPolicy,
  toolName: string,
  risk: RiskClass,
): void {
  if (policy.mode === "always_allow") {
    return;
  }

  if (policy.mode === "always_ask") {
    throw new Error(
      `PermissionPolicy blocked '${toolName}' (${risk}). Human approval required or switch to always_allow/allow_list.`,
    );
  }

  if (policy.allowedTools.includes(toolName) || policy.allowedRisk.includes(risk)) {
    return;
  }

  throw new Error(
    `PermissionPolicy denied '${toolName}' (${risk}). Add the tool or risk class to allow_list.`,
  );
}

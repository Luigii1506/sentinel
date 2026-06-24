import type { JsonValue } from "./types";

export type AlertRule = {
  id: string;
  name: string;
  enabled: boolean;
  match: (input: {
    entityId: string;
    changedFields: string[];
    diff: Record<string, { before: JsonValue | undefined; after: JsonValue | undefined }>;
  }) => boolean;
};

export type AlertDecision = {
  ruleId: string;
  triggered: boolean;
  reason?: string;
};

export const evaluateAlerts = (
  rules: AlertRule[],
  input: {
    entityId: string;
    changedFields: string[];
    diff: Record<string, { before: JsonValue | undefined; after: JsonValue | undefined }>;
  }
): AlertDecision[] =>
  rules.map((rule) => ({
    ruleId: rule.id,
    triggered: rule.enabled && rule.match(input),
  }));

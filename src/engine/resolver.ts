import type { CanonicalHints, JsonValue } from "./types";

const isPlainObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

export const extractCanonicalHints = (payload: JsonValue): CanonicalHints => {
  if (!isPlainObject(payload)) return {};

  const canonicalId =
    typeof payload.canonical_id === "string"
      ? payload.canonical_id
      : typeof payload.canonicalId === "string"
        ? payload.canonicalId
        : undefined;

  const canonicalName =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.title === "string"
        ? payload.title
        : undefined;

  return { canonicalId, canonicalName };
};

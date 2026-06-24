import type { JsonValue } from "./types";

export type DiffEntry = {
  before: JsonValue | undefined;
  after: JsonValue | undefined;
};

export type DiffResult = {
  changedFields: string[];
  diff: Record<string, DiffEntry>;
  changeType: "created" | "updated" | "unchanged";
};

const isPlainObject = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const stableStringify = (value: unknown) => {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return JSON.stringify(value);
  }

  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (isPlainObject(input)) {
      return Object.keys(input)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = normalize(input[key]);
          return acc;
        }, {});
    }
    return input;
  };

  return JSON.stringify(normalize(value));
};

export const computeDiff = (
  previous: JsonValue | undefined,
  current: JsonValue | undefined
): DiffResult => {
  if (previous === undefined) {
    if (current === undefined) {
      return { changedFields: [], diff: {}, changeType: "unchanged" };
    }
    if (isPlainObject(current)) {
      const changedFields = Object.keys(current);
      const diff = changedFields.reduce<Record<string, DiffEntry>>(
        (acc, key) => {
          acc[key] = { before: undefined, after: current[key] };
          return acc;
        },
        {}
      );
      return { changedFields, diff, changeType: "created" };
    }
    return {
      changedFields: ["value"],
      diff: { value: { before: undefined, after: current } },
      changeType: "created",
    };
  }

  if (stableStringify(previous) === stableStringify(current)) {
    return { changedFields: [], diff: {}, changeType: "unchanged" };
  }

  if (!isPlainObject(previous) || !isPlainObject(current)) {
    return {
      changedFields: ["value"],
      diff: { value: { before: previous, after: current } },
      changeType: "updated",
    };
  }

  const keys = new Set([
    ...Object.keys(previous),
    ...Object.keys(current),
  ]);
  const changedFields: string[] = [];
  const diff: Record<string, DiffEntry> = {};

  keys.forEach((key) => {
    const before = previous[key];
    const after = current[key];
    if (stableStringify(before) !== stableStringify(after)) {
      changedFields.push(key);
      diff[key] = { before, after };
    }
  });

  return {
    changedFields,
    diff,
    changeType: changedFields.length ? "updated" : "unchanged",
  };
};

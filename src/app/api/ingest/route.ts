import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { computeDiff } from "@/engine/diff";
import { extractCanonicalHints } from "@/engine/resolver";
import type { JsonValue } from "@/engine/types";

type IngestBody = {
  source: {
    name: string;
    region: string;
    type: string;
    baseUrl?: string;
    metadata?: JsonValue;
  };
  observation: {
    sourceUrl: string;
    fetchedAt?: string;
    payload: JsonValue;
    extractionVersion?: string;
    raw?: {
      contentType?: string;
      bodyText?: string;
      storageUrl?: string;
    };
  };
  extractRun?: {
    extractorVersion?: string;
    stats?: JsonValue;
    startedAt?: string;
    finishedAt?: string;
  };
};

const ensureString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export async function POST(request: Request) {
  const body = (await request.json()) as IngestBody;

  if (
    !body?.source ||
    !ensureString(body.source.name) ||
    !ensureString(body.source.region) ||
    !ensureString(body.source.type) ||
    !body.observation ||
    !ensureString(body.observation.sourceUrl)
  ) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 }
    );
  }

  const sourceRecord = await db.source.upsert({
    where: {
      name_region_type: {
        name: body.source.name,
        region: body.source.region,
        type: body.source.type,
      },
    },
    update: {
      baseUrl: body.source.baseUrl,
      metadata: body.source.metadata ?? undefined,
    },
    create: {
      name: body.source.name,
      region: body.source.region,
      type: body.source.type,
      baseUrl: body.source.baseUrl,
      metadata: body.source.metadata ?? undefined,
    },
  });

  const rawInput =
    body.observation.raw?.bodyText ??
    JSON.stringify(body.observation.payload ?? null);
  const bodyHash = createHash("sha256").update(rawInput).digest("hex");

  const rawDocument = await db.rawDocument.create({
    data: {
      sourceId: sourceRecord.id,
      url: body.observation.sourceUrl,
      contentType: body.observation.raw?.contentType,
      bodyHash,
      bodyText: body.observation.raw?.bodyText,
      storageUrl: body.observation.raw?.storageUrl,
    },
  });

  const extractRun = body.extractRun
    ? await db.extractRun.create({
        data: {
          sourceId: sourceRecord.id,
          extractorVersion: body.extractRun.extractorVersion,
          stats: body.extractRun.stats ?? undefined,
          startedAt: body.extractRun.startedAt
            ? new Date(body.extractRun.startedAt)
            : undefined,
          finishedAt: body.extractRun.finishedAt
            ? new Date(body.extractRun.finishedAt)
            : undefined,
        },
      })
    : null;

  const observation = await db.observation.create({
    data: {
      sourceId: sourceRecord.id,
      rawDocumentId: rawDocument.id,
      extractRunId: extractRun?.id,
      sourceUrl: body.observation.sourceUrl,
      fetchedAt: body.observation.fetchedAt
        ? new Date(body.observation.fetchedAt)
        : undefined,
      payload: body.observation.payload,
      extractionVersion: body.observation.extractionVersion,
    },
  });

  const hints = extractCanonicalHints(body.observation.payload);
  const fallbackId = `${sourceRecord.id}:${createHash("sha256")
    .update(body.observation.sourceUrl)
    .digest("hex")}`;
  const canonicalId = hints.canonicalId ?? fallbackId;
  const canonicalName = hints.canonicalName ?? body.observation.sourceUrl;
  const canonicalAttributes = body.observation.payload;

  const existing = await db.entity.findUnique({
    where: { canonicalId },
  });

  const diffResult = computeDiff(
    (existing?.canonicalAttributes ?? undefined) as JsonValue | undefined,
    canonicalAttributes as JsonValue
  );

  const entity = existing
    ? await db.entity.update({
        where: { canonicalId },
        data: {
          canonicalName,
          canonicalAttributes,
          lastSeenAt: new Date(),
        },
      })
    : await db.entity.create({
        data: {
          canonicalId,
          canonicalName,
          canonicalAttributes,
        },
      });

  await db.entityMapping.upsert({
    where: {
      entityId_observationId: {
        entityId: entity.id,
        observationId: observation.id,
      },
    },
    update: {
      confidence: hints.canonicalId ? 0.9 : 0.4,
      ruleUsed: hints.canonicalId ? "canonical_id" : "source_url_hash",
    },
    create: {
      entityId: entity.id,
      observationId: observation.id,
      confidence: hints.canonicalId ? 0.9 : 0.4,
      ruleUsed: hints.canonicalId ? "canonical_id" : "source_url_hash",
    },
  });

  if (diffResult.changeType !== "unchanged") {
    await db.changeLog.create({
      data: {
        entityId: entity.id,
        observationId: observation.id,
        changedFields: diffResult.changedFields,
        changeType: diffResult.changeType,
        diff: diffResult.diff,
      },
    });
  }

  return NextResponse.json({
    entityId: entity.id,
    observationId: observation.id,
    changeType: diffResult.changeType,
    changedFields: diffResult.changedFields,
  });
}

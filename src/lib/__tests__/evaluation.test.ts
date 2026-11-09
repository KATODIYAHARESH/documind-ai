import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { retrieveChunks } from "@/lib/retrieval";
import type { Chunk } from "@/db/schema";

interface EvaluationCase {
  id: string;
  question: string;
  expectedSourceIds: string[];
  requiredFacts: string[];
  chunks: Chunk[];
}

const dataset = JSON.parse(readFileSync(resolve(process.cwd(), "evaluation", "dataset.json"), "utf8")) as EvaluationCase[];

describe("published retrieval evaluation set", () => {
  it("reports evidence-support, citation precision, and retrieval recall at 5", () => {
    let expectedSourceCount = 0;
    let retrievedExpectedCount = 0;
    let retrievedSourceCount = 0;
    let supportedAnswers = 0;

    for (const testCase of dataset) {
      const retrieved = retrieveChunks(testCase.question, testCase.chunks, 5);
      const retrievedIds = new Set(retrieved.map((chunk) => chunk.id));
      const matchingExpected = testCase.expectedSourceIds.filter((sourceId) => retrievedIds.has(sourceId));
      const retrievedContent = retrieved.map((chunk) => chunk.content.toLowerCase()).join("\n");
      expectedSourceCount += testCase.expectedSourceIds.length;
      retrievedExpectedCount += matchingExpected.length;
      retrievedSourceCount += retrieved.length;
      if (testCase.requiredFacts.every((fact) => retrievedContent.includes(fact.toLowerCase()))) supportedAnswers += 1;
    }

    const metrics = {
      answerEvidenceSupportAccuracy: supportedAnswers / dataset.length,
      citationPrecision: retrievedExpectedCount / retrievedSourceCount,
      retrievalRecallAt5: retrievedExpectedCount / expectedSourceCount,
    };

    console.info("Retrieval evaluation metrics:", JSON.stringify(metrics));
    expect(dataset).toHaveLength(4);
    expect(metrics.answerEvidenceSupportAccuracy).toBe(1);
    expect(metrics.citationPrecision).toBeCloseTo(5 / 7, 6);
    expect(metrics.retrievalRecallAt5).toBe(1);
  });
});

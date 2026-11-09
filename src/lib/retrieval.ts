import { Chunk } from "@/db/schema";

export interface RetrievedChunk extends Chunk {
  score: number;
  documentName?: string;
}

export type EvidenceStatus = "strong" | "partial" | "limited";

export function assessEvidence(query: string, content: string): { status: EvidenceStatus; matchCoverage: number } {
  const terms = Array.from(new Set(tokenize(query)));
  if (!terms.length) return { status: "limited", matchCoverage: 0 };
  const contentTerms = new Set(tokenize(content));
  const matched = terms.filter((term) => contentTerms.has(term) || [...contentTerms].some((word) => word.startsWith(term.slice(0, 4))));
  const matchCoverage = matched.length / terms.length;
  return {
    status: matchCoverage >= 0.65 ? "strong" : matchCoverage >= 0.3 ? "partial" : "limited",
    matchCoverage,
  };
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function vectorizeText(text: string, vocabulary: string[]): number[] {
  const tokens = tokenize(text);
  const vector = new Array(vocabulary.length).fill(0);

  for (const token of tokens) {
    const index = vocabulary.indexOf(token);
    if (index >= 0) vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return new Array(vocabulary.length).fill(0);
  return vector.map((value) => value / magnitude);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);
  return Number(dot.toFixed(6));
}

function tfidfScore(queryTokens: string[], docTokens: string[]): number {
  let score = 0;
  const docSet = new Set(docTokens);
  const docFreq = new Map<string, number>();
  for (const t of docTokens) docFreq.set(t, (docFreq.get(t) || 0) + 1);

  for (const q of queryTokens) {
    if (docSet.has(q)) {
      const tf = (docFreq.get(q) || 0) / docTokens.length;
      const idf = Math.log(10 / (1 + q.length * 0.1)) + 1;
      score += tf * 10 + 1.5 * idf;
      if (docTokens.some((dt) => dt.includes(q) || q.includes(dt))) {
        score += 0.5;
      }
    } else if (docTokens.some((dt) => dt.startsWith(q.slice(0, 4)) || q.startsWith(dt.slice(0, 4)))) {
      score += 0.3;
    }
  }

  return score;
}

export function retrieveChunks(query: string, allChunks: Chunk[], topK = 5): RetrievedChunk[] {
  if (!query.trim() || allChunks.length === 0) return [];

  const queryLower = query.toLowerCase();
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return allChunks.slice(0, topK).map((c) => ({ ...c, score: 1 }));
  }

  const scored = allChunks.map((chunk) => {
    const contentLower = chunk.content.toLowerCase();
    const contentTokens = tokenize(chunk.content);
    const vocabulary = Array.from(new Set([...queryTokens, ...contentTokens])).sort();
    const lexical = tfidfScore(queryTokens, contentTokens);
    const vectorScore = cosineSimilarity(
      vectorizeText(queryLower, vocabulary),
      vectorizeText(contentLower, vocabulary),
    );
    let score = lexical + vectorScore * 4;

    if (contentLower.includes(queryLower)) {
      score += 5;
    }

    if (chunk.heading && queryTokens.some((t) => chunk.heading!.toLowerCase().includes(t))) {
      score += 2;
    }

    score += 0.01 * (1 / (chunk.chunkIndex + 1));

    return { ...chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const threshold = 0.5;
  const filtered = scored.filter((s) => s.score >= threshold);

  if (filtered.length === 0 && queryLower.match(/summar|overview|about|main|key points|explain/)) {
    return scored.slice(0, Math.min(topK, 3));
  }

  return filtered.slice(0, topK);
}

export function buildContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "No relevant context found.";
  
  return chunks.map((c, i) => {
    const source = `Source ${i+1}${c.documentName ? ` (${c.documentName})` : ""}${c.pageNumber ? ` (Page ${c.pageNumber})` : ''}${c.heading ? ` - ${c.heading}` : ''}`;
    return `[${source}]\n${c.content}`;
  }).join("\n\n---\n\n");
}

export function formatSources(chunks: RetrievedChunk[], query: string): string {
  return JSON.stringify(chunks.map(c => {
    const evidence = assessEvidence(query, c.content);
    return {
      id: c.id,
      documentId: c.documentId,
      documentName: c.documentName,
      chunkIndex: c.chunkIndex,
      pageNumber: c.pageNumber,
      heading: c.heading,
      passage: c.content,
      score: c.score,
      evidenceStatus: evidence.status,
      matchCoverage: evidence.matchCoverage,
    };
  }));
}

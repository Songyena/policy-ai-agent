import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { env } from "../config/env";
import type { RawPolicySource } from "../types/policy";

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
}

/**
 * 화면설계서(Figma) 내 텍스트를 그대로 로컬 텍스트 파일로 내보낸 결과를 파싱한다.
 * 각 문단(빈 줄로 구분)을 하나의 RawPolicySource로 취급한다.
 * Figma API 연동 없이도 쓸 수 있는 최소 경로.
 */
export function parseFigmaTextExport(filePath: string): RawPolicySource[] {
  const text = readFileSync(filePath, "utf-8");
  const fileName = basename(filePath);
  const extractedAt = new Date().toISOString();

  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks.map((block, index) => ({
    id: randomUUID(),
    sourceType: "figma" as const,
    sourceRef: `${fileName}#block${index + 1}`,
    rawText: block,
    extractedAt,
  }));
}

/**
 * 사용자가 입력한 Figma 파일 URL(file/design/proto 형식)에서 fileKey를 추출한다.
 * 예: https://www.figma.com/design/abcXYZ123/정책-화면?node-id=1-2 → "abcXYZ123"
 * 매칭되지 않으면 null을 반환한다.
 */
export function extractFigmaFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

/** Figma 문서 트리에서 TEXT 노드만 재귀적으로 수집한다. */
function collectTextNodes(node: FigmaNode, acc: FigmaNode[] = []): FigmaNode[] {
  if (node.type === "TEXT" && node.characters?.trim()) {
    acc.push(node);
  }
  for (const child of node.children ?? []) {
    collectTextNodes(child, acc);
  }
  return acc;
}

/**
 * Figma REST API로 파일을 직접 읽어와 화면 내 텍스트 레이어를 추출한다.
 * FIGMA_ACCESS_TOKEN / FIGMA_FILE_KEY(.env)가 설정된 경우에만 사용 가능.
 */
export async function fetchFigmaFileText(
  fileKey: string = env.FIGMA_FILE_KEY ?? "",
  token: string = env.FIGMA_ACCESS_TOKEN ?? "",
): Promise<RawPolicySource[]> {
  if (!fileKey || !token) {
    throw new Error(
      "FIGMA_FILE_KEY / FIGMA_ACCESS_TOKEN이 설정되지 않았습니다. .env를 확인하세요.",
    );
  }

  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!response.ok) {
    throw new Error(`Figma API 요청 실패: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { document: FigmaNode };
  const textNodes = collectTextNodes(data.document);
  const extractedAt = new Date().toISOString();

  return textNodes.map((node) => ({
    id: randomUUID(),
    sourceType: "figma" as const,
    sourceRef: `${fileKey}#${node.id}(${node.name})`,
    rawText: node.characters ?? "",
    extractedAt,
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  if (!target) {
    console.error("사용법: npm run parse:figma -- <내보낸 텍스트 파일 경로>");
    process.exit(1);
  }
  const sources = parseFigmaTextExport(target);
  console.log(JSON.stringify(sources, null, 2));
}

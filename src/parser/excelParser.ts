import * as XLSX from "xlsx";
import { POLICY_REQUIRED_FIELDS, type PolicyDraftFields } from "../types/policy";
import { TERM_REQUIRED_FIELDS, type TermDraftFields } from "../types/term";
import {
  TERMS_CONDITIONS_REQUIRED_FIELDS,
  type TermsConditionsDraftFields,
} from "../types/termsConditions";

const FALLBACK_HEADER_PATTERN = /^컬럼\d+$/;

function isBlank(value: unknown): boolean {
  return value === "" || value === null || value === undefined;
}

function isCellBlank(cell: XLSX.CellObject | undefined): boolean {
  return !cell || isBlank(cell.v);
}

function cellText(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  return cell && !isBlank(cell.v) ? String(cell.v).trim() : "";
}

/** 주어진 행의 지정된 컬럼 범위 안에 실제 텍스트가 하나라도 있는지 확인한다. */
function rowHasText(sheet: XLSX.WorkSheet, row: number, colStart: number, colEnd: number): boolean {
  for (let c = colStart; c <= colEnd; c++) {
    if (cellText(sheet, row, c)) return true;
  }
  return false;
}

/**
 * 병합된 셀(Merged Cell)은 SheetJS가 대표(좌상단) 셀에만 값을 채우고 나머지 영역은
 * 비워두므로, 병합 영역 전체에 대표 값을 그대로 채워 넣는다(Forward Fill).
 * 세로 방향(같은 컬럼, 여러 행) 병합만 채운다 — 가로 방향은 일부러 채우지 않는다.
 */
function forwardFillMergedCells(sheet: XLSX.WorkSheet, skipThroughRow: number): void {
  const merges = sheet["!merges"] ?? [];
  for (const range of merges) {
    if (range.s.c !== range.e.c) continue;
    if (range.s.r <= skipThroughRow) continue;

    const anchorRef = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c });
    const anchorCell = sheet[anchorRef];
    if (!anchorCell) continue;

    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: range.s.c });
      if (isCellBlank(sheet[cellRef])) {
        sheet[cellRef] = { ...anchorCell };
      }
    }
  }
}

/** 헤더 블록(headerStartRow~headerEndRow) 안의 병합만 채운다(가로 그룹 헤더 포함). */
function fillHeaderMerges(sheet: XLSX.WorkSheet, headerStartRow: number, headerEndRow: number): void {
  const merges = sheet["!merges"] ?? [];
  for (const range of merges) {
    if (range.s.r < headerStartRow || range.e.r > headerEndRow) continue;

    const anchorRef = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c });
    const anchorCell = sheet[anchorRef];
    if (!anchorCell) continue;

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        if (r === range.s.r && c === range.s.c) continue;
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (isCellBlank(sheet[cellRef])) {
          sheet[cellRef] = { ...anchorCell };
        }
      }
    }
  }
}

/** 실제 헤더가 시작되는 행을 찾는다(제목행/빈 행을 건너뛴다). */
function detectHeaderStartRow(sheet: XLSX.WorkSheet, range: XLSX.Range): number {
  const totalCols = range.e.c - range.s.c + 1;
  const threshold = Math.max(3, Math.ceil(totalCols * 0.3));
  const scanLimit = Math.min(range.e.r, range.s.r + 30);

  for (let r = range.s.r; r <= scanLimit; r++) {
    let nonBlank = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (cellText(sheet, r, c)) nonBlank++;
    }
    if (nonBlank >= threshold) return r;
  }
  return range.s.r;
}

/** 주어진 행이 "완전한 그룹 헤더 행"인지 판단한다. */
function rowIsGroupHeaderCandidate(sheet: XLSX.WorkSheet, row: number, range: XLSX.Range): boolean {
  const merges = sheet["!merges"] ?? [];
  let hasMergeContribution = false;
  for (let c = range.s.c; c <= range.e.c; c++) {
    if (cellText(sheet, row, c)) continue;
    const coveredByMerge = merges.some(
      (m) => row >= m.s.r && row <= m.e.r && c >= m.s.c && c <= m.e.c,
    );
    if (!coveredByMerge) return false;
    hasMergeContribution = true;
  }
  return hasMergeContribution;
}

function maybeExtendHeaderStartUpward(
  sheet: XLSX.WorkSheet,
  headerStartRow: number,
  range: XLSX.Range,
): number {
  const aboveRow = headerStartRow - 1;
  if (aboveRow < range.s.r) return headerStartRow;
  return rowIsGroupHeaderCandidate(sheet, aboveRow, range) ? aboveRow : headerStartRow;
}

/** 헤더가 여러 행에 걸친 경우(그룹 헤더 + 세부 헤더)를 감지한다. */
function detectHeaderEndRow(sheet: XLSX.WorkSheet, headerStartRow: number, range: XLSX.Range): number {
  const merges = sheet["!merges"] ?? [];
  const headerRowHasMerge = merges.some((m) => m.s.r <= headerStartRow && m.e.r >= headerStartRow);
  if (!headerRowHasMerge) return headerStartRow;

  const nextRow = headerStartRow + 1;
  if (nextRow > range.e.r) return headerStartRow;
  return rowHasText(sheet, nextRow, range.s.c, range.e.c) ? nextRow : headerStartRow;
}

/** 헤더 블록 안에서 컬럼별로 서로 다른 값을 이어붙여 최종 컬럼명을 만든다. */
function buildColumnHeaders(
  sheet: XLSX.WorkSheet,
  headerStartRow: number,
  headerEndRow: number,
  range: XLSX.Range,
): string[] {
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const parts: string[] = [];
    for (let r = headerStartRow; r <= headerEndRow; r++) {
      const text = cellText(sheet, r, c).replace(/\s*\n\s*/g, " ");
      if (text && !parts.includes(text)) parts.push(text);
    }
    headers.push(parts.length > 0 ? parts.join(" - ") : `컬럼${c - range.s.c + 1}`);
  }
  return headers;
}

/** 모든 행에서 값이 비어있는 컬럼(완전히 빈 컬럼)을 제거한다. */
function dropEmptyColumns(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  if (rows.length === 0) return rows;
  const keys = Object.keys(rows[0] ?? {});
  const emptyKeys = keys.filter((key) => rows.every((row) => isBlank(row[key])));
  if (emptyKeys.length === 0) return rows;
  return rows.map((row) => {
    const filtered = { ...row };
    for (const key of emptyKeys) delete filtered[key];
    return filtered;
  });
}

/**
 * 시트 하나를 헤더 위치/병합 셀을 자동 감지해 {헤더명: 값} 행 목록으로 변환한다.
 * 판단/매핑 없이 순수하게 "엑셀 표를 JSON 행으로" 만드는 단계다.
 */
function sheetToRows(sheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, string>[] } {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");

  const detectedHeaderStartRow = detectHeaderStartRow(sheet, range);
  const headerStartRow = maybeExtendHeaderStartUpward(sheet, detectedHeaderStartRow, range);
  let headerEndRow = detectHeaderEndRow(sheet, headerStartRow, range);
  let headers = buildColumnHeaders(sheet, headerStartRow, headerEndRow, range);

  if (headers.every((h) => FALLBACK_HEADER_PATTERN.test(h))) {
    headerEndRow = headerStartRow;
    headers = buildColumnHeaders(sheet, headerStartRow, headerEndRow, range);
  }

  fillHeaderMerges(sheet, headerStartRow, headerEndRow);
  headers = buildColumnHeaders(sheet, headerStartRow, headerEndRow, range);
  if (headers.every((h) => FALLBACK_HEADER_PATTERN.test(h))) {
    headerEndRow = headerStartRow;
    headers = buildColumnHeaders(sheet, headerStartRow, headerEndRow, range);
  }

  forwardFillMergedCells(sheet, headerEndRow);

  const dataRange = XLSX.utils.encode_range({
    s: { r: headerEndRow + 1, c: range.s.c },
    e: { r: range.e.r, c: range.e.c },
  });
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    range: dataRange,
    defval: "",
    blankrows: false,
  });

  const objectRows = rawRows.map((values) =>
    Object.fromEntries(headers.map((header, i) => [header, String(values[i] ?? "").trim()])),
  );
  const nonEmptyRows = objectRows.filter((row) => !Object.values(row).every(isBlank));
  const rows = dropEmptyColumns(nonEmptyRows) as Record<string, string>[];

  return { headers, rows };
}

// ── 시트명 → 엔티티 타입 감지 ───────────────────────────────────────────
export type SheetEntityType = "policy" | "term" | "termsConditions";

function detectSheetType(sheetName: string): SheetEntityType | null {
  const name = sheetName.replace(/\s+/g, "");
  if (name.includes("약관")) return "termsConditions";
  if (name.includes("용어")) return "term";
  if (name.includes("정책")) return "policy";
  return null;
}

// ── 헤더 별칭 → 고정 필드 매핑 ───────────────────────────────────────────
function normalizeHeader(header: string): string {
  return header.replace(/[\s()/]+/g, "");
}

/** 헤더 목록에서 별칭에 매칭되는 첫 헤더의 값을 찾는다. */
function pickField(row: Record<string, string>, headers: string[], aliases: string[]): string {
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (aliases.some((alias) => normalized.includes(alias))) {
      const value = row[header] ?? "";
      if (!isBlank(value)) return value;
    }
  }
  return "";
}

/** 헤더 목록에서 별칭에 매칭되는 모든 헤더의 값을 배열로 모은다(유사어 등 다건 컬럼용). */
function pickMultiField(row: Record<string, string>, headers: string[], aliases: string[]): string[] {
  const values: string[] = [];
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (aliases.some((alias) => normalized.includes(alias))) {
      const value = row[header] ?? "";
      if (!isBlank(value)) values.push(value);
    }
  }
  return values;
}

const POLICY_ALIASES = {
  category: ["구분"],
  policyName: ["정책명"],
  subItem: ["세부항목"],
  ruleDesc: ["설명1"],
  detailDesc: ["설명2"],
  example: ["예시"],
  author: ["작성자", "작성/수정자"],
  updatedAt: ["작성일", "작성/수정일"],
};

const TERM_ALIASES = {
  standardTerm: ["용어1", "표준용어"],
  synonyms: ["용어2", "용어3", "용어4", "유사어", "혼용어"],
  uiMenu: ["메뉴"],
  definition: ["개념", "정의"],
  note: ["비고"],
  author: ["작성자", "작성/수정자"],
  updatedAt: ["작성일", "작성/수정일"],
};

const TERMS_CONDITIONS_ALIASES = {
  useStatus: ["사용여부"],
  requiredStatus: ["필수여부"],
  deviceCategory: ["기기구분"],
  termsName: ["약관명"],
  fileName: ["파일명"],
  manageCode: ["관리코드"],
  revisionDate: ["제정일", "개정일"],
  author: ["작성자", "작성/수정자"],
  updatedAt: ["작성일", "작성/수정일"],
};

function mapPolicyRow(row: Record<string, string>, headers: string[]): PolicyDraftFields {
  return {
    category: pickField(row, headers, POLICY_ALIASES.category),
    policyName: pickField(row, headers, POLICY_ALIASES.policyName),
    subItem: pickField(row, headers, POLICY_ALIASES.subItem),
    ruleDesc: pickField(row, headers, POLICY_ALIASES.ruleDesc),
    detailDesc: pickField(row, headers, POLICY_ALIASES.detailDesc),
    example: pickField(row, headers, POLICY_ALIASES.example),
    author: pickField(row, headers, POLICY_ALIASES.author),
    updatedAt: pickField(row, headers, POLICY_ALIASES.updatedAt),
  };
}

function mapTermRow(row: Record<string, string>, headers: string[]): TermDraftFields {
  return {
    standardTerm: pickField(row, headers, TERM_ALIASES.standardTerm),
    synonyms: pickMultiField(row, headers, TERM_ALIASES.synonyms),
    uiMenu: pickField(row, headers, TERM_ALIASES.uiMenu),
    definition: pickField(row, headers, TERM_ALIASES.definition),
    note: pickField(row, headers, TERM_ALIASES.note),
    author: pickField(row, headers, TERM_ALIASES.author),
    updatedAt: pickField(row, headers, TERM_ALIASES.updatedAt),
  };
}

function mapTermsConditionsRow(
  row: Record<string, string>,
  headers: string[],
): TermsConditionsDraftFields {
  return {
    useStatus: pickField(row, headers, TERMS_CONDITIONS_ALIASES.useStatus) as never,
    requiredStatus: pickField(row, headers, TERMS_CONDITIONS_ALIASES.requiredStatus) as never,
    deviceCategory: pickField(row, headers, TERMS_CONDITIONS_ALIASES.deviceCategory),
    termsName: pickField(row, headers, TERMS_CONDITIONS_ALIASES.termsName),
    fileName: pickField(row, headers, TERMS_CONDITIONS_ALIASES.fileName),
    manageCode: pickField(row, headers, TERMS_CONDITIONS_ALIASES.manageCode),
    revisionDate: pickField(row, headers, TERMS_CONDITIONS_ALIASES.revisionDate),
    author: pickField(row, headers, TERMS_CONDITIONS_ALIASES.author),
    updatedAt: pickField(row, headers, TERMS_CONDITIONS_ALIASES.updatedAt),
  };
}

export interface ParsedRow {
  rowIndex: number; // 1부터 시작하는, 사용자에게 보여줄 데이터 행 번호(헤더 제외)
  fields: Record<string, unknown>;
  errors: Record<string, string>;
}

export interface ParsedSheet {
  type: SheetEntityType;
  sheetName: string;
  rows: ParsedRow[];
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
  unrecognizedSheets: string[];
}

const TERMS_CONDITIONS_ENUM_VALUES: Record<string, string[]> = {
  useStatus: ["사용", "미사용"],
  requiredStatus: ["필수", "선택"],
};

function validateRow(
  type: SheetEntityType,
  fields: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const requiredFields: readonly string[] =
    type === "policy"
      ? POLICY_REQUIRED_FIELDS
      : type === "term"
        ? TERM_REQUIRED_FIELDS
        : TERMS_CONDITIONS_REQUIRED_FIELDS;

  for (const field of requiredFields) {
    const value = fields[field];
    const isEmpty = Array.isArray(value) ? value.length === 0 : isBlank(value);
    if (isEmpty) errors[field] = "필수 항목입니다";
  }

  if (type === "termsConditions") {
    for (const [field, allowed] of Object.entries(TERMS_CONDITIONS_ENUM_VALUES)) {
      const value = fields[field];
      if (!isBlank(value) && !allowed.includes(String(value))) {
        errors[field] = `${allowed.join(" 또는 ")} 중 하나여야 합니다`;
      }
    }
  }

  return errors;
}

/**
 * 엑셀(.xlsx) 워크북을 파싱해 시트명으로 '정책'/'용어'/'이용약관'을 자동 인식하고,
 * 각 시트의 컬럼을 고정 스키마 필드로 매핑한 뒤 필수값/형식을 검증한다.
 * 판단(AI)이 아니라 결정적 규칙(헤더 별칭 매칭)만 사용한다 — 파싱 검증 모달에서
 * 사용자가 직접 확인/수정하는 것이 최종 검수이기 때문이다.
 */
export function parsePolicyWorkbook(buffer: Buffer): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  if (workbook.SheetNames.length === 0) {
    throw new Error("엑셀 파일에서 시트를 찾을 수 없습니다.");
  }

  const sheets: ParsedSheet[] = [];
  const unrecognizedSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) continue;

    const type = detectSheetType(sheetName);
    if (!type) {
      unrecognizedSheets.push(sheetName);
      continue;
    }

    const { headers, rows } = sheetToRows(sheet);
    if (rows.length === 0) continue;

    const parsedRows: ParsedRow[] = rows.map((row, index) => {
      const fields =
        type === "policy"
          ? mapPolicyRow(row, headers)
          : type === "term"
            ? mapTermRow(row, headers)
            : mapTermsConditionsRow(row, headers);
      return {
        rowIndex: index + 1,
        fields,
        errors: validateRow(type, fields),
      };
    });

    sheets.push({ type, sheetName, rows: parsedRows });
  }

  return { sheets, unrecognizedSheets };
}

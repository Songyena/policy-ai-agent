import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { policyStore } from "../db/policyStore";
import { termStore } from "../db/termStore";
import { termsConditionsStore } from "../db/termsConditionsStore";
import { POLICY_FIELD_LABELS, POLICY_REQUIRED_FIELDS, type PolicyDraftFields } from "../types/policy";
import { TERM_FIELD_LABELS, TERM_REQUIRED_FIELDS, type TermDraftFields } from "../types/term";
import {
  TERMS_CONDITIONS_FIELD_LABELS,
  TERMS_CONDITIONS_REQUIRED_FIELDS,
  type TermsConditionsDraftFields,
} from "../types/termsConditions";

export type ToolDefinition = ChatCompletionTool;

/** 대화형 폼 채우기의 "초안 검증" 결과. status만 확정 여부를 나타내고, 실제 DB 적재는
 * 사용자가 확인 카드에서 "등록"을 눌러야 별도 API(/api/registry/confirm)로 이뤄진다. */
export interface DraftResult<TFields> {
  status: "incomplete" | "ready";
  missingFields: string[]; // 누락된 필드의 한국어 라벨
  fields: TFields;
}

function draftPolicy(fields: PolicyDraftFields): DraftResult<PolicyDraftFields> {
  const missing = POLICY_REQUIRED_FIELDS.filter((key) => !fields[key]?.trim());
  return {
    status: missing.length === 0 ? "ready" : "incomplete",
    missingFields: missing.map((key) => POLICY_FIELD_LABELS[key]),
    fields,
  };
}

function draftTerm(fields: TermDraftFields): DraftResult<TermDraftFields> {
  const missing = TERM_REQUIRED_FIELDS.filter((key) => {
    const value = fields[key];
    return Array.isArray(value) ? value.length === 0 : !value?.trim();
  });
  return {
    status: missing.length === 0 ? "ready" : "incomplete",
    missingFields: missing.map((key) => TERM_FIELD_LABELS[key]),
    fields,
  };
}

function draftTermsConditions(
  fields: TermsConditionsDraftFields,
): DraftResult<TermsConditionsDraftFields> {
  const missing = TERMS_CONDITIONS_REQUIRED_FIELDS.filter((key) => !fields[key]?.trim());
  return {
    status: missing.length === 0 ? "ready" : "incomplete",
    missingFields: missing.map((key) => TERMS_CONDITIONS_FIELD_LABELS[key]),
    fields,
  };
}

function searchKnowledge(query: string, type?: "policy" | "term" | "termsConditions" | "all") {
  const limit = 8;
  const result: Record<string, unknown[]> = {};
  if (!type || type === "all" || type === "policy") {
    result.policies = policyStore.search(query).slice(0, limit);
  }
  if (!type || type === "all" || type === "term") {
    result.terms = termStore.search(query).slice(0, limit);
  }
  if (!type || type === "all" || type === "termsConditions") {
    result.termsConditions = termsConditionsStore.search(query).slice(0, limit);
  }
  return result;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "정책/용어/이용약관 지식창고에서 키워드로 관련 항목을 검색한다. 조회/질문에 답하기 전에 반드시 호출해서 근거를 확보한다.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "검색 키워드 (사용자 질문에서 핵심 단어를 추출)" },
          type: {
            type: "string",
            enum: ["policy", "term", "termsConditions", "all"],
            description: "검색 대상 범위. 모르면 all.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_policy",
      description:
        "정책 등록 대화 중 지금까지 파악한 필드로 초안을 검증한다. 사용자가 정책 관련 정보를 말할 때마다 이미 알고 있는 값까지 모두 포함해서 호출한다. 결과의 missingFields를 보고 그 항목만 사용자에게 물어본다.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "구분 (예: 채번규칙, 결제정책, 시스템연동)" },
          policyName: { type: "string", description: "정책명" },
          subItem: { type: "string", description: "세부항목 (예: 신용평가등급확인서, AI경영진단)" },
          ruleDesc: { type: "string", description: "설명1: 규칙/포맷 공식" },
          detailDesc: { type: "string", description: "설명2: 상세 설명" },
          example: { type: "string", description: "예시 (예: CV2411120001)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_term",
      description:
        "용어(표준 용어/유사어) 등록 대화 중 지금까지 파악한 필드로 초안을 검증한다. 사용자가 용어 관련 정보를 말할 때마다 이미 알고 있는 값까지 모두 포함해서 호출한다.",
      parameters: {
        type: "object",
        properties: {
          standardTerm: { type: "string", description: "표준 용어" },
          synonyms: {
            type: "array",
            items: { type: "string" },
            description: "유사어/혼용어 목록",
          },
          uiMenu: { type: "string", description: "이 용어가 노출되는 화면/메뉴 위치" },
          definition: { type: "string", description: "용어 정의" },
          note: { type: "string", description: "비고" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_terms_conditions",
      description:
        "이용약관 항목 등록 대화 중 지금까지 파악한 필드로 초안을 검증한다. 사용자가 약관 관련 정보를 말할 때마다 이미 알고 있는 값까지 모두 포함해서 호출한다.",
      parameters: {
        type: "object",
        properties: {
          useStatus: { type: "string", enum: ["사용", "미사용"], description: "사용여부" },
          requiredStatus: { type: "string", enum: ["필수", "선택"], description: "필수여부" },
          deviceCategory: { type: "string", description: "기기구분 (공통/iOS/Android/Web 등)" },
          termsName: { type: "string", description: "약관명" },
          fileName: { type: "string", description: "파일명" },
          manageCode: { type: "string", description: "관리코드" },
          revisionDate: { type: "string", description: "개정일자" },
        },
      },
    },
  },
];

export function executeTool(
  name: string,
  args: Record<string, unknown>,
): { output: unknown; card?: { type: "policy" | "term" | "termsConditions"; fields: Record<string, unknown> } } {
  switch (name) {
    case "search_knowledge":
      return { output: searchKnowledge(String(args.query ?? ""), args.type as never) };
    case "draft_policy": {
      const result = draftPolicy(args as PolicyDraftFields);
      return {
        output: result,
        card: result.status === "ready" ? { type: "policy", fields: result.fields } : undefined,
      };
    }
    case "draft_term": {
      const result = draftTerm(args as TermDraftFields);
      return {
        output: result,
        card: result.status === "ready" ? { type: "term", fields: result.fields } : undefined,
      };
    }
    case "draft_terms_conditions": {
      const result = draftTermsConditions(args as TermsConditionsDraftFields);
      return {
        output: result,
        card: result.status === "ready" ? { type: "termsConditions", fields: result.fields } : undefined,
      };
    }
    default:
      throw new Error(`알 수 없는 tool입니다: ${name}`);
  }
}

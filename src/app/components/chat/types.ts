export type EntityType = "policy" | "term" | "termsConditions";

export interface ConfirmCardData {
  type: EntityType;
  fields: Record<string, unknown>;
}

export type CardStatus = "pending" | "confirmed" | "cancelled";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  card?: ConfirmCardData;
  cardStatus?: CardStatus;
}

/** 사이드바 "이전 대화" 목록에 쓰는 세션 요약(메시지 본문 제외). */
export interface SessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

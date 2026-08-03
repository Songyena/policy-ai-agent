/**
 * 대화 세션 레코드. recordStore의 다른 스토어(정책/용어/약관)와 달리 zod 스키마로 매 요청마다
 * 검증하지 않는다 — messages는 서버가 이미 신뢰하는 내부 대화 이력(OpenAI/Gemini 호환 메시지
 * 배열)을 그대로 옮겨 담는 것뿐이라, 굳이 엄격한 스키마를 강제할 이유가 없다.
 */
export interface ChatSessionFields extends Record<string, unknown> {
  /** create() 시점의 중복 판단 키로만 쓰는 내부 값 — 사용자에게 노출하지 않는다. */
  nonce: string;
  userId: string;
  title: string;
  messages: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
}

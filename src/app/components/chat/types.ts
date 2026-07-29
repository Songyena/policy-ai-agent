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

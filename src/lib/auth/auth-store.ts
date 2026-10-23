import type { FlowType } from "./flow";

/** Server-held interface; no caller-controlled database credentials or RPC names. */
export interface AuthFlowStore {
  ready(): Promise<boolean>;
  register(ticket: string, userId: string, type: FlowType): Promise<void>;
  redeem(ticket: string, userId: string, type: FlowType): Promise<boolean>;
  consumeRecoveryBudget(email: string): Promise<boolean>;
}

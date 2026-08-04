export type CartStatus =
  | "idle"
  | "abandoned"
  | "in_sequence"
  | "recovered"
  | "closed";

export type MessageChannel = "email" | "sms";

export type MessageStatus = "pending" | "sent" | "opened" | "clicked" | "failed";

export interface Store {
  id: string;
  domain: string;
  name: string;
  plan: "starter" | "pro" | "enterprise";
  createdAt: string;
}

export interface Cart {
  id: string;
  storeId: string;
  externalId: string;
  customerEmail: string;
  customerName: string;
  totalPrice: number;
  lineItems: LineItem[];
  status: CartStatus;
  abandonedAt: string | null;
  recoveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  productId: string;
  title: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

export interface Sequence {
  id: string;
  storeId: string;
  name: string;
  isActive: boolean;
  steps: SequenceStep[];
  createdAt: string;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  position: number;
  delayMinutes: number;
  channel: MessageChannel;
  subject?: string;
  body: string;
  variants?: StepVariant[];
}

export interface StepVariant {
  id: string;
  subject?: string;
  body: string;
  weight: number;
  sentCount: number;
  recoveredCount: number;
}

export interface Message {
  id: string;
  cartId: string;
  stepId: string;
  channel: MessageChannel;
  status: MessageStatus;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
}

export interface AnalyticsSummary {
  period: { from: string; to: string };
  cartsAbandoned: number;
  cartsRecovered: number;
  recoveryRate: number;
  revenueRecovered: number;
  emailsSent: number;
  emailOpenRate: number;
  emailClickRate: number;
  dailyBreakdown: DailyBreakdown[];
}

export interface DailyBreakdown {
  date: string;
  cartsAbandoned: number;
  cartsRecovered: number;
  revenueRecovered: number;
}

export type GroupRole = 'admin' | 'member';
export type MemberStatus = 'active' | 'pending' | 'vouched';
export type SessionStatus = 'planned' | 'live' | 'ended';
export type RsvpResponse = 'going' | 'maybe' | 'cant';
export type SplitType = 'equal' | 'custom';
export type PaymentStatus = 'pending' | 'confirmed' | 'disputed';
export type TransportType = 'walk' | 'ride' | 'drive' | 'designated_driver' | 'taxi' | 'buddy';

export interface Profile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
  vouches_required: 1 | 2;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  status: MemberStatus;
  joined_at: string;
  profile?: Profile;
}

export interface Vouch {
  id: string;
  group_id: string;
  voucher_id: string;
  candidate_id: string;
  created_at: string;
  voucher_profile?: Profile;
}

export interface DirectionTag {
  id: string;
  group_id: string;
  tag: string;
  sort_order: number;
}

export interface Spot {
  id: string;
  group_id: string;
  name: string;
  lat: number;
  lng: number;
  price_range: string | null;
  closing_time: string | null;
  notes: string | null;
  verified: boolean;
  created_by: string;
  created_at: string;
}

export interface Session {
  id: string;
  group_id: string;
  spot_id: string | null;
  title: string;
  session_date: string;
  session_time: string;
  status: SessionStatus;
  designated_driver: string | null;
  uwian_deadline: string | null;
  created_by: string;
  created_at: string;
  spot?: Spot | null;
}

export interface Rsvp {
  id: string;
  session_id: string;
  user_id: string;
  response: RsvpResponse;
  updated_at: string;
  profile?: Profile;
}

export interface Expense {
  id: string;
  session_id: string;
  description: string;
  amount_centavos: number;
  paid_by: string;
  is_alcohol: boolean;
  split_type: SplitType;
  created_at: string;
  paid_by_profile?: Profile;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  profile?: Profile;
}

export interface Payment {
  id: string;
  group_id: string;
  payer_id: string;
  receiver_id: string;
  amount_centavos: number;
  status: PaymentStatus;
  dispute_note: string | null;
  session_id: string | null;
  created_at: string;
  payer_profile?: Profile;
  receiver_profile?: Profile;
}

export interface UwianCheckin {
  id: string;
  session_id: string;
  user_id: string;
  transport: TransportType | null;
  direction_tag: string | null;
  buddy_id: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  profile?: Profile;
  buddy_profile?: Profile;
}

export interface Hangganan {
  id: string;
  user_id: string;
  count: number;
  limit_max: number;
  updated_at: string;
}

export interface SettlementTransfer {
  from: string;
  to: string;
  amount_centavos: number;
}

export interface BalanceEntry {
  user_id: string;
  net_centavos: number;
}

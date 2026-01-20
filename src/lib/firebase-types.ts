// Firebase/Firestore tüübid

export type AppRole =
  | 'teacher'
  | 'safety_officer'
  | 'director'
  | 'worker'
  | 'facility_manager'
  | 'admin';

export type TicketStatus =
  | 'submitted'
  | 'in_progress'
  | 'resolved'
  | 'verified'
  | 'closed';

export interface User {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  school_id: string | null;
  role?: AppRole | null;
  created_at: Date;
  updated_at?: Date;
}

export interface School {
  id: string;
  name: string;
  code?: string | null;
  created_at: Date;
  updated_at?: Date | null;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  category_id: string;
  problem_type_id: string;
  location: string;
  location_key?: string | null;
  description?: string | null;
  status: TicketStatus;
  priority?: number | null;
  assigned_to?: string | null;
  is_safety_related?: boolean | null;
  images?: string[] | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date | null;
  resolved_by?: string | null;
  verified_at?: Date | null;
  closed_at?: Date | null;
  closed_by?: string | null;
  duplicate_of?: string | null;
  duplicate_reason?: string | null;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id?: string | null;
  content: string;
  images?: string[] | null;
  created_at: Date;
}

export interface Category {
  id: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  created_at: Date;
}

export interface ProblemType {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string | null;
  sort_order?: number | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  ticket_id: string;
  user_id?: string | null;
  action: string;
  old_status?: TicketStatus | null;
  new_status?: TicketStatus | null;
  details?: Record<string, unknown> | null;
  created_at: Date;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'android' | 'ios' | 'web';
  created_at: Date;
  updated_at: Date;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables?: string[] | null;
  category: string;
  enabled?: boolean | null;
  created_at?: Date;
  updated_at?: Date;
}

// Ticket koos seotud andmetega
export interface TicketWithRelations extends Ticket {
  category?: Category;
  problem_type?: ProblemType;
  assigned_user?: User;
  created_user?: User;
  comments?: TicketComment[];
}

// Custom claims tüüp
export interface CustomClaims {
  role?: AppRole;
  school_id?: string;
}

// Konstandid
export const APP_ROLES: AppRole[] = [
  'teacher',
  'safety_officer',
  'director',
  'worker',
  'facility_manager',
  'admin',
];

export const TICKET_STATUSES: TicketStatus[] = [
  'submitted',
  'in_progress',
  'resolved',
  'verified',
  'closed',
];

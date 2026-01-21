import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// استخدام معلومات المشروع من info.tsx
const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseAnonKey = publicAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export type User = {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  avatar_url?: string;
  linking_code?: string;
  created_at: string;
  updated_at: string;
};

export type Partnership = {
  id: string;
  user1_id: string;
  user2_id: string;
  relationship_start_date: string;
  is_active: boolean;
  created_at: string;
  locked_at: string;
};

export type DailyMood = {
  id: string;
  partnership_id: string;
  user_id: string;
  date: string;
  mood: 'happy' | 'good' | 'okay' | 'sad';
  note?: string;
  created_at: string;
};

export type Memory = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  title: string;
  description?: string;
  memory_date: string;
  location?: string;
  created_at: string;
  updated_at: string;
};

export type MemoryImage = {
  id: string;
  memory_id: string;
  image_url: string;
  caption?: string;
  order_index: number;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  location?: string;
  event_type: 'special' | 'meeting' | 'travel' | 'other';
  image_url?: string;
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type TravelDestination = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  destination_name: string;
  country?: string;
  status: 'traveled' | 'planned' | 'dream';
  travel_date?: string;
  notes?: string;
  image_url?: string;
  rating?: number;
  created_at: string;
  updated_at: string;
};

export type GameQuestion = {
  id: string;
  partnership_id?: string;
  question_text: string;
  question_type: 'question' | 'know-me' | 'choice';
  is_default: boolean;
  created_at: string;
};

export type GameAnswer = {
  id: string;
  question_id: string;
  partnership_id: string;
  user_id: string;
  answer_text: string;
  answered_at: string;
};

export type Promise = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  promise_text: string;
  is_active: boolean;
  created_at: string;
};

export type Rule = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  rule_text: string;
  is_active: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  task_text: string;
  is_completed: boolean;
  completed_by_user_id?: string;
  completed_at?: string;
  created_at: string;
};

export type Preference = {
  id: string;
  user_id: string;
  preference_text: string;
  preference_type: 'likes' | 'dislikes';
  created_at: string;
};

export type NotificationSettings = {
  id: string;
  user_id: string;
  daily_mood_time: string;
  mood_reminder_enabled: boolean;
  event_reminder_enabled: boolean;
  partner_mood_notify: boolean;
  created_at: string;
  updated_at: string;
};

export type Commitment = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  owner_user_id: string;
  title: string;
  description: string;
  target_count: number;
  current_count: number;
  period_type: 'daily' | 'weekly' | 'monthly';
  punishment: string;
  start_date: string;
  is_active: boolean;
  status: 'on-track' | 'at-risk' | 'failed' | 'completed';
  created_at: string;
  updated_at: string;
};

export type AdventureBucket = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  title: string;
  category: 'trip' | 'travel';
  location?: string;
  budget_level: 'low' | 'medium' | 'high';
  estimated_cost: number;
  image_url?: string;
  status: 'dream' | 'planned' | 'done';
  planned_at?: string;
  created_at: string;
  updated_at: string;
};

export type FinanceJar = {
  id: string;
  partnership_id: string;
  created_by_user_id: string;
  title: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  is_shared: boolean;
  icon?: string;
  color?: string;
  created_at: string;
  updated_at: string;
};
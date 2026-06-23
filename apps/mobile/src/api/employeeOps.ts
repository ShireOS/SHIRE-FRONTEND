import { apiPatch, apiPost, apiRequest } from './mobileApi';

export type EmployeeProfile = {
  waiter_id?: string;
  id?: string;
  name?: string;
  role?: string;
  restaurant_id?: string;
  restaurant_name?: string;
};

export type EmployeeShift = {
  id: string;
  waiter_id?: string;
  waiter_name?: string;
  waiter_role?: string;
  role?: string;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  location_name?: string;
  section_name?: string;
  notes?: string | null;
  is_locked?: boolean;
};

export type EmployeeWeekSchedule = {
  items?: EmployeeShift[];
};

export type EmployeeRequest = {
  id: string;
  waiter_name?: string;
  waiter_role?: string;
  request_type?: string;
  priority?: string;
  status?: string;
  title?: string;
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  current_suggested_weekly_hours?: number | null;
  structured_payload?: Record<string, unknown> | null;
};

export type AvailabilityEntry = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  availability_type: 'available' | 'unavailable' | 'preferred';
  effective_from?: string | null;
  effective_until?: string | null;
  notes?: string | null;
};

export type EarningsSummary = {
  estimated_wages?: number | null;
  wage_status?: string | null;
  shift_count?: number;
  hours?: number;
};

export type StaffContact = {
  id: string;
  name?: string;
  role?: string;
  email?: string | null;
  phone?: string | null;
  is_me?: boolean;
};

export type Conversation = {
  id: string;
  title?: string | null;
  conversation_type?: string;
  members?: StaffContact[];
  last_message_preview?: string | null;
};

export type ConversationMessage = {
  id: string;
  body: string;
  sender_name?: string | null;
  sender_waiter_id?: string | null;
  sender_user_id?: string | null;
  created_at?: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_at?: string;
};

export type ScheduleRun = {
  id?: string;
  run_status?: string;
  week_start_date?: string;
};

export type ManagerSchedule = {
  id: string;
  week_start_date: string;
  status?: string;
  items?: EmployeeShift[];
  run_coverage_gaps?: {
    role?: string;
    shift_date?: string;
    day_of_week?: number;
    start_time?: string;
    end_time?: string;
    diagnostic?: string;
    reason?: string;
    severity?: string;
  }[];
};

export function fetchEmployeeProfile() {
  return apiRequest<EmployeeProfile>('/employee/me', { auth: 'employee' });
}

export function fetchEmployeeWeekSchedule(weekStart: string, scope: 'mine' | 'all') {
  return apiRequest<EmployeeWeekSchedule>(
    `/employee/schedule/week?week_start=${encodeURIComponent(weekStart)}&scope=${scope}`,
    { auth: 'employee' },
  );
}

export function fetchEmployeeAvailability() {
  return apiRequest<AvailabilityEntry[]>('/employee/availability', { auth: 'employee' });
}

export function saveEmployeeAvailability(entries: AvailabilityEntry[]) {
  return apiRequest<AvailabilityEntry[]>('/employee/availability', {
    method: 'PUT',
    auth: 'employee',
    body: entries,
  });
}

export function fetchEmployeeRequests() {
  return apiRequest<EmployeeRequest[]>('/employee/requests', { auth: 'employee' });
}

export function createEmployeeRequest(body: Record<string, unknown>) {
  return apiRequest<EmployeeRequest>('/employee/requests', {
    method: 'POST',
    auth: 'employee',
    body,
  });
}

export function fetchEmployeeContacts() {
  return apiRequest<StaffContact[]>('/employee/contacts', { auth: 'employee' });
}

export function fetchEmployeeEarnings() {
  return apiRequest<EarningsSummary>('/employee/earnings/biweekly', { auth: 'employee' });
}

export function fetchEmployeeConversations() {
  return apiRequest<Conversation[]>('/employee/messages/conversations', { auth: 'employee' });
}

export function fetchEmployeeMessages(conversationId: string) {
  return apiRequest<ConversationMessage[]>(
    `/employee/messages/conversations/${conversationId}/messages`,
    { auth: 'employee' },
  );
}

export function sendEmployeeMessage(conversationId: string, body: string) {
  return apiRequest<ConversationMessage>(
    `/employee/messages/conversations/${conversationId}/messages`,
    { method: 'POST', auth: 'employee', body: { body } },
  );
}

export function fetchEmployeeAnnouncements() {
  return apiRequest<Announcement[]>('/employee/announcements', { auth: 'employee' });
}

export function fetchManagerSchedules(restaurantId: string, weekStart: string) {
  return apiRequest<ManagerSchedule[]>(
    `/restaurants/${restaurantId}/schedules?week_start=${encodeURIComponent(weekStart)}&limit=5`,
  );
}

export function runManagerScheduler(restaurantId: string, weekStart: string) {
  return apiPost<ScheduleRun>(
    `/restaurants/${restaurantId}/schedules/run?run_engine=true&force_regenerate=true`,
    { week_start_date: weekStart },
  );
}

export function fetchManagerRequests(restaurantId: string) {
  return apiRequest<EmployeeRequest[]>(`/restaurants/${restaurantId}/employee-requests?status=all`);
}

export function reviewManagerRequest(requestId: string, status: 'approved' | 'denied') {
  return apiPatch<EmployeeRequest>(`/employee-requests/${requestId}`, { status });
}

export function fetchManagerConversations(restaurantId: string) {
  return apiRequest<Conversation[]>(`/restaurants/${restaurantId}/messages/conversations`);
}

export function fetchManagerAnnouncements(restaurantId: string) {
  return apiRequest<Announcement[]>(`/restaurants/${restaurantId}/announcements`);
}

export function createManagerAnnouncement(restaurantId: string, title: string, body: string) {
  return apiPost<Announcement>(`/restaurants/${restaurantId}/announcements`, {
    title,
    body,
    audience: 'all',
  });
}

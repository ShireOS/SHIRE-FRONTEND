import { reservationsApiRequest } from './mobileApi';

export type GuestFeedbackStatus = 'open' | 'reviewed' | 'resolved';

export type GuestFeedback = {
  id: string;
  restaurantId: string;
  guestName: string | null;
  guestPhone: string | null;
  category: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  details: string | null;
  status: GuestFeedbackStatus;
  source: string;
  createdAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
};

type GuestFeedbackResponse = {
  feedback: GuestFeedback[];
};

export async function fetchGuestFeedback(restaurantId: string, status = 'open') {
  const params = new URLSearchParams({ status });
  const response = await reservationsApiRequest<GuestFeedbackResponse>(
    `/locations/${restaurantId}/guest-feedback?${params.toString()}`,
  );
  return response.feedback;
}

export async function updateGuestFeedbackStatus(
  restaurantId: string,
  feedbackId: string,
  status: GuestFeedbackStatus,
) {
  return reservationsApiRequest<GuestFeedback>(`/locations/${restaurantId}/guest-feedback/${feedbackId}`, {
    method: 'PATCH',
    body: { status },
  });
}

import { apiRequest } from './mobileApi';

export type UiThemeRow = {
  restaurant_id: string;
  service: 'pos' | 'host';
  tokens: Record<string, string>;
  version: number;
};

export type UiThemeResponse = {
  themes: UiThemeRow[];
  color_history: { color: string; use_count: number; last_used_at: string }[];
  can_propagate: boolean;
};

export function fetchUiThemes(restaurantIds: string[]) {
  const query = restaurantIds.map((id) => `restaurant_ids=${encodeURIComponent(id)}`).join('&');
  return apiRequest<UiThemeResponse>(`/reseller/ui-themes?${query}`);
}

export function applyUiTheme(
  service: 'pos' | 'host',
  restaurantIds: string[],
  tokens: Record<string, string>,
) {
  return apiRequest<{ updated_restaurant_count: number }>('/reseller/ui-themes', {
    method: 'PUT',
    body: { service, restaurant_ids: restaurantIds, tokens },
  });
}

export function deleteUiThemeHistoryColor(color: string) {
  return apiRequest<void>(`/reseller/ui-themes/color-history/${encodeURIComponent(color)}`, {
    method: 'DELETE',
  });
}

import 'dotenv/config'
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'path'
import type { ExpoConfig, ConfigContext } from 'expo/config'

loadDotenv({ path: resolve(__dirname, '../../.env') })

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    apiBaseUrl: process.env.API_BASE_URL,
    reservationsApiBaseUrl: process.env.RESERVATIONS_API_BASE_URL,
    posApiBaseUrl: process.env.POS_API_BASE_URL || 'https://shire-pos-api-production.up.railway.app/api/v1/dev-v2',
  },
  plugins: [
    'expo-web-browser',
    'expo-notifications',
  ]
})

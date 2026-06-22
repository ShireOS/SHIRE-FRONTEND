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
  },
  plugins: [
    "expo-web-browser"
  ]
})

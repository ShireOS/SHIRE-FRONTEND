import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { login } from '../packages/supabase'

const EYEBROW_TRACKING = 0.06 * 10
const BRAND_EYEBROW_TRACKING = 0.06 * 12
const INK_500 = '#757170'
const STONE_200 = '#E4E2E2'
const SKY_600 = '#6F86FF'
const SKY_700 = '#156CC2'

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const result = await login(email.trim(), password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (result.role === 'owner' || result.role === 'developer') {
      router.replace('/(admin)/scans')
    } else if (result.role === 'employee') {
      router.replace('/(employee)/scans')
    } else {
      setError('No role assigned to this account. Contact your administrator.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-12">
            <Text
              className="font-mono text-ink-500"
              style={{ fontSize: 12, letterSpacing: BRAND_EYEBROW_TRACKING, textTransform: 'uppercase' }}
            >
              Shire
            </Text>
            <Text
              className="text-ink-900 mt-3"
              style={{ fontSize: 32, fontWeight: '600', letterSpacing: -0.015 * 32, lineHeight: 32 * 1.1 }}
            >
              Welcome back
            </Text>
            <Text
              className="text-ink-500 mt-2"
              style={{ fontSize: 16, lineHeight: 16 * 1.5 }}
            >
              Sign in to your admin account
            </Text>
          </View>

          <View className="mb-5">
            <Text
              className="font-mono text-ink-500 mb-2"
              style={{ fontSize: 10, letterSpacing: EYEBROW_TRACKING, textTransform: 'uppercase' }}
            >
              Email
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@restaurant.com"
              placeholderTextColor={INK_500}
              editable={!submitting}
              accessibilityLabel="Email"
              className="bg-cream-100 text-ink-900"
              style={{
                height: 52,
                paddingHorizontal: 16,
                fontSize: 16,
                borderRadius: 12,
                borderWidth: emailFocused ? 1.5 : 1,
                borderColor: emailFocused ? SKY_600 : STONE_200,
              }}
            />
          </View>

          <View className="mb-6">
            <Text
              className="font-mono text-ink-500 mb-2"
              style={{ fontSize: 10, letterSpacing: EYEBROW_TRACKING, textTransform: 'uppercase' }}
            >
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={INK_500}
              editable={!submitting}
              accessibilityLabel="Password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              className="bg-cream-100 text-ink-900"
              style={{
                height: 52,
                paddingHorizontal: 16,
                fontSize: 16,
                borderRadius: 12,
                borderWidth: passwordFocused ? 1.5 : 1,
                borderColor: passwordFocused ? SKY_600 : STONE_200,
              }}
            />
          </View>

          {error && (
            <View
              accessibilityLiveRegion="polite"
              className="mb-4"
              style={{
                backgroundColor: 'rgba(201, 80, 46, 0.08)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                className="text-danger-600"
                style={{ fontSize: 13, fontWeight: '500', lineHeight: 13 * 1.4 }}
              >
                {error}
              </Text>
            </View>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            style={({ pressed }) => ({
              backgroundColor: SKY_700,
              borderRadius: 9999,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !canSubmit ? 0.5 : 1,
              transform: [{ scale: pressed && canSubmit ? 0.98 : 1 }],
              shadowColor: '#3C78BE',
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            })}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                className="text-white"
                style={{ fontSize: 16, fontWeight: '500' }}
              >
                Log in
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

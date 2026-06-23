import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { getStoredUserRole, login, type userRole } from '../packages/supabase'
import { DottedSkyBackground } from '@/components/DottedSkyBackground'
import { color_pallet } from '@/styles/colors'

const EYEBROW_TRACKING = 0.06 * 10
const BRAND_EYEBROW_TRACKING = 0.06 * 12

function routeForRole(role: userRole) {
  if (role === 'owner' || role === 'developer') return '/(admin)/overview'
  if (role === 'employee') return '/(employee)/scans'
  return null
}

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  useEffect(() => {
    let active = true

    getStoredUserRole()
      .then((role) => {
        const route = routeForRole(role)
        if (active && route) router.replace(route)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [router])

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
    const route = routeForRole(result.role)
    if (route) {
      router.replace(route)
    } else {
      setError('No role assigned to this account. Contact your administrator.')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <DottedSkyBackground opacity={0.8} glow={false}/>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View
          style={{ flex: 1, flexDirection: "column", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 10}}
        >
          <View className="items-center mb-6">
            <Text
              className="font-mono text-ink-500"
              style={{ fontSize: 12, letterSpacing: BRAND_EYEBROW_TRACKING, textTransform: 'uppercase' }}
            >
              Shire
            </Text>
            <Text
              className="text-ink-900 mt-3"
              style={{ fontSize: 32, fontWeight: '800', letterSpacing: 0, lineHeight: 32 }}
            >
              Welcome back
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
              placeholderTextColor={color_pallet.ink[500]}
              editable={!submitting}
              accessibilityLabel="Email"
              className="bg-cream-100 text-ink-900"
              style={{
                height: 52,
                paddingHorizontal: 16,
                fontSize: 16,
                borderRadius: 12,
                borderWidth: emailFocused ? 1.5 : 1,
                borderColor: emailFocused ? color_pallet.sky[600] : color_pallet.stone[200],
              }}
            />
          </View>

          <View>
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
              placeholderTextColor={color_pallet.ink[500]}
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
                borderColor: passwordFocused ? color_pallet.sky[600] : color_pallet.stone[200],
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
          <View style={{flex: 1}}></View>
          <Pressable
            onPress={onSubmit}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            style={{
              backgroundColor: !canSubmit ? color_pallet.sky[400] : color_pallet.sky[700],
              borderRadius: 10,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: color_pallet.sky[700],
              shadowOpacity: 0.2,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 3,
            }}
          >
            {({ pressed }) => (
              <View
                style={{
                  transform: [{ scale: pressed && canSubmit ? 0.98 : 1 }],
                }}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '500' }}>
                    Log in
                  </Text>
                )}
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.replace('/signup')}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            style={{
              marginTop: 16,
              alignSelf: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Text style={{ fontSize: 14, color: color_pallet.ink[500] }}>
              Don&apos;t have an account?{' '}
              <Text style={{ color: color_pallet.sky[700], fontWeight: '500' }}>Sign up</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

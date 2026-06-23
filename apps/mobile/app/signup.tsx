import { useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { signUp, uploadUserPfp } from '../packages/supabase'
import { DottedSkyBackground } from '@/components/DottedSkyBackground'
import { color_pallet } from '@/styles/colors'

const MAX_PFP_KB = 200
const AVATAR_SIZE = 120

const EYEBROW_TRACKING = 0.06 * 10
const BRAND_EYEBROW_TRACKING = 0.06 * 12

const GREETINGS = ['Welcome in', 'Right this way', 'Pull up a chair'] as const
const GREETING_INTERVAL_MS = 2500
const GREETING_FADE_MS = 350
const HEADLINE_HEIGHT = 40

function CyclingGreeting() {
  const [index, setIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)
  const reduceMotionRef = useRef(false)
  const mountedRef = useRef(true)
  const opacity = useSharedValue(1)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (cancelled) return
      reduceMotionRef.current = enabled
      setReduceMotion(enabled)
    })
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        reduceMotionRef.current = enabled
        setReduceMotion(enabled)
      },
    )
    return () => {
      cancelled = true
      mountedRef.current = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    const advance = () => {
      if (!mountedRef.current) return
      setIndex((i) => (i + 1) % GREETINGS.length)
    }
    const interval = setInterval(() => {
      if (!mountedRef.current) return
      if (reduceMotionRef.current) {
        advance()
        return
      }
      opacity.value = withTiming(
        0,
        { duration: GREETING_FADE_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          'worklet'
          if (!finished) return
          runOnJS(advance)()
          opacity.value = withTiming(1, {
            duration: GREETING_FADE_MS,
            easing: Easing.out(Easing.cubic),
          })
        },
      )
    }, GREETING_INTERVAL_MS)
    return () => {
      clearInterval(interval)
    }
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : opacity.value,
  }))

  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={GREETINGS[index]}
      style={{
        height: HEADLINE_HEIGHT,
        alignSelf: 'stretch',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <Animated.Text
        className="text-ink-900"
        style={[
          {
            fontSize: 32,
            fontWeight: '800',
            letterSpacing: 0,
            lineHeight: 32,
            textAlign: 'center',
          },
          animatedStyle,
        ]}
      >
        {GREETINGS[index]}
      </Animated.Text>
    </View>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pfpBase64, setPfpBase64] = useState<string | null>(null)
  const [pickerLoading, setPickerLoading] = useState(false)

  const passwordsMatch = password.length > 0 && password === confirmPassword
  const canSubmit =
    email.trim().length > 0 && password.length >= 6 && passwordsMatch && !submitting

  async function pickPfp() {
    setError(null)
    try {
      setPickerLoading(true)
      const ImagePicker = await import('expo-image-picker')
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        setError('Photo library permission is required to add a profile photo.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      })
      if (result.canceled || !result.assets?.[0]?.base64) return
      const base64 = result.assets[0].base64
      const approxKB = (base64.length * 0.75) / 1024
      if (approxKB > MAX_PFP_KB) {
        setError(`Photo is too large (${Math.round(approxKB)} KB). Pick something under ${MAX_PFP_KB} KB.`)
        return
      }
      setPfpBase64(base64)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(
        message.includes('ExponentImagePicker')
          ? 'This dev build does not include photo picking yet. Continue without a profile photo.'
          : message,
      )
    } finally {
      setPickerLoading(false)
    }
  }

  async function onSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    const result = await signUp(email.trim(), password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (pfpBase64) {
      const upload = await uploadUserPfp(pfpBase64)
      if (!upload.ok) {
        setError(`Account created but profile photo failed to upload: ${upload.error}`)
      }
    }
    if (result.needsConfirmation) {
      setInfo('Account created. Check your email to confirm before signing in.')
    } else {
      router.replace('/')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <DottedSkyBackground opacity={0.8} glow={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View style={{ flex: 1, flexDirection: "column", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 10}}>
          <View className="items-center mb-6">
            <Text
              className="font-mono text-ink-500"
              style={{ fontSize: 12, letterSpacing: BRAND_EYEBROW_TRACKING, textTransform: 'uppercase' }}
            >
              Shire
            </Text>
            <View className="mt-3" style={{ alignSelf: 'stretch' }}>
              <CyclingGreeting />
            </View>
          </View>

          <View className="items-center mb-6">
            <Pressable
              onPress={pickPfp}
              disabled={pickerLoading || submitting}
              accessibilityRole="button"
              accessibilityLabel={pfpBase64 ? 'Change profile photo' : 'Add profile photo'}
              hitSlop={8}
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pfpBase64 ? 'transparent' : color_pallet.cream[200],
                borderWidth: pfpBase64 ? 2 : 1.5,
                borderColor: pfpBase64 ? color_pallet.ink[600] : color_pallet.stone[200],
                borderStyle: pfpBase64 ? 'solid' : 'dashed',
                overflow: 'hidden',
                shadowColor: color_pallet.sky[700],
                shadowOpacity: pfpBase64 ? 0.15 : 0,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: pfpBase64 ? 3 : 0,
              }}
            >
              {pickerLoading ? (
                <Text style={{ color: color_pallet.sky[700], fontSize: 13, fontWeight: '600' }}>
                  Loading...
                </Text>
              ) : pfpBase64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${pfpBase64}` }}
                  style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="camera-outline" size={28} color={color_pallet.ink[500]} />
              )}
            </Pressable>
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

          <View className="mb-5">
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
              autoComplete="new-password"
              textContentType="newPassword"
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={color_pallet.ink[500]}
              editable={!submitting}
              accessibilityLabel="Password"
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

          <View className="mb-6">
            <Text
              className="font-mono text-ink-500 mb-2"
              style={{ fontSize: 10, letterSpacing: EYEBROW_TRACKING, textTransform: 'uppercase' }}
            >
              Confirm password
            </Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              secureTextEntry
              placeholder="Re-enter your password"
              placeholderTextColor={color_pallet.ink[500]}
              editable={!submitting}
              accessibilityLabel="Confirm password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              className="bg-cream-100 text-ink-900"
              style={{
                height: 52,
                paddingHorizontal: 16,
                fontSize: 16,
                borderRadius: 12,
                borderWidth: confirmFocused ? 1.5 : 1,
                borderColor: confirmFocused
                  ? color_pallet.sky[600]
                  : confirmPassword.length > 0 && !passwordsMatch
                  ? color_pallet.danger[600]
                  : color_pallet.stone[200],
              }}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text
                className="text-danger-600 mt-2"
                style={{ fontSize: 12, fontWeight: '500' }}
              >
                Passwords don’t match.
              </Text>
            )}
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

          {info && (
            <View
              accessibilityLiveRegion="polite"
              className="mb-4"
              style={{
                backgroundColor: 'rgba(21, 108, 194, 0.08)',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text
                style={{ fontSize: 13, fontWeight: '500', lineHeight: 13 * 1.4, color: color_pallet.sky[700] }}
              >
                {info}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={onSubmit}
            accessibilityRole="button"
            accessibilityLabel="Create account"
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
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '500' }}>
                  {submitting ? 'Creating account...' : 'Create account'}
                </Text>
              </View>
            )}
          </Pressable>

         <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            style={{
              marginTop: 16,
              alignSelf: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Text style={{ fontSize: 14, color: color_pallet.ink[500] }}>
              Already have an account?{' '}
              <Text style={{ color: color_pallet.sky[700], fontWeight: '500' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

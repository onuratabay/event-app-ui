import type { Href } from 'expo-router'
import { usePathname, useRootNavigationState, useRouter } from 'expo-router'
import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import LoadingSpinner from '../components/LoadingSpinner'
import { palette } from '../theme/palette'
import { useGuest } from './GuestSession'
import { isGuestRoute } from './links'

export default function GuestRouteBoundary({ children }: { children: ReactNode }) {
  const { ready, guest } = useGuest()
  const pathname = usePathname()
  const router = useRouter()
  const navigation = useRootNavigationState()
  const blocked = !ready || !!guest && !isGuestRoute(pathname)
  useEffect(() => {
    if (ready && guest && !isGuestRoute(pathname) && navigation?.key) {
      if (router.canDismiss()) router.dismissAll()
      router.replace({ pathname: '/guest-event', params: { code: guest.code } } as Href)
    }
  }, [ready, guest?.code, pathname, navigation?.key])
  return <View style={{ flex: 1 }}>
    <View pointerEvents={blocked ? 'none' : 'auto'} accessibilityElementsHidden={blocked} importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'} style={{ flex: 1, opacity: blocked ? 0 : 1 }}>{children}</View>
    {blocked && <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' }]}><LoadingSpinner size="large" /></View>}
  </View>
}

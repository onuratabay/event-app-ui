// Extends app.json; signing/domain values and the Maps key come from the build environment.
const fs = require('fs')
module.exports = ({ config }) => {
  const host = process.env.EXPO_PUBLIC_SHARE_HOST || 'ewent.app'
  if (!/^[a-z0-9.-]+$/i.test(host) || host.includes('..')) throw new Error('EXPO_PUBLIC_SHARE_HOST must be a hostname')
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
  // Android push needs Firebase (FCM): an EAS file variable GOOGLE_SERVICES_JSON, or a local google-services.json.
  // AdMob app IDs (ca-app-pub-…~…); Google's sample IDs until the real ones are set in the build environment.
  const admob = {
    androidAppId: process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713',
    iosAppId: process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511',
  }
  const trackingText = 'Sana daha ilgili reklamlar göstermek için izin istiyoruz. İzin vermezsen reklamlar yine görünür, yalnızca kişiselleştirilmez.'
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined)
  return {
    ...config,
    plugins: [...(config.plugins || []),
      ['react-native-google-mobile-ads', { ...admob, userTrackingUsageDescription: trackingText }],
      ['expo-tracking-transparency', { userTrackingPermission: trackingText }],
      ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey, iosGoogleMapsApiKey: mapsKey }]] : [])],
    extra: { ...config.extra, googleMapsConfigured: !!mapsKey },
    ios: { ...config.ios, associatedDomains: [...new Set([...(config.ios?.associatedDomains || []), `applinks:${host}`])] },
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}), intentFilters: [...(config.android?.intentFilters || []), { action: 'VIEW', autoVerify: true, data: [{ scheme: 'https', host, pathPrefix: '/e/' }], category: ['BROWSABLE', 'DEFAULT'] }] },
  }
}

// Extends app.json; signing/domain values and the Maps key come from the build environment.
module.exports = ({ config }) => {
  const host = process.env.EXPO_PUBLIC_SHARE_HOST || 'ewent.app'
  if (!/^[a-z0-9.-]+$/i.test(host) || host.includes('..')) throw new Error('EXPO_PUBLIC_SHARE_HOST must be a hostname')
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
  return {
    ...config,
    plugins: [...(config.plugins || []), ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey, iosGoogleMapsApiKey: mapsKey }]] : [])],
    extra: { ...config.extra, googleMapsConfigured: !!mapsKey },
    ios: { ...config.ios, associatedDomains: [...new Set([...(config.ios?.associatedDomains || []), `applinks:${host}`])] },
    android: { ...config.android, intentFilters: [...(config.android?.intentFilters || []), { action: 'VIEW', autoVerify: true, data: [{ scheme: 'https', host, pathPrefix: '/e/' }], category: ['BROWSABLE', 'DEFAULT'] }] },
  }
}

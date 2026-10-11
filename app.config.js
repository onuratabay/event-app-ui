// Extends app.json. The Google Maps key comes from .env (git-ignored) or the build environment,
// never from source control. Without a key the app keeps today's behaviour (Apple Maps on iOS).
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key) return { ...config, extra: { ...config.extra, googleMapsConfigured: false } }
  return {
    ...config,
    plugins: [...(config.plugins || []), ["react-native-maps", { androidGoogleMapsApiKey: key, iosGoogleMapsApiKey: key }]],
    extra: { ...config.extra, googleMapsConfigured: true },
  }
}

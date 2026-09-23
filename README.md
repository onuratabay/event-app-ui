# Event App

Expo SDK 57, React Native 0.86 and TypeScript application for iOS and Android.

## Run

Use Node.js 22. Run `npm install`, then `npx expo start`. Open the QR code with Expo Go for SDK 57. The phone and computer should share a network. `npm run ios` and `npm run android` open an available simulator/emulator.

The application uses Expo Go-compatible native modules. A development build is not required for the implemented features. The custom `eventapp://` scheme is registered in an installed application build; Expo Go uses Expo development URLs. Shared event links load the event from the backend, subject to the viewer's access rights.

## API connection during development

Run the `vibe-us` backend on port 3000 with working MySQL credentials. In Expo Go on the same LAN, the app derives the backend host from Expo's development host, so changes to the computer's IP do not require code edits. Set `EXPO_PUBLIC_API_URL` to override this address for a remote API, a separate backend computer, or an Expo tunnel. Restart Expo after changing this environment variable. Published builds require an explicit API URL.

## Structure

- `app/`: 16 screen routes plus root layout and missing-route fallback.
- `src/screens/`: welcome, three onboarding steps, approval, interests, discovery, event details, rooms/chat, map, ten-step event creation, search, notifications and profile.
- `src/native/`: reusable native components, image picking, sharing, navigation and persisted state.
- `src/theme/styles.ts`: StyleSheet tokens preserving the original dark/gold palette and spacing.
- `assets/fonts/`: bundled Outfit and Fraunces fonts with OFL licenses.

`npm install` uses the committed dependency versions. `.npmrc` disables automatic peer installation because optional desktop/browser peers pulled in by Router are unnecessary for the two mobile targets. Required mobile modules are declared explicitly and validated against Expo's bundled compatibility map.

## Validation

- `npm run typecheck`
- `npx expo install --check`
- `npm test`: renders all 16 screen states against native host mocks; checks search, participation/cancellation, server-backed state, account isolation, every event-creation step and route coverage.
- `npm run export:native`: generates both iOS and Android Metro/Hermes bundles.

Host-mock tests and bundle export do not replace device testing. Camera permission prompts, keyboard/safe areas, gestures and visual fidelity still require verification in Expo Go on physical iOS/Android devices. This machine's Xcode license has not been accepted, so simulator verification was unavailable.

## Current data and behavior

Application data is owned by the Vibeus backend. Profile fields, photos, interests, favorites, participation, event creation, city/equipment/travel preferences and event chat use authenticated APIs and MySQL. StoreProvider is an in-memory view of server responses; it does not write domain data to AsyncStorage. Date/time inputs, open sheets and unfinished forms are transient UI state. Access/refresh tokens remain on the device to preserve login.

Event creation loads types/levels/visibility from API catalogs and requires an explicitly selected geocoding result. Selected photos are uploaded as data URIs; the app no longer copies them into its document directory. Messages are fetched on entering a room and using the explicit refresh button, with the latest 100 displayed. No periodic chat requests run in the background. Only the owner or confirmed participants can access chat. Push notifications are not implemented; mock notifications and mock reference people are no longer shown.

On authenticated startup, the old `event-app:v1` cache is migrated only if its user ID matches the server account. Its user/event/message records are archived server-side at `GET /users/me/legacy-data` so local-only prototype records are not silently lost or mistaken for real memberships. Map and recommendation preferences move to active server preferences before the old cache is removed. Another account's legacy cache is retained until that account logs in; failed transfers retain their source for retry. Sample `me` records are discarded. Legacy archives are historical records, not active events; old prototype events had no validated catalog IDs or coordinates.

The backend must run migration `1790000000000-ServerOwnedUserData` before using this app version. It adds user city/bio fields, event location names, user preference storage and shared chat messages. Offline/API failures display errors; the app never falls back to sample accounts or events.

EAS preview/production profiles are provided in `eas.json`. Set your own application identifiers in `app.json` before store distribution.

## Native event map

The map uses `react-native-maps`, included in Expo Go, with the platform default provider: Apple Maps on iOS and Google Maps on Android. No extra map key is needed in Expo Go. Standalone Android distribution requires Google Maps configuration; it is not covered by the Expo Go setup. No OpenStreetMap public tile server or paid tile API is configured.

Visible public/recommended events are fetched from authenticated `GET /events` in pages of 100 (maximum 2,000, with an explicit partial-data notice). Only valid coordinates are plotted; cancelled events are excluded. No sample coordinates are invented. Discovery excludes completed/cancelled events. Upcoming, Today, Tomorrow, Next Week and custom date ranges use the API's day/month/year dates. Next Week means the following Monday through Sunday. Category filters apply to every layer.

- Zoom below 11: Gaussian density rendered in native SVG, with a relative low-to-high legend.
- Zoom 11–15: Supercluster counts; tapping expands the cluster.
- Zoom 15 and above: category icons and event start-time labels; coincident events remain selectable as a group.
- Density and marker opacity crossfade between zoom 10.35 and 11. Rotation and pitch are disabled to align the screen-space Mercator density field.
- A selected event opens the existing detail screen using that event's API data. Native provider attribution stays visible above the bottom panel.

Tests cover mode thresholds, Gaussian overlap, cluster counts/leaves, invalid coordinates, dates, pagination, selection/navigation and network errors. Physical device rendering, gestures and map tiles still require Expo Go verification.

References: [Expo native maps](https://docs.expo.dev/versions/latest/sdk/map-view/), [Supercluster](https://github.com/mapbox/supercluster).

### Personal discovery filters

“Sana göre” opens a draft filter sheet: date range, availability hours, city/venue search, search radius and multiple event types. Apply saves preferences in the authenticated account; closing discards draft changes. Native geocoding searches a city, neighbourhood or named venue; users select a result before applying. Ankara, İzmir and İstanbul shortcuts work without geocoding. A venue search filters by coordinates and chosen radius, not a venue ID (events do not currently store venue IDs).

Foreground location is used only with permission; the Nearby button requests it when needed. Existing permission enables a current city suggestion on entry/foreground. Denial or lookup failure leaves manual place selection available. Today/Tomorrow labels update on foreground and once per minute. The current hour chooses an Evening or Tomorrow Morning suggestion.

Date, type and geographic bounding-box constraints are sent to `GET /events` before pagination. The client then applies the exact distance radius and availability window to every map layer. Known event duration must fit entirely inside availability; unknown duration checks start time. A window such as 22:00–02:00 continues into the following day for events starting on the selected date.

### Session and navigation

Startup reads persisted tokens before choosing a screen. Signed-in users open Discover directly; Welcome and Login also guard against showing an auth form to an existing session. API 401 responses trigger a shared refresh-token request and one retry. Offline failures do not clear local login state. Server-side revocation and refresh-token expiry still apply. Explicit logout clears tokens and account-specific local state, and an in-flight refresh cannot restore a logged-out session.

The bottom navigation uses Discover, Map, Create, Rooms and Profile. Search is next to Notifications in the Discover header. Map filter chips use opaque backgrounds, brighter text and a gold selected state.

### Personal recommendations

The sparkle button beside Search opens a preference and recommendations sheet. The device profile remembers equipment separately for Ankara/İzmir, preferred activities separately for Ankara/İzmir/Eymir/Çeşme, and the trip's explicit calendar dates. Existing profile interests prefill activity preferences. Eymir/Çeşme coordinates are resolved by native geocoding rather than invented venue locations.

Recommendations currently use deterministic matching of live API events to the selected dates, location, activities and city-specific equipment, with equipment matches ranked first, then distance. Completed/cancelled/full events are excluded. Results are capped at five, but all counts and explanations reflect actual matches. This does not call an external LLM or invent events. Preferences persist in the authenticated user's backend account.

Header actions use 20px icons, 1.8px strokes and 44px touch targets. Bottom navigation glyphs use 24px icons with the same stroke weight.

### Password recovery and back navigation

Login links to `/forgot-password`. The recovery screen requests a reset email, accepts the email token (or a link containing `token`), validates a new password and confirmation, and submits it to `/auth/reset-password`. Expired tokens, validation failures, connectivity failures and SMTP unavailability remain visible; successful email requests use a neutral account-existence message. Reset secrets are held only in screen state.

Actual email delivery requires the backend SMTP environment variables described in `vibe-us/docs/security-and-mail.md`; the current local backend has no SMTP configuration. Recovery tests mock the transport and do not send email.

A shared 44px back control is available throughout login, recovery, registration, application status, approval and interest selection. History-aware navigation returns to the actual preceding screen with a fallback for direct entry. The initial welcome/splash screens have no preceding step. Map, Profile and Rooms provide an explicit return to Discover; detail screens retain history-based back actions.

Map/recommendation queries request `includePhotos=false`, so MySQL never reads cover BLOBs for those calls. A query fetches at most 500 events; the map warns when filters need narrowing. Covers appear when opening full event detail. Traffic regression tests verify the image-free query, page budget and absence of chat polling.

### Gerçek zamanlı veri

Tek bağlantı `src/services/socket.ts` içindedir. Veri polling'i yoktur: sohbet, referans, katılımcı sayısı ve durum değişiklikleri küçük socket yamalarıyla işlenir. REST ilk yükleme/geçmiş/CRUD için korunur. Kişisel etkinlik listelerinin devamı Odalar ekranından yüklenir. Mesaj geçmişi 30 kayıtla başlar; eski mesajlar imleçle sayfalanır.

`[API REQUEST]` geliştirme logları method, endpoint, süre, yaklaşık JSON boyutu ve istek sayısını gösterir. Socket logları içerik veya token yazmaz. Uygulama arka planda bağlantıyı keser; yeniden bağlantıda yalnızca ilgili küçük özetler/açık oda eşitlenir. JWT yenilemesi ve WebSocket heartbeat'leri normal güvenlik/bağlantı trafiğidir.

Backend'deki `docs/realtime-traffic.md` olay sözleşmesini, ölçüm sınırlarını ve gereken `1790020000000-RealtimeEventActivity` migration'ını açıklar. Migration bu çalışma sırasında canlı DB'ye uygulanmadı. Yeni backend ile kullanmadan önce uygulanmalıdır. Mevcut backend/Expo servisleri kapalı bırakıldı.

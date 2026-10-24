# Ewent.app

Expo SDK 58, React Native 0.88 and TypeScript application for iOS and Android.

## Run

Use Node.js 22. Run `npm install`, then `npx expo start`. Open the QR code with Expo Go for SDK 58. The phone and computer should share a network. `npm run ios` and `npm run android` open an available simulator/emulator.

The application uses Expo Go-compatible native modules for screen and API development. An installed native build is required to verify the custom `eventapp://` scheme and HTTPS Universal/App Links; Expo Go uses Expo development URLs. Personal event invitations open a restricted native guest screen. Store, domain and device requirements are described in [Guest event sharing](../vibe-us/docs/guest-sharing.md).

## API connection

The backend and its MySQL database run only on the ewent.app server (`93.89.238.230`). The app always connects to `https://ewent.app` (`src/api/config.ts`), in Expo Go and in published builds alike; there is no local backend, LAN fallback or environment override.

## Structure

- `app/`: 16 screen routes plus root layout and missing-route fallback.
- `src/screens/`: welcome, three onboarding steps, approval, interests, discovery, event details, rooms/chat, map, eight-step event creation, search, notifications and profile.
- `src/native/`: reusable native components, image picking, sharing, navigation and persisted state.
- `src/theme/styles.ts`: StyleSheet tokens preserving the original dark/gold palette and spacing.
- `assets/fonts/`: bundled Outfit and Fraunces fonts with OFL licenses.

`npm install` uses the committed dependency versions. `.npmrc` disables automatic peer installation because optional desktop/browser peers pulled in by Router are unnecessary for the two mobile targets. Required mobile modules are declared explicitly and validated against Expo's bundled compatibility map.

## Releases

The app version (`app.json` → `expo.version`, shown in Settings and compared by the forced-update check) follows the backend's rules, from the Conventional Commits since the last `v*` tag: a feature (`feat`) bumps the middle number (1.0.4 → 1.1.0), anything else the last one (1.0.0 → 1.0.1). The first number moves only by hand: set `app.json`'s version to e.g. `2.0.0` for a big release. Before a store build run `npm run release` (writes the version, commits `chore(release): v<version>` and tags it), then `git push --follow-tags` and `eas build`. EAS still increments the build numbers itself.

## Validation

- `npm run typecheck`
- `npx expo install --check`
- `npm test`: renders all 16 screen states against native host mocks; checks search, participation/cancellation, server-backed state, account isolation, every event-creation step and route coverage.
- `npm run export:native`: generates both iOS and Android Metro/Hermes bundles.

Host-mock tests and bundle export do not replace device testing. Camera permission prompts, keyboard/safe areas, gestures and visual fidelity still require verification in Expo Go on physical iOS/Android devices. This machine's Xcode license has not been accepted, so simulator verification was unavailable.

## Current data and behavior

Application data is owned by the Vibeus backend. Profile fields, photos, interests, favorites, participation, event creation, city/equipment/travel preferences and event chat use authenticated APIs and MySQL. StoreProvider is an in-memory view of server responses; it does not write domain data to AsyncStorage. Date/time inputs, open sheets and unfinished forms are transient UI state. Access/refresh tokens remain on the device to preserve login.

Event creation loads types/levels/visibility from API catalogs and requires an explicitly selected geocoding result. Selected photos are uploaded as data URIs; the app no longer copies them into its document directory. Messages are fetched on entering a room and using the explicit refresh button, with the latest 100 displayed. No periodic chat requests run in the background. Only the owner or confirmed participants can access chat. Push notifications are not implemented; mock notifications and mock reference people are no longer shown.

On authenticated startup, the old `event-app:v1` cache is migrated only if its user ID matches the server account. Its user/event/message records are archived server-side at `GET /users/me/legacy-data` so local-only prototype records are not silently lost or mistaken for real memberships. Map preferences move to active server preferences before the old cache is removed. Another account's legacy cache is retained until that account logs in; failed transfers retain their source for retry. Sample `me` records are discarded. Legacy archives are historical records, not active events; old prototype events had no validated catalog IDs or coordinates.

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

Header actions use 20px icons, 1.8px strokes and 44px touch targets. Bottom navigation glyphs use 24px icons with the same stroke weight.

### Password recovery and back navigation

Login links to `/forgot-password`. The recovery screen requests a reset email, accepts the email token (or a link containing `token`), validates a new password and confirmation, and submits it to `/auth/reset-password`. Expired tokens, validation failures, connectivity failures and SMTP unavailability remain visible; successful email requests use a neutral account-existence message. Reset secrets are held only in screen state.

Actual email delivery requires the backend SMTP environment variables described in `vibe-us/docs/security-and-mail.md`; the current local backend has no SMTP configuration. Recovery tests mock the transport and do not send email.

A shared 44px back control is available throughout login, recovery, registration, application status, approval and interest selection. History-aware navigation returns to the actual preceding screen with a fallback for direct entry. The initial welcome/splash screens have no preceding step. Map, Profile and Rooms provide an explicit return to Discover; detail screens retain history-based back actions.

Map queries request `includePhotos=false`, so MySQL never reads cover BLOBs for those calls. A query fetches at most 500 events; the map warns when filters need narrowing. Covers appear when opening full event detail. Traffic regression tests verify the image-free query, page budget and absence of chat polling.

### Gerçek zamanlı veri

Tek bağlantı `src/services/socket.ts` içindedir. Veri polling'i yoktur: sohbet, referans, katılımcı sayısı ve durum değişiklikleri küçük socket yamalarıyla işlenir. REST ilk yükleme/geçmiş/CRUD için korunur. Kişisel etkinlik listelerinin devamı Odalar ekranından yüklenir. Mesaj geçmişi 30 kayıtla başlar; eski mesajlar imleçle sayfalanır.

`[API REQUEST]` geliştirme logları method, endpoint, süre, yaklaşık JSON boyutu ve istek sayısını gösterir. Socket logları içerik veya token yazmaz. Uygulama arka planda bağlantıyı keser; yeniden bağlantıda yalnızca ilgili küçük özetler/açık oda eşitlenir. JWT yenilemesi ve WebSocket heartbeat'leri normal güvenlik/bağlantı trafiğidir.

Backend'deki `docs/realtime-traffic.md` olay sözleşmesini, ölçüm sınırlarını ve gereken `1790020000000-RealtimeEventActivity` migration'ını açıklar. Migration bu çalışma sırasında canlı DB'ye uygulanmadı. Yeni backend ile kullanmadan önce uygulanmalıdır. Mevcut backend/Expo servisleri kapalı bırakıldı.

## Etkinlik paylaşımı ve misafir erişimi

Etkinlik detayındaki Paylaş paneli, misafir katılım sorumluluğu onayından sonra üyeye ait HTTPS davet bağlantısı oluşturur. Bağlantı WhatsApp ve diğer uygulamalarda paylaşılabilir veya kopyalanabilir. Onay sürümü/zamanı ve paylaşan üye sunucuda saklanır; panelde oluşturulan davet iptal edilebilir.

Misafirler yalnızca davet edildiği etkinliği görür, adını girerek katılır ve katılımını iptal edebilir. Üye tokenları ve Store/socket trafiği misafir akışından ayrıdır; önceki gerçek üyelik oturumu sunucuda doğrulanarak üyeliğe dönüş yapılabilir. Tarayıcı sayfası indirme/açma ekranıdır. Henüz mağaza URL'leri yoktur. Kurulumdan sonra otomatik etkinlik açılışı garanti edilmez; aynı bağlantıya yeniden dokunma veya **Davet kodum var** üzerinden kod/bağlantı girme yolu vardır.

Ortam değişkenleri, API sınırları, migration'lar, `/.well-known` doğrulama uçları ve production domain/release signing/gerçek cihaz kontrolleri [Misafir davetleri kurulum belgesinde](../vibe-us/docs/guest-sharing.md) açıklanır. Native build ve association uçlarının hazırlanması, domain veya mağaza dağıtımının tamamlandığı anlamına gelmez.

## Brand

The display name is `Ewent.app` (always capitalised in the UI); the website is https://ewent.app. Supplied original artwork is stored in `assets/brand/`. The transparent wordmark appears above the Welcome headline at 150 × 50 and centered in the Discover action row at 104 × 35. Discover actions run left to right: search, sorting/filters, wordmark, event calendar, notifications. Its blur fades below the action row without a divider. Splash retains its original orbit animation. The supplied square icon is used only as the installed app icon. Navigation and action buttons retain their functional icons. Existing application identifiers and `eventapp://` links remain compatible. HTTPS event invitation configuration and deployment requirements are documented in [Guest event sharing](../vibe-us/docs/guest-sharing.md). Native app icon changes require a new application build; Expo Go retains its own launcher icon.

### Ewent görsel tema

Tüm native ekranlar gece laciverti zemin ve logoya uyumlu mavi/mor vurgu paletini kullanır (`src/theme/palette.ts`). Ana butonlar beyaz yazılı koyu mavi/mor geçişlidir; seçili filtreler hafif renklendirilmiş yüzeylerdir. Kartlar sakin yüzeyler, ince kenarlar ve ortak çizgi ikonlarla düzenlenmiştir. Durum/hata renkleri anlamlarını korur. Splash düzeni ve akış üst çubuğunun ikon sırası korunmuştur. Özel topluluk hissi görseldir; yeni gizlilik veya üyelik kısıtlaması eklenmemiştir.

### Ortak iOS / Android görünümü

Uygulama alanlarında ortak input yüksekliği/iç boşluğu, Outfit/Fraunces fontları, Android font-padding düzeltmesi, aynı çizgi ikonlar, yükleme göstergesi ve gölge değerleri kullanılır. Tarih/saat alanları işletim sistemi penceresi yerine ortak iOS tarzı tekerlek panelini açar; değişiklik Tamam ile kaydedilir, İptal ile korunur. Blur yüzeyleri Android için ortak BlurTargetView kullanır.

Platform kontrolleri: `TEST_PLATFORM=ios npm test` ve `TEST_PLATFORM=android npm test`. Host testleri gerçek cihazda piksel eşitliğini kanıtlamaz; farklı ekran ölçüleri ve işletim sistemi klavye/izin/fotoğraf seçici arayüzleri platforma bağlı kalır.

### Eksik kapak görselleri

Sunucuda kapak/kategori fotoğrafı bulunmayan etkinlikler, projede zaten bulunan kategoriye uygun stok görselleri gösterir; bunlar veritabanına kaydedilmez. Gerçek kapak önceliklidir. Harita/öneri sorgularının fotoğrafsız yanıtları önceden yüklenmiş gerçek kapağı silmez. Fotoğrafı olmayan kişiler için sahte yüz yerine baş harf gösterilir.

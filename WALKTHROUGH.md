# Uygulama rehberi

## Davranış sözleşmesi

- Her önemli ekran için 2–3 kısa adım vardır. Ekran ilk kez açılıp uygun hale geldiğinde rehber otomatik başlar.
- **Otomatik rehber, görünmeden önce hesapta atomik olarak ayrılır ve `skippedGuides` listesine yazılır.** Tamamlanırsa `completedGuides` listesine taşınır. Geçme, dışarı dokunma, Android geri tuşu, sayfadan ayrılma veya uygulamanın kapanması tekrar gösterime yol açmaz.
- İkinci ziyarette, oturum yeniden açıldığında ve başka cihazda aynı rehber otomatik açılmaz. Aynı anda iki cihaz isterse yalnızca birine gösterim izni verilir.
- **Ayarlar → Uygulama Rehberi** kullanıcının seçtiği rehberi yeniden açar. Tüm geçmişi sıfırlayan veya bütün rehberleri tekrar açan bir işlem yoktur.
- Ekrana doğrudan gidilebilen rehberler yerinde gösterilir. Belirli bir etkinlik, kişi veya eski başvuru gerektirenler rehber listesinden açıklamalı önizleme olarak açılır; rastgele etkinliğe veya üyeye yönlendirilmez.
- Sürüm artışı mevcut rehberleri sıfırlamaz. Yeni özellik için yeni, kalıcı bir ipucu kimliği eklenir.

## Mevcut uygulamanın analizi ve kapsam

Uygulama Expo Router, React Native, Outfit/Fraunces tipografi, gece mavisi ve mavi/mor cam yüzeyler kullanır. Kimlik doğrulama NestJS JWT üzerinden; kalıcı kullanıcı verileri TypeORM/MySQL üzerindedir. Bu çalışma alanında Firebase SDK, Firestore yapılandırması veya Firebase kimliği yoktur. Dolayısıyla rehber mevcut `user_preferences` tablosunu ve doğrulanmış kullanıcı kimliğini kullanır. Yeni bulut servisi, veritabanı tablosu veya paket gerekmez.

| Mevcut ekran | Rehberin odağı |
| --- | --- |
| Üyelik başvurusu | Başvuru bilgileri, zorunlu ve isteğe bağlı onaylar |
| Referans ve tanışma | Instagram, seçilen kişiler arasından referans isteme |
| Başvuru durumu | İnceleme, aşamalar ve hesap erişimi |
| İlgi alanları | İsteğe bağlı fotoğraf ve etkinlik önerilerine yön veren tercihler |
| Keşfet | Filtreler, sıralama, müsaitlik takvimi |
| Arama | Metin ve tarih aralığı |
| Harita | Filtreler ve isteğe bağlı konum erişimi |
| Etkinlik detayı | Zaman/konum, katılımcılar, katılım/davet/yedek durumu |
| Etkinlik oluşturma | Adımlı form, aktivite, yayın öncesi önizleme |
| Etkinlik takvimim | Müsaitlik kaydı ve özel davet havuzu |
| Etkinliklerim | Açılan odalar ve katılımcı bekleyen planlar |
| Etkinlik odası | Oda bilgileri, katılımcılar, mesajlaşma |
| Özel sohbet | Bağlantı profili ve mesajlaşma koşulları |
| Bildirimler | Davet/referans yanıtları ve bildirim yönetimi |
| Değerlendirme | İsteğe bağlı katılımcı puanları ve gönderme |
| Kendi profili | Düzenleme, bağlantılar, geçmiş etkinlikler, güven skoru |
| Üye profili | Birlikte etkinlik sonrası bağlantı ve skor |
| Ayarlar | Bildirimler, gizlilik/izinler, rehberin yeniden açılması |
| Yönetim (yalnızca admin) | Genel bakış ve başvuru incelemeleri |

Profilin iki farklı kullanımını ayıran toplam **19 rehber** vardır. Açılış, karşılama, giriş, şifre kurtarma ve yasal metinler zaten tek amaçlı ekranlardır; üzerlerine eğitim katmanı eklenmez. Misafir davet akışı üye hesabına erişmez ve üye rehberlerini başlatmaz. Uygulama rehberi listesinin kendi otomatik rehberi yoktur.

QR tarayıcı veya swipe arayüzü yoktur. Check-in, etkinlik başladığında organizatörün oda bilgisinden yaptığı giriş onayıdır. Üye bağlantısı birlikte etkinliğe katılma koşuluna bağlıdır. Rehberler mevcut olmayan QR, swipe, engelleme veya şikâyet arayüzü vaat etmez.

Hesap oluşturulmadan önceki ilk başvuru rehberinin geçmişi kimliği bilinmeyen kullanıcıya bağlanamayacağı için yalnızca o çalışma oturumunda tutulur. Hesap oluşturulduğunda aynı sonuç hesaba aktarılır. Kimlik oluşmadan kişisel kayıt kalıcılaştırılmaz.

## İki katman

1. `config.ts` ekran/route ve hedef kimliklerine bağlı rehberleri tanımlar.
2. `ContextualTip` ilk katılım, referansla karşılaşma, etkinlik daveti, etkinlik görünürlüğü, giriş onayı ve müsaitlik kaydı için küçük, kapatılabilir açıklamalar sunar. Bunlar sayfayı karartmaz veya eylemi engellemez. Yalnızca odaklanmış ekranda, konumları görünürken ve başka eğitim/işlem katmanı yokken ayrılır. Aynı ekran ziyaretinde en fazla bir ipucu gösterilir.

## Mimari

- `walkthrough/config.ts`: kalıcı kimlikler, kısa Türkçe metinler, ekran eşleştirmesi ve rehber listesi.
- `walkthrough/model.ts`: sürüm, monotonic birleştirme, kayıt türleri, güvenli kart yerleşimi.
- `walkthrough/repository.ts`: her hesap/oturum için ayrı repository, sunucu kontrolü, hesap bazlı AsyncStorage önbelleği ve kalıcı sonuç kuyruğu.
- `walkthrough/targets.tsx`: yalnızca odaktaki native ekranın hedef kaydı, `measureInWindow`, sınırlı ölçüm zaman aşımı ve Scroll entegrasyonu.
- `walkthrough/activity.ts`: native modal, klavye, yasal onay ve kritik işlemlere erteleme. Ekran bloklayıcıları native stack içinde arka planda kalan ekranlardan etkilenmez.
- Başlanmış başvuru, etkinlik veya müsaitlik formu geç yüklenen bir ekran tanıtımıyla kesilmez. Bu otomatik başlangıç engeli, kullanıma bağlı küçük ipuçlarını kapatmaz.
- `WalkthroughProvider`: oturum/route yaşam döngüsü, ilk gösterim rezervasyonu, geçiş iptali ve yeniden başlatma.
- `WalkthroughOverlay`: native Modal, yuvarlatılmış SVG spotlight, mevcut cam yüzeyler, güvenli alanlar, adım göstergesi, Geri/İleri/Geç/Bitir, ekran okuyucu odağı ve reduced-motion.
- `ContextualTip`: ekran içinde, erişilebilir ve kapatılabilir ilk kullanım açıklaması. Görünürlük kaydırma bitince tekrar kontrol edilir; sürekli ölçüm döngüsü yoktur.

Kaydırma hedefi mevcut `Scroll` bileşeni tarafından en az gereken mesafeye taşınır. Rehber kaydırması animasyonsuzdur; kart geçişi sistemin azaltılmış hareket tercihine uyar. Eksik, sıfır boyutlu, ayrılmış veya ekran dışında kalan hedefler atlanır. Kart dar ekran ve büyük yazı boyutunda kaydırılabilir, ekran sınırları içinde kalır. Cam kart mevcut saydamlığı azalt tercihini izler.

### Sunucu

`vibe-us/src/users/walkthroughs.service.ts`, mevcut `user_preferences` tablosunda `key = walkthroughs` kullanır. Bileşik `(user_id, key)` birincil anahtarı, transaction ve `pessimistic_write` kilidi cihazlar arası rezervasyonları sıralar.

- `GET /users/me/walkthroughs` → `{ accountId, state }`
- `POST /users/me/walkthroughs` → `{ accountId, granted, state }`
- POST gövdesi: `{ accountId, id, kind: guide|tip, action: claim|complete|skip, version }`
- JWT kullanıcı kimliği belirleyicidir. Gövdedeki hesap kimliği farklıysa istek storage erişiminden önce 403 alır. İstemci de yanıt kimliğini doğrular.
- `state`: `{ version, completedGuides, skippedGuides, seenTips }`
- Doğrulama: UUID hesap, sınırlı kimlikler, izin verilen tür/eylem, tamsayı sürümü ve 256 kayıt sınırı.
- Tamamlanmış kayıt eski bir cihazdan gelen `skip` ile geri alınmaz. Kullanıcı hesabının silinmesi mevcut foreign key cascade ile rehber geçmişini de kaldırır.
- Genel preference endpoint'i `walkthroughs` yazmaya izin vermez; geçmişi değiştirmek için yalnızca kontrollü işlemler kullanılabilir.

### Çevrimdışı davranış

Önbellek sadece tekrarları engellemekte kullanılır. Otomatik gösterim için sunucu kontrolü ve başarılı rezervasyon gerekir; ağ kesintisinde bilinmeyen bir geçmiş boş geçmiş sayılmaz. Uygulama çalışmaya devam eder. Tamamlanma ve geçme sonuçları önce hesaba özel yerel kuyruğa yazılır; bağlantı geldiğinde, uygulama öne döndüğünde veya yeni route açıldığında tekrar gönderilir. Kullanıcı isterse önizlemeyi çevrimdışı açabilir. Henüz sunucuya ulaşmamış bir tamamlanmanın diğer cihazdaki durumu “geçildi” olabilir; ilk rezervasyon zaten bulunduğundan rehber tekrar açılmaz.

## Yeni rehber ekleme

1. `GUIDES` listesine benzersiz ve kalıcı bir `id`, mevcut `screen` ve 2–4 kısa adım ekle.
2. İlgili mevcut `Box`, `Touch`, `GlassCard`, `HeaderIconButton`, `TopNavBar` veya `NavAction` üzerine `walkthroughId` ekle. Büyük bir liste yerine kompakt bir kontrol/başlık hedefle.
3. Çok adımlı forma ait sonraki özellikler için tüm sayfa rehberini tekrarlatmak yerine `TIPS` ve `ContextualTip` ekle.
4. Özel bir Modal için `useWalkthroughBlocker`; ekrana ait kritik/düzenleme durumu için `useWalkthroughScreenBlocker` kullan. Ortak `Sheet` bunu zaten yapar.
5. Kimliği değiştirme veya sürüm artışıyla geçmişi temizleme. Yeni özelliği yeni bir kimlikle tanıt.

## Doğrulama

- `npm run typecheck`
- `npm test` (mevcut native host regresyonları + walkthrough senaryoları)
- `TEST_WALKTHROUGH_ONLY=1 npm test`
- `TEST_PLATFORM=android TEST_WALKTHROUGH_ONLY=1 npm test`
- `npm run export:native` (iki platformun Metro/Hermes paketleri)
- Backend: `npm test -- --runInBand` ve `npm run build`

Rehber testleri: ilk ziyaret, geçme, tamamlama, tekrar ziyaret, oturum yenileme, temiz ikinci cihaz, hesap ayrımı, eşzamanlı rezervasyon, çevrimdışı sonuç kuyruğu, bozuk önbellek, farklı hesaptan gelen yanıt, manuel tekrar, ipucu tekrarı, klavyede duraklama, kritik işlemden sonra başlama, eksik hedef ve dar/yatay ekran kart sınırları. Host mock testleri gerçek cihaz erişilebilirliği, blur performansı veya gerçek MySQL kilit davranışı için cihaz/veritabanı testinin yerine geçmez.

iOS 26.5 / iPhone 17 Pro simülatöründe gerçek native derleme başarıyla tamamlandı. İlk başvuru rehberinde spotlight, cam kart, ikinci adıma otomatik kaydırma, Bitir ile kapanma ve aynı ekranın ikinci ziyaretinde rehberin açılmaması görsel olarak doğrulandı. Giriş gerektiren diğer ekranların kapsamı otomatik host testleriyle doğrulandı. Native açılışta mevcut Pods yapısından kaynaklanan `ExpoPushTokenManager` eksik modül uyarısı görüldü; uyarı kapatıldıktan sonra rehber akışı çalıştı. Bildirimlerin native bağımlılıklarının eşleştirilmesi ayrıca gerekir.

`npx expo install --check` mevcut bağımlılıklarda Expo'nun önerdiği patch sürümleriyle fark bildiriyor (expo, contacts, linking, location, router, splash-screen). Rehber yeni bağımlılık eklemez; paket güncellemesi ayrı doğrulama gerektirir.

Dağıtım sırası: önce backend'deki rehber endpoint'lerini, ardından mobil sürümü yayınla. Backend henüz güncellenmediyse rehber otomatik açılmaz ve uygulamanın mevcut işlevleri çalışmaya devam eder. Backend yayını mevcut GitHub Actions hattından yapılır; servis yeniden başlatılır ve canlı API sağlık kontrolleri doğrulanır.

Referanslar: [React Native native ölçüm](https://reactnative.dev/docs/the-new-architecture/layout-measurements), [erişilebilirlik API'si](https://reactnative.dev/docs/accessibilityinfo), [TypeORM transaction](https://typeorm.io/docs/advanced-topics/transactions/).

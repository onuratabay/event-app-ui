# App Privacy hazırlığı — yayın öncesi doğrulanacak taslak

14 Kasım 2026. Bu dosya kaynak kodu incelemesine dayanır; App Store Connect’te henüz beyan girilmedi. Canlı iOS build’in SDK sürümleri ve sunucu loglama/saklama ayarlarıyla son kontrol yapılmalıdır. “Data Not Collected” seçimi bu uygulamanın hesap ve mesaj saklayan yapısıyla uyumlu değildir.

## Uygulamanın kendi verileri

Aşağıdaki veriler için genel amaç App Functionality, genel kimlik ilişkisi Linked to You’dur. Geliştirici tarafında reklam takibi için kullanıldıklarına dair bulgu yoktur; SDK davranışı ayrıca değerlendirilir.

| Apple veri türü | Kaynak ve amaç | Hazırlık sonucu |
|---|---|---|
| Contact Info / Name | Üye adı ve soyadı; hesap/profil | Beyana ekle |
| Contact Info / Email Address | Giriş, doğrulama ve destek | Beyana ekle |
| Contact Info / Phone Number | Hesap ve referans eşleştirme | Beyana ekle |
| Identifiers / User ID | Hesap UUID’si | Beyana ekle |
| User Content / Emails or Text Messages | Birebir ve etkinlik sohbet mesajları | Beyana ekle |
| User Content / Photos or Videos | Profil ve etkinlik fotoğrafları; video yükleme doğrulanmadı | Fotoğrafları kapsayacak şekilde ekle |
| User Content / Other User Content | Biyografi, etkinlik açıklamaları, ilgi alanları, müsaitlik ve kullanıcı bildirimleri | Beyana ekle; kategorileri gerçek içeriğe göre ayır |
| Other Data | Doğum tarihi | Apple formundaki uygun alanı doğrula; bunu sağlık verisi olarak işaretleme |
| Location / Coarse Location | Üyenin şehri ve etkinlik yeri | Toplanan/kalıcı verinin bağlamını doğrula |
| Location / Precise Location | Seçilen etkinlik koordinatları saklanıyor; cihaz GPS’i ve adres arama da kullanılıyor | Koordinatların Apple tanımına göre kesin konum olup olmadığını ve kullanıcı kimliğiyle ilişkisini doğrula |
| Contacts | İzinle seçilen telefon numaraları /references/contacts üzerinden eşleştiriliyor | Kodda ham rehberin saklandığı görülmedi. API/ağ logları ve saklama süreleri doğrulanmadan kesin yanıt verme |

Kaynaklar: src/api/client.ts; src/events/LocationPicker.tsx; src/services/push.ts; ../vibe-us/src/users/user.entity.ts; ../vibe-us/src/auth/dto/register.dto.ts; ../vibe-us/src/references/references.service.ts.

## AdMob ve diğer üçüncü taraflar

react-native-google-mobile-ads ve iOS ATT/UMP akışı mevcut. Gerçek reklam birimi üretim ortamından geliyor. Google’ın güncel beyanı; cihaz kimlikleri, yaklaşık konum, reklam etkileşimleri, ürün etkileşimleri, çökme ve performans verilerinin toplanabileceğini açıklıyor. Her tür için Third-Party Advertising / Analytics amaçlarını ve Linked to You / Tracking yanıtlarını gerçek iOS SDK privacy manifest’i, izinler ve reklam yapılandırmasıyla eşleştir. ATT penceresinin varlığı tek başına bütün veri türleri için “Tracking: Yes” anlamına gelmez; izin reddi de bütün SDK toplamasını kaldırmaz.

Harita/yer arama servislerini ve bildirim altyapısını da üçüncü taraf incelemesine dahil et. Yalnızca bu depoda Analytics/Crashlytics entegrasyonu görülmediği için AdMob’un tanılama toplamasını yok sayma.

Kaynaklar:
- https://developer.apple.com/app-store/app-privacy-details/
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- https://developers.google.com/admob/ios/privacy/data-disclosure

## Gizlilik bağlantısı kontrolü

Hedef: https://ewent.app/gizlilik
HTML sayfası yanıt verdi; içerik JavaScript ile https://ewent.app/legal/documents/privacy üzerinden yükleniyor. Bu API bu hazırlık sırasında iki kez HTTP 502 döndürdü. Metin okunabilir hale gelmeden bağlantıyı yayın için hazır sayma. Site destek formu da sunucuya bağlı olduğundan formun mesaj iletimini ayrıca kontrol et.

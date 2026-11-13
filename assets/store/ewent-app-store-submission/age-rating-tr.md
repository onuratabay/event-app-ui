# Yaş derecelendirmesi için yanıt taslağı

Bu dosya soru formunu doldurmak için hazırlıktır; Apple’ın nihai derecelendirmesi değildir.

- Kullanıcı tarafından oluşturulan içerik: Evet (etkinlik açıklamaları, profil ve mesajlar).
- Mesajlaşma / sohbet: Evet (birebir ve etkinlik sohbetleri).
- Reklam: Evet; iOS üretim derlemesindeki AdMob birim ve gösterim durumunu doğrula.
- Sosyal özellikler: Keşfet akışı kullanıcı etkinliklerini gösteriyor, profil/favori/iletişim özellikleri var. Formdaki güncel sosyal özellik tanımına göre değerlendir.
- Uygulama içi yaş güvencesi: Sunucuda doğum tarihi ve minimum 18 yaş kontrolü var. Bunu belgeyle kimlik doğrulama veya ebeveyn kontrolü olarak beyan etme.
- Ebeveyn kontrolü: Mevcut kaynakta özel bir ebeveyn kontrol sistemi doğrulanmadı.
- Sınırsız web erişimi: Metin/harita/destek bağlantıları tek başına sınırsız tarayıcı değildir; uygulama içi tüm bağlantı davranışlarını kontrol et.
- Alkol/gece hayatı teması: Etkinlik kategorilerinde gece hayatı bulunuyor. Gerçek etkinlik ve görsel içeriğine bakarak sıklığı yanıtla; otomatik “None” seçme.
- Kumar, cinsel içerik, şiddet, sağlık önerileri vb.: İlgili uygulama içeriğini ve moderasyon politikasını inceleyerek yanıtla; bu taslak bilinmeyen alanları “yok” olarak onaylamaz.

Üyelik 18+ olduğu için Apple’ın hesapladığı derece daha düşükse geliştiricinin minimum yaş politikasıyla tutarlı bir yüksek derece seçme alanını kullan. Sonuç ülkeye göre farklılaşabilir.

Kaynaklar:
- https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating
- https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions
- ../vibe-us/src/common/validators/birth-date.ts
- ../vibe-us/src/auth/dto/register.dto.ts

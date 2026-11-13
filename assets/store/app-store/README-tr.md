# Ewent — App Store gönderim paketi

Hazırlık tarihi: 14 Kasım 2026. Bu paket dosyaları hazırlar; App Store Connect’te veri girmez, build yüklemez veya yayınlamaz.

## Kopyalanabilir mağaza alanları

- Uygulama adı: tr-TR/name.txt
- Alt başlık: tr-TR/subtitle.txt
- Tanıtım metni: tr-TR/promotional-text.txt
- Açıklama: tr-TR/description.txt
- Anahtar kelimeler: tr-TR/keywords.txt
- Alanların toplu hali: metadata.json
- App Review notları (İngilizce): review-notes-en.txt
- Sürüm notu taslağı: release-notes-tr.txt (ilk sürümde alan istenmeyebilir)

Ad 30, alt başlık 30, tanıtım 170, anahtar kelimeler 100 ve açıklama 4000 karakter sınırlarına karşı kontrol edildi.

## Bağlantılar

- Support URL: https://ewent.app/#iletisim
- Marketing URL: https://ewent.app/
- Privacy Policy URL: https://ewent.app/gizlilik
- Kullanıcının teyit ettiği destek e-postası: onuratabay@icloud.com. Sitede hâlen appewent@gmail.com yazıyor; yayında tutarlı iletişim için site metni ayrıca güncellenebilir.

Gizlilik HTML sayfası erişilebilir, fakat içeriği yükleyen /legal/documents/privacy API’si kontrol sırasında iki kez HTTP 502 döndürdü. Gönderimden önce gizlilik metninin tarayıcıda okunabildiğini ve destek formunun çalıştığını doğrula.

## Sürüm / build

EAS’te görülen son bitmiş iOS production derlemesi: 1.0.0, build 4 (2fa7bf88-4499-4c10-b212-8bc77014360d). TestFlight’a gerçekten aktarılıp aktarılmadığı App Store Connect’ten ayrıca doğrulanmalıdır. Android 3.0.0 versionCode 4 ile karıştırma. App Store sürüm alanı seçtiğin iOS build’in sürümüyle eşleşmeli.

## Kullanıcıdan tamamlanacak alanlar

- Telif hakkı: 2026 + hak sahibi kişinin veya şirketin doğru adı. Henüz teyit edilmedi; uydurulmadı.
- İnceleme iletişim kişisi, telefon ve e-posta.
- İnceleme hesabı kullanıcı adı ve şifresi: bunları App Store Connect > App Review Information alanına doğrudan gir; bu pakete veya Git’e yazma.
- İnceleme hesabının üyeliği onaylı olmalı; referans beklememeli. Hesap inceleme boyunca erişilebilir kalmalı.
- Fiyat, yayın ülkeleri, ticari durum ve otomatik/manuel yayınlama tercihi kullanıcı tarafından seçilmeli.

## Gizlilik ve yaş

privacy-review-tr.md ve age-rating-tr.md kaynak kodundan çıkarılmış yanıt taslaklarıdır. Belirsiz SDK/veri saklama alanları açıkça işaretlendi. Bunlar doldurulmuş veya Apple tarafından doğrulanmış beyanlar değildir.

## iPhone ekran görüntüleri

Üye ekranlarına ait görüntüler henüz teslim edilmedi. Mevcut iOS simülatör uygulaması açıldı; giriş gerekiyor ve canlı API HTTP 502 döndürüyor. Yerel bilgisayar kontrol aracı da native pipe startup failed hatası verdiği için giriş ekranında etkileşim kurulamadı. Gerçek iOS arayüzünden çekilecek dosyalar screenshots/ altında teslim edilecek. Android görüntüleri iPhone ekranı gibi yeniden etiketlenmez. Hedef iPhone 6.9 inç grubu: 1320 × 2868 piksel (iPhone 17 Pro Max simülatörü). Uygulamanın mevcut config’i iPad desteğini kapatıyor; gönderilen build’in hedef cihaz ailesini App Store Connect’te doğrula.

Önerilen içerik sırası: Keşfet, Harita, Etkinlik detayı, Oluştur. Üyeye özel ekranlar için iOS oturumu; canlı veri için çalışan backend gerekir. Görüntü dosyaları henüz oluşmamışsa bu bölüm tamamlanmış sayılmaz.

## App Store Connect adımları

1. Apps > Ewent > Distribution > iOS sürümünü aç.
2. Bu paketin Türkçe alanlarını ilgili alanlara kopyala ve gerçek iPhone görüntülerini ekle.
3. App Information: kategorileri ve age-rating-tr.md ile yaş formunu tamamla.
4. App Privacy: privacy-review-tr.md’deki doğrulanmış veri türlerini ve SDK uygulamalarını beyan et.
5. Build: TestFlight’ta test ettiğin uygun iOS build’i seç.
6. App Review Information: onaylı hesap, iletişim bilgileri ve review-notes-en.txt metnini ekle.
7. Fiyat/erişilebilirlik ve yayınlama tercihini tamamla; eksik alanları gider; Add for Review > Submit for Review ile gönder.

Kaynaklar:
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
- https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- https://developer.apple.com/app-store/app-privacy-details/

## Bu paketin durumu

Mağaza metinleri ve inceleme notları hazır. Gizlilik ve yaş yanıtları çalışma taslağı. Telif hakkı sahibinin adı, inceleme iletişim telefonu/kişi adı, onaylı inceleme hesabı ve gerçek iPhone özellik ekranları tamamlanmalı. Test hesabı şifresini App Store Connect’e doğrudan gir. Gizlilik API’sinin 502 hatası giderilmeli.

## Header ve Search Results görselleri

Yaratıcı görseller tamamlandı. Dosya ve yerleştirme eşleştirmesi için VISUALS-README-tr.md dosyasına bak. iPhone özellik ekranları ayrı bir gereksinimdir ve henüz tamamlanmadı.

# App Store görselleri — kullanım

Hazırlanan yaratıcı görseller:
- Header alanı: creative/ewent-header-3840x1646.png
- Search Results alanı: creative/ewent-search-1920x1280.png (daha küçük dosya) veya creative/ewent-search-3840x2560.png
- İki alan için ortak alternatif: creative/ewent-universal-5244x2950.png
- Simge kaynak çıktısı: creative/ewent-icon-1024.png (iOS uygulama simgesi ayrıca build içinde taşınır).

Header tek görsel kabul eder: özel Header ya da Universal alternatifinden birini seç. Universal zorunlu ek bir yükleme değildir. Search Results için de özel Search ya da Universal dosyasını seç. Her alanın Preview görünümünden kırpılmayı kontrol et.

PNG’ler 8-bit RGB olarak, alfa kanalı olmadan dışa aktarıldı. Ana logo Apple’ın belirtilen Art Safe Area sınırları içinde. Dosyalar telefon ekran görüntüsü değildir; Header and Search Results alanlarına yüklenir.

Gerçek iPhone ekranları: screenshots/iphone-medium/ klasöründe 1206 × 2622 piksel karşılama, giriş ve üyelik başvurusu görüntüleri hazır. App Previews and Screenshots → iPhone with Dynamic Island (medium display) alanına yükleyin. Header alanına yüklemeyin. Bunlar iPhone 17 Pro simülatöründe uygulamanın gerçek ekranlarından alındı. Üyelik sonrası özellik ekranları canlı API HTTP 502 nedeniyle henüz hazırlanamadı.

Görsel üretim: ImageGen ile atmosferik arka plan; mevcut marka logosu korunarak kesin boyutlarda yerleştirme. Yeniden dışa aktarma: node scripts/prepare-app-store-art.cjs.

Apple kaynakları (14 Kasım 2026):
https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
https://developer.apple.com/app-store/asset-best-practices/

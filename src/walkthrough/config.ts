import type { Screen } from "../types"
export interface GuideStep { target: string; title: string; body: string }
export interface Guide { id: string; screen: Screen; title: string; summary: string; section: "Başlarken" | "Keşfet ve planla" | "Birlikte" | "Hesabın"; steps: GuideStep[]; context?: "event" | "member" | "rating"; applicant?: boolean; admin?: boolean }
const step = (target: string, title: string, body: string): GuideStep => ({ target, title, body })
/** Stable IDs survive copy and version changes. New features get a NEW tip ID, never a reset. */
export const GUIDES: Guide[] = [
  { id: "application", screen: "onboarding-1", title: "Üyelik başvurusu", summary: "Başvuru bilgilerin ve onayların", section: "Başlarken", applicant: true, steps: [
    step("application-fields", "Tanışarak başlayalım", "Başvurun için iletişim ve doğum tarihi bilgilerini ekle. Bilgilerini göndermeden önce kontrol edebilirsin."),
    step("application-consent", "Onaylar senin kontrolünde", "Üyelik ve gizlilik metinlerini buradan okuyabilirsin. Kampanya izni isteğe bağlıdır."),
  ] },
  { id: "references", screen: "onboarding-2", title: "Referans ve tanışma", summary: "Instagram ve topluluktan referans", section: "Başlarken", applicant: true, steps: [
    step("reference-instagram", "Seni biraz tanıyalım", "Instagram kullanıcı adını başvuruna ekle. Devam etmek için bu alanı doldurman gerekiyor."),
    step("reference-picker", "Tanıdık bir bağlantı", "Paylaşmayı seçtiğin kişilerdeki topluluk üyelerinden referans isteyebilirsin. Referans, üyelik onayının yerine geçmez."),
  ] },
  { id: "application-status", screen: "onboarding-3", title: "Başvuru durumun", summary: "İnceleme ve sonraki adımlar", section: "Başlarken", applicant: true, steps: [
    step("application-status", "Başvurun burada", "İnceleme durumunu bu ekrandan takip edebilirsin. Hesabın onaylandığında uygulama kendiliğinden açılır."),
    step("application-progress", "Sıradaki adımı gör", "Başvurunun hangi aşamada olduğunu buradan görebilirsin. İnceleme sürerken etkinlik ve mesajlaşma özellikleri açılmaz."),
  ] },
  { id: "interests", screen: "interests", title: "İlgi alanların", summary: "Sana uygun etkinliklere ilk adım", section: "Başlarken", steps: [
    step("interests-photo", "Bir yüzle tanışmak daha kolay", "Profil fotoğrafı isteğe bağlı. İstersen şimdi ekleyebilir, daha sonra profilinden değiştirebilirsin."),
    step("interests-categories", "Sevdiğin şeyleri seç", "En az bir ilgi alanı seç. Keşfet’teki öneriler bu tercihlerinden yararlanır."),
  ] },
  { id: "discover", screen: "discover", title: "Keşfet", summary: "Sana uygun buluşmaları bul", section: "Keşfet ve planla", steps: [
    step("discover-filters", "Bugünün planını bul", "Tarih veya aktivite filtreleriyle ilgini çeken etkinliklere odaklan."),
    step("discover-sort", "Sıralama sana uysun", "Zamana, mesafeye veya sana özel önerilere göre sırala. Kendi etkinliklerini de buradan bulabilirsin."),
    step("discover-calendar", "Planın henüz yoksa", "Müsait olduğun zamanları takvimine ekle. Uygun etkinliklerin organizatörleri seni davet edebilir."),
  ] },
  { id: "search", screen: "search", title: "Etkinlik ara", summary: "Arama, tarih aralığı ve ilgi alanları", section: "Keşfet ve planla", steps: [
    step("search-query", "Aklında bir şey mi var?", "Etkinlik, aktivite veya konum adıyla ara."),
    step("search-dates", "Zamanına uygun olsun", "Başlangıç ve bitiş tarihini seçerek sonuçları daralt. Filtreyi dilediğinde temizleyebilirsin."),
  ] },
  { id: "map", screen: "map", title: "Harita", summary: "Buluşmaları konumuyla keşfet", section: "Keşfet ve planla", steps: [
    step("map-filters", "Haritayı kendine göre daralt", "Tarih, aktivite ve konum filtrelerini birlikte kullan. Haritadaki bir etkinliğe dokunarak ayrıntılarını aç."),
    step("map-location", "Yakınında neler var?", "Bu düğme haritayı konumuna taşır. Konum izni vermeden de haritayı gezebilirsin."),
  ] },
  { id: "event-detail", screen: "event-detail", title: "Etkinlik ve katılım", summary: "Buluşma ayrıntıları ve katılım durumu", section: "Keşfet ve planla", context: "event", steps: [
    step("event-meta", "Buluşmadan önce", "Tarih, süre ve konumu kontrol et. Konuma dokunarak yol tarifi alabilirsin."),
    step("event-people", "Kimlerle buluşacaksın?", "Katılımcı sayısını burada görürsün. Etkinlik, gereken minimum katılımcıya ulaştığında sohbet odası açılır."),
    step("event-action", "Katılımın burada", "Katılma, davet ve yedek liste durumunu bu alandan takip et. Görebileceğin işlemler etkinliğin durumuna göre değişir."),
  ] },
  { id: "create-event", screen: "create-event", title: "Etkinlik oluştur", summary: "Fikrini bir buluşmaya dönüştür", section: "Keşfet ve planla", steps: [
    step("create-progress", "Adım adım bir plan", "Aktivite, zaman, konum ve katılımcı bilgileriyle ilerle. Yayınlamadan önce bir önizleme göreceksin."),
    step("create-activity", "Önce ne yapmak istersin?", "Bir aktivite seçerek başla. Aradığın aktivite yoksa yeni bir öneri gönderebilirsin."),
  ] },
  { id: "availability", screen: "availability", title: "Etkinlik takvimim", summary: "Müsaitlik paylaş, uygun davetler al", section: "Keşfet ve planla", steps: [
    step("availability-tabs", "Müsaitliğini paylaş", "Yeni müsaitlik ekle; mevcut kayıtlarını Kayıtlarım’dan düzenle veya duraklat. Bu, herkese açık bir etkinlik oluşturmaz."),
    step("availability-dates", "Sana uygun zamanı belirle", "Tarih, gün ve saat tercihlerini ekle. Konum ve aktivite tercihlerine uyan organizatörler seni davet edebilir."),
  ] },
  { id: "rooms", screen: "rooms", title: "Etkinliklerim ve odalar", summary: "Katılımlarını ve sohbetlerini takip et", section: "Birlikte", steps: [
    step("rooms-active", "Buluşmanın sohbeti", "Minimum katılımcıya ulaşan etkinliklerin odaları burada görünür. Katılımcılarla buluşma detaylarını konuşabilirsin."),
    step("rooms-forming", "Planın durumunu takip et", "Henüz yeterli katılımcıya ulaşmayan planlarını burada görürsün. Detaylarına dokunarak katılım durumunu kontrol et."),
  ] },
  { id: "event-room", screen: "event-room", title: "Etkinlik odası", summary: "Mesajlaşma ve buluşma bilgileri", section: "Birlikte", context: "event", steps: [
    step("room-info", "Buluşma bilgileri bir dokunuşta", "Oda adına dokunarak katılımcıları, giriş onayını ve oda ayarlarını açabilirsin."),
    step("room-composer", "Bir merhaba ile başla", "Mesajını yaz veya hazır yanıtlardan birini seç. Kendi mesajlarını düzenlemek için mesaja basılı tut."),
  ] },
  { id: "direct-chat", screen: "direct-chat", title: "Özel mesajlar", summary: "Bağlantılarınla bire bir sohbet", section: "Birlikte", context: "member", steps: [
    step("direct-person", "Sohbetin kiminle?", "Bağlantının profiline üstteki isimden ulaşabilirsin."),
    step("direct-composer", "Sohbeti sürdür", "Bire bir mesajlaşma bağlantıların arasında açıktır. Bağlantı sona erdiğinde yeni mesaj gönderilemez."),
  ] },
  { id: "notifications", screen: "notifications", title: "Bildirimler ve davetler", summary: "Topluluktan gelen haberler", section: "Birlikte", steps: [
    step("notification-invites", "Davetleri kaçırma", "Etkinlik davetlerin ve referans isteklerin bu alanda görünür. Varsa yanıt süresini kontrol et."),
    step("notification-actions", "Bildirimlerini düzenle", "Üstteki seçeneklerle bildirimlerini okundu işaretleyebilir veya silebilirsin. Silmek, etkinlik katılımını değiştirmez."),
  ] },
  { id: "rate-event", screen: "rate-event", title: "Etkinlik değerlendirmesi", summary: "Deneyimin topluluğa yol göstersin", section: "Birlikte", context: "rating", steps: [
    step("rating-people", "Deneyimini paylaş", "İstediğin katılımcıları değerlendirebilirsin. Bir kişiyi puanlamaya başlarsan üç soruyu da yanıtla."),
    step("rating-submit", "Hazır olduğunda gönder", "Göndermeden önce puanlarını kontrol et. Değerlendirmeler katılımcıların profil skorlarına yansır."),
  ] },
  { id: "profile", screen: "profile", title: "Profilin ve güven", summary: "Kendini anlat, bağlantılarını gör", section: "Hesabın", steps: [
    step("profile-header", "Profilin seni anlatsın", "Fotoğrafına veya adına dokunarak güncelle. Şehir ve hakkında bilgilerini de profilinden düzenleyebilirsin."),
    step("profile-connections", "Birlikte birikenler", "Sayaçlara dokunarak bağlantılarını, katıldığın ve düzenlediğin etkinlikleri aç."),
    step("profile-score", "Güven birlikte oluşur", "Event Skoru, birlikte etkinliğe katıldığın kişilerin değerlendirmelerinden oluşur."),
  ] },
  { id: "member-profile", screen: "profile", title: "Topluluk profilleri", summary: "Tanış, bağlantı kur ve güvenle paylaş", section: "Hesabın", context: "member", steps: [
    step("profile-header", "Biraz daha yakından tanı", "Üyenin paylaştığı bilgileri ve ilgi alanlarını profilinde keşfet."),
    step("profile-relation", "Bağlantı kur", "Birlikte bir etkinliğe katıldığın üyeye bağlantı isteği gönderebilirsin. Bağlantı olduğunuzda bire bir mesajlaşma da açılır."),
    step("profile-score", "Birlikte yaşanan deneyimler", "Skor, diğer katılımcıların etkinlik sonrası değerlendirmelerini gösterir."),
  ] },
  { id: "settings", screen: "settings", title: "Ayarlar ve gizlilik", summary: "Bildirimler, izinler ve uygulama rehberi", section: "Hesabın", steps: [
    step("settings-notifications", "Hangi haberleri alacağını seç", "Davet, mesaj ve hatırlatma bildirimlerini ayrı ayrı yönetebilirsin."),
    step("settings-privacy", "İzinlerin senin kontrolünde", "Konum, fotoğraflar ve kişiler için telefon ayarlarına buradan ulaş. Kampanya iznini de dilediğinde değiştir."),
    step("settings-guide", "Rehber her zaman burada", "Bir rehberi kapattığında kendiliğinden tekrar açılmaz. İstediğin bölümü Uygulama Rehberi’nden yeniden inceleyebilirsin."),
  ] },
  { id: "admin", screen: "admin", title: "Yönetim", summary: "Genel bakış ve üyelik incelemeleri", section: "Hesabın", admin: true, steps: [
    step("admin-overview", "Topluluğa genel bakış", "Üyelik, etkinlik ve katılım verilerini Genel bakış’tan takip et."),
    step("admin-applications", "Başvuruları incele", "Başvurular sekmesinde arama ve durum filtrelerini kullan. Bir başvuruyu açarak ayrıntılarını ve uygun yönetim işlemlerini görebilirsin."),
  ] },
]
export const TIPS = {
  participation: { title: "Katılımın kaydedildi", body: "Minimum katılımcıya ulaşıldığında etkinlik odası açılır. Buluşmada girişini organizatör onaylar; vardığında sohbete haber verebilirsin." },
  references: { title: "Bir referans, bir tanışıklık", body: "Referans isteğin seçtiğin üyeye gider. Yanıtını burada takip edebilirsin; üyelik için yönetici incelemesi de gerekir." },
  invitations: { title: "Davet sana özel", body: "Katılmadan önce tarih ve konumu kontrol et. Süreli bir davetse son yanıt zamanı davetin yanında görünür." },
  privacy: { title: "Kimler görebilsin?", body: "Sadece davetliler seçeneği etkinliği davet ettiğin kişilerle sınırlar. Yayınlamadan önce davetli seçmen gerekir." },
  checkin: { title: "Buluşmada giriş onayı", body: "Etkinlik başladığında katılımcı girişlerini oda bilgisinden organizatör onaylar. Vardığında sohbete “Geldim” yazabilirsin." },
  availability: { title: "Takvimin bir davete dönüşebilir", body: "Bu kayıt uygun organizatörlerle eşleşmeni sağlar. Bir davet gelirse katılma kararı yine senindir; kayıtlarını duraklatabilirsin." },
} as const
export type TipId = keyof typeof TIPS
export function guideForRoute(path: string, memberProfile: boolean) {
  return GUIDES.find(guide => `/${guide.screen}` === path && (guide.screen !== "profile" || (guide.id === "member-profile") === memberProfile))
}

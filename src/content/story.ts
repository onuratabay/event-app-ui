import type { Screen } from "../types"

/** Marka hikâyesi: Merak → karşılaşma → güven → buluşma → ortak anı.
 * İkili başlıklar iki insanı, iki niyeti veya yolculuğun iki anını bağlar.
 * Bunlar editoryal metinlerdir; canlı aktivite veya kişisel veri iddiası taşımaz.
 */
export const APP_STORY = {
  title: "Bir meraktan ortak bir anıya.",
  premise: "Birinin aklındaki küçük bir plan, bir başkasının beklediği davet olabilir. ewent, bu iki ihtimalin buluştuğu yer.",
} as const

export interface StoryBeat { pair: readonly [string, string]; note: string }
export const story = {
 account: {pair:['Güvenli bir hesap','Sana ait kontrol'],note:'Hesabınla ilgili kararlar senin elinde.'},
 reports: {pair:['Bir bildirim','Güvenli bir topluluk'],note:'Paylaştığın geri bildirim, ortak alanımıza iyi gelir.'},
 legal: {pair:['Açık bilgiler','Bilinçli tercihler'],note:'Koşulları bilerek, güvenle devam et.'},
  settings: { pair: ["Senin ritmin", "Senin tercihin"], note: "Birlikte yaşanan anların arasında, kendine uygun bir alan da olsun." },
  splash: { pair: ["Bir kıvılcım", "Bir ihtimal"], note: "Her ortak anı, küçük bir merakla başlar." },
  welcome: { pair: ["Senin merakın", "Birinin daveti"], note: "Aklındaki küçük bir plan, birlikte anlatacağınız bir hikâyenin başlangıcı olabilir." },
  login: { pair: ["Kaldığın yer", "Yeni bir sayfa"], note: "Yeniden merhaba. Hikâyene bugün bir buluşma daha ekleyebilirsin." },
  "forgot-password": { pair: ["Küçük bir ara", "Yeniden merhaba"], note: "Bazen dönüş yolu bir hatırlatmayla açılır. Buradan devam edebilirsin." },
  "onboarding-1": { pair: ["Bir isim", "İlk merhaba"], note: "Birbirimizi tanımak, aynı masaya oturmanın ilk adımı." },
  "onboarding-2": { pair: ["Tanıdık bir bağ", "Yeni bir çevre"], note: "Güvenle başlayan tanışmalar, yeni karşılaşmalara yer açar." },
  "onboarding-3": { pair: ["Biraz sabır", "Yeni bir başlangıç"], note: "Bir sonraki sayfa, tanışmaya ayırdığımız bu küçük aradan sonra." },
  approval: { pair: ["Açılan bir kapı", "Sana ayrılan yer"], note: "Şimdi seni sen yapan meraklarla başlayalım." },
  interests: { pair: ["Senin sevdiğin", "Birinin tutkusu"], note: "Aynı şeye heyecanlanmak, ilk sohbeti kolaylaştırır." },
  discover: { pair: ["Bir küçük plan", "Ortak bir anı"], note: "Bir yürüyüş, bir kahve, bir oyun… Bugünün hikâyesi hangisi olsun?" },
  search: { pair: ["Aklındaki fikir", "Karşındaki ihtimal"], note: "Bir kelimeyle başla. Belki de aradığın, birlikte yapacak bir şeydir." },
  map: { pair: ["Aynı şehir", "Kesişen yollar"], note: "Haritadaki bir nokta, ilk merhabanın adresi olabilir." },
  "event-detail": { pair: ["Birinin planı", "Senin katılman"], note: "Bir planı ortak bir ana dönüştüren, ona katılan insanlar." },
  "create-event": { pair: ["Senin fikrin", "Birlikte bir gün"], note: "Küçük bir davet bırak. Hikâyenin devamını birlikte yazın." },
  "event-room": { pair: ["İlk mesaj", "İlk buluşma"], note: "Bir merhaba bırak; planın ayrıntıları sohbetle yerine otursun." },
  rooms: { pair: ["Verilen söz", "Paylaşılan zaman"], note: "Katıldığın ve düzenlediğin her plan, ortak hikâyene açılan bir sayfa." },
  notifications: { pair: ["Birinden haber", "Senden bir karşılık"], note: "Bir davet ya da küçük bir hatırlatma, sohbeti yeniden başlatabilir." },
  profile: { pair: ["Senin hikâyen", "Ortak noktalar"], note: "Sevdiğin şeyler ve kendinden birkaç kelime, bir merhabaya yol açabilir." },
} as const satisfies Record<Screen, StoryBeat>

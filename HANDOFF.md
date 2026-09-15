# SocialLens — Devir-Teslim Notu (başka PC'de devam etmek için)

Tarih: 2026-09-15 · Durum: **tsc temiz · lint temiz · jest 8 suite / 51 test geçiyor**

Bu dosya, projeye başka bir bilgisayarda kaldığı yerden devam edebilmek için yazıldı. Sırasıyla:
(1) projeyi nasıl ayağa kaldıracağın, (2) uygulamanın bugünkü durumu, (3) bugün yapılan değişiklikler,
(4) yarım kalan / doğrulanmamış işler, (5) sık kullanılan komutlar ve dosya haritası.

---

## 1. Yeni PC'de kurulum (5 dakika)

```bash
git clone <repo-url> emre-ins
cd emre-ins
npm install                 # Node 20+ (bkz. .nvmrc), Expo SDK 57
npx expo start -c           # QR → Expo Go (telefon) · "w" → web · Android/iOS emülatör
```

- `.env` **repoda** (bilerek): sadece `EXPO_PUBLIC_*` değerleri, secret yok. Varsayılan `EXPO_PUBLIC_APP_MODE=demo`.
- `supabase/.env` **repoda değil** (`.gitignore`): Meta App Secret + token şifreleme anahtarı içerir; `supabase/.env.example`'dan oluştur.
- Doğrulama komutları: `npx tsc --noEmit -p tsconfig.json` · `npm run lint` · `npx jest` · `npx expo export --platform android` (bundle testi).
- Git Bash'te uzun heredoc'lar bozuluyor (Windows). Uzun içerik için dosya yaz (Write) ya da `node script.js` kullan.

---

## 2. Uygulama ne durumda?

### Çalışan modlar
| Mod | Nasıl girilir | Veri kaynağı | Durum |
|---|---|---|---|
| **Demo** | Bağlantı ekranı → "Demo Hesapla Devam Et" | `mocks/mockData.ts` (@zmtprefabrik) | Tam çalışıyor, Expo Go'da çalışır |
| **Herkese açık hesap** | Arama sekmesi → kullanıcı adı (ör. `natgeo`, `galatasaray`) | Instagram'ın giriş gerektirmeyen HTML sayfaları | **Bugün yeniden yazıldı; Node'da gerçek ağla uçtan uca doğrulandı**, telefonda henüz denenmedi |
| **Manuel profil** | Bağlantı ekranı → "Manuel profil oluştur" | Elle girilen veriler | Çalışıyor |
| **Canlı (Instagram ile giriş)** | Bağlantı ekranı → "Instagram ile Bağlan" | Meta Graph API (backend üzerinden) | Kod tamam; **Meta App ID + Supabase deploy gerekiyor** (bkz. §4) |

### Arayüz
Instagram birebir: alt bar Home · Reels · Gönder · Ara · Profil; profil (Profili düzenle / Profili paylaş, ızgara/reels/etiketlenen, görüntülenme sayıları); **Profesyonel pano** (İstatistikler satırları + Araçların + ⚙); **İstatistikler** (Genel bakış / İçerik / Hedef kitle, macenta çizgi grafik). Hiçbir yerde "simülasyon" yazmıyor; senaryo modu göstergeleri varsayılan kapalı (`settings.showSimulationBadge`).

### Senaryo (simülasyon) modeli
`realValue / overrideValue / displayValue` katmanı + senaryo geneli **büyüme oranı (%)** (`services/simulation/growth.ts`, metrik başına esneklik, gönderi başına ±%4 deterministik sapma). Çözüm sırası: açık override > büyüme > gerçek. Store: `store/simulationStore.ts`.

---

## 3. Bugün yapılanlar (2026-09-15)

### 3.1 Herkese açık profil — gerçekten çalışır hale getirildi
Sorun: Instagram'ın JSON uç noktaları (`web_profile_info`, GraphQL) anonim isteklere **429 / "Please wait a few minutes"** dönüyordu.
Çözüm: Instagram'ın **mobil tarayıcıya verdiği HTML sayfaları** veriyi gömülü JSON olarak içeriyor ve engellenmiyor.

Akış (`services/instagram/PublicInstagramProvider.ts` + `services/instagram/publicWebParser.ts`):
1. `GET https://www.instagram.com/<kullanıcı>/` (iPhone Safari UA, `Accept-Language: en-US`) → `parseProfilePage()`:
   - `xig_user_by_igid_v2` → takipçi/takip/bio/avatar/doğrulama/gizlilik (`pk` = hesap id)
   - `polaris_timeline_connection` → **son 12 gönderi** (pk, görsel, açıklama, tür, sabitlenmiş, `end_cursor`)
   - `og:description` → gönderi sayısı ("32K Posts" → 32000)
   - `LSD` + `csrf_token` → sayfalama için
   - Olmayan kullanıcı → Instagram genel hata sayfası (`"pageID":"httpErrorPage"`) → `error_page` → uygulamada `not_found`
2. Gönderi başına `GET https://www.instagram.com/p/<kod>/embed/captioned/` → `parseEmbedPage()`:
   - Video/albüm: `contextJSON` → `edge_liked_by.count`, `edge_media_to_comment.count`, `video_view_count`, `video_duration`, `video_url`, çocuklar, müzik (`clips_music_attribution_info`)
   - Fotoğraf: görünen metin "14,568 likes" / "85 comments"
   - 4 paralel istek, ~2 sn; 6 saat AsyncStorage önbelleği (`sociallens.public.post.v1.<kod>`); 3 ardışık hata veya 429 → durur, tahminler kalır
3. Sayılar gelene kadar `estimatePublicCounts()` (takipçiye göre ölçeklenen, pk ile tohumlanmış geçici tahmin, `countsEstimated: true`) gösterilir; gerçek sayılar arka planda gelince provider `subscribe()` ile bildirir → `useProviderRefinements()` (root layout'ta) React Query önbelleğini yeniler.
4. Kod: `shortcodeFromMediaId(pk)` (base64 alfabesi), `timestampFromMediaId(pk)` (Snowflake epoch 1314220021721 ms; ±3 saat hassasiyet).
5. Sayfalama (`getMedia(cursor)`): önce `doc_id=28473938932242567` (`PolarisProfilePostsLoggedOutTabGridUIContentQuery`, `x-fb-lsd`/`x-csrftoken` ile POST), sonra eski `query_hash`. **Bu IP'den doğrulanamadı** (429); başarısızsa liste 12 gönderide kalır (sessiz).
6. Yedekler sırayla: JSON `web_profile_info` (www → i.instagram) → `EXPO_PUBLIC_PUBLIC_PROFILE_PROXY_URL` proxy → son önbellek (stale).
7. `signInPublic()` sayfayı bir kez çeker, `primePublicSnapshot()` ile önbelleğe yazar; provider tekrar indirmez.

Uçtan uca test (Node, gerçek ağ, `scratchpad/e2e-public.js`):
```
@natgeo: 200, parse=ok, 616ms · 268.541.179 takipçi · 12 gönderi · embed 1981ms → gerçek beğeni/yorum/izlenme
@galatasaray: 200, parse=ok, 574ms · 18.166.467 takipçi · 12 gönderi
@thisuserdoesnotexist_xyz123 → error_page → Bulunamadı
```

Supabase proxy (`supabase/functions/public-profile/index.ts`) da aynı HTML+embed yolunu kullanacak şekilde yeniden yazıldı; `supabase/functions/_shared/publicWebParser.ts` uygulamadaki dosyanın **kopyasıdır — ikisini birlikte güncelle**.

Yeni/güncellenen alanlar (`types/app.ts` → `AppMedia`): `countsEstimated?`, `videoUrl?`, `durationSec?`, `music?`, `shareCount?`; `AppComment`: `replyCount?`, `isVerified?`.
Şema (`schemas/instagram.ts`): `video_url`, `video_duration`, `counts_estimated` (proxy'nin gönderdiği alanlar).
Testler: `__tests__/publicWebParser.test.ts` (12 test; sentetik HTML fikstürleri).

### 3.2 Instagram ile giriş (canlı mod) — Expo Go'da da çalışacak şekilde
Meta yalnızca **HTTPS** redirect URI kabul ediyor ve Instagram Login **PKCE tanımlamıyor** (docs). Bu yüzden:
- **Backend köprüsü**: `GET /auth/instagram/redirect?code=&state=` (`supabase/functions/auth/index.ts`). `state` = base64url `{ n: nonce, r: return_to }`. Köprü `return_to` şemasını `APP_RETURN_SCHEMES` (varsayılan `sociallens,exp,exps`) ile doğrular ve 302 ile uygulamaya döner (`sociallens://oauth` build'de, `exp://…/--/oauth` Expo Go'da). `#_` eki temizlenir.
- `POST /auth/instagram/callback { code, state, redirect_uri }` — `redirect_uri` köprünün kendi URL'siyse otomatik kabul edilir (`bridgeUrl(req)`), ayrıca `META_ALLOWED_REDIRECT_URIS`.
- Uygulama (`services/auth/authService.ts` → `signInLive()`): PKCE kaldırıldı, `redirect_uri = META_REDIRECT_URI` (varsayılan `${API_URL}/auth/instagram/redirect`, `constants/config.ts`), `returnTo = AuthSession.makeRedirectUri({scheme:'sociallens', path:'oauth'})`, `openAuthSessionAsync(authUrl, returnTo)`, state eşleşmesi doğrulanır. `isExpoGo` engeli kaldırıldı.
- İzinler: `instagram_business_basic, instagram_business_manage_insights, instagram_business_manage_comments` (yorumları **okumak** için; yazma/yayınlama yok).
- Yeni edge rotaları (`supabase/functions/instagram/index.ts`): `GET /instagram/insights/audience` (follower_demographics age/gender/city/country + views follower_type + online_followers) ve `GET /instagram/media/:id/comments`.
- Meta provider: `getComments()` eklendi; `getAudience()` zaten vardı.

### 3.3 Akış ve Yorumlar (kullanıcının ekran görüntülerine göre)
- `components/feed/PostCard.tsx`: üst satırda kullanıcı adı + doğrulama, altında **♫ sanatçı · şarkı** (reels; mock verisinde `REEL_AUDIO`, public'te embed'den), sağda iki çizgili "daha fazla" ikonu, videoda sağ altta **sessiz** rozeti; aksiyon satırı **♡ 118 · 💬 54 · ↻ 2 · ✈ … 🔖** (sayılar ikonların yanında; ↻ = paylaşım sayısı, `useContentPerformance` → `shares`), altında tek satır açıklama + gri **"devamı"**, sonra **"56 dakika önce"** göreli zaman. Herkese açık hesaplarda **"Takip Et"** pill'i (`showFollow`). "N beğenme" satırı ve "yorumların tümünü gör" kaldırıldı (Instagram'ın yeni görünümü).
- `components/feed/CommentsSheet.tsx` (yeni): alt sayfa "Yorumlar" başlığı, **"Senin için ˅"** sıralama, satırlar (avatar 40, kullanıcı adı + "10d", metin, "Yanıtla", "— 1 diğer yanıtı gör", sağda ♡ + sayı), altta **hızlı emoji satırı** ❤️🙌🔥👏😢😍😮😂 ve **"Bunun hakkında ne düşünüyorsun?"** giriş kutusu (görsel + sticker ikonları). Yorum yoksa "Henüz yorum yok / Sohbeti başlat."
- Bağlantılar: `app/(tabs)/home.tsx` (yorum ikonuna basınca sheet), `app/media/[id].tsx` (satır içi yorum listesi kaldırıldı → sheet).
- Yorum verisi: demo → `buildMockComments`; canlı → Graph API; **herkese açık hesaplarda Instagram yorum metni vermiyor** → boş durum gösterilir (uydurma yorum üretilmiyor).
- Yeni ikonlar: `RepostIcon, MuteIcon, MoreLinesIcon, StickerIcon, MusicNoteIcon` (`components/icons/index.tsx`).
- i18n: `feed.more, feed.follow, comments.*` (tr/en).
- **Görsel doğrulama yarım kaldı** (kullanıcı "dur" dedi): tsc/lint/jest geçiyor; web'de üst başlık + müzik satırı görüldü, aksiyon satırı ve sheet ekran görüntüsü alınmadı. İlk iş: `npx expo start` → Home'da bir gönderide yorum ikonuna bas, sheet'i ve aksiyon satırını ekran görüntüleriyle karşılaştır.

### 3.4 Diğer
- `.gitignore`: `.env` artık **commit ediliyor** (secret yok); `supabase/.env` hâlâ hariç.
- README §5 (herkese açık) ve §6/§8 (Instagram ile giriş, 10 dakikalık kurulum) güncellendi.
- `app/_layout.tsx`: `<ProviderRefinements />` eklendi.

---

## 4. Yarım / bekleyen işler (öncelik sırasıyla)

1. **Telefonda herkese açık hesabı dene** (Expo Go, mobil veri ve Wi-Fi ile): Ara → `natgeo`. Beklenen: ~1 sn'de profil + 12 gönderi, ~2–3 sn sonra gerçek beğeni/yorum sayıları. Sorun olursa `services/instagram/PublicInstagramProvider.ts` → `fetchProfileFromHtml`/`fetchEmbedDetails` loglarına bak. RN `fetch` `User-Agent` başlığını gönderir; iOS'ta cookie'ler otomatik.
2. **Sayfalama** (12'den fazla gönderi): GraphQL isteği bu IP'den test edilemedi. Telefonda "daha fazla" yüklenmiyorsa `fetchTimelinePage()` içindeki başlıkları/`doc_id`'yi tarayıcıdan (instagram.com, çıkış yapmış, mobil görünüm, Network sekmesi) yeniden al.
3. **Instagram ile giriş** — kurulum adımları README §6'da. Özet: Meta uygulaması (Instagram → API setup with Instagram login) → OAuth redirect URI olarak `https://<ref>.supabase.co/functions/v1/auth/instagram/redirect` → `supabase link/db push/secrets set/functions deploy auth instagram public-profile` → `.env`: `APP_MODE=live`, `API_URL`, `META_APP_ID`. Hesap Business/Creator olmalı; geliştirme modunda Instagram Testers listesine ekle. Köprü ve kitle rotası **canlı ortamda test edilmedi** (Meta hesabı yok).
4. **Akış/Yorumlar görsel kontrolü** (§3.3 son madde). Küçük iyileştirmeler: hikaye halkası gradient; "Takip Et" pill'inin yalnızca public'te görünmesi (yapıldı); reels'te ses satırı.
5. Public/manual hesaplar için "Etiketlenen" sekmesi boş (Instagram vermiyor) — istenen davranış.
6. Eski doküman notu: `README.md` §14 mimari bölümünde `fetchPublicUser` adı geçiyorsa `fetchPublicProfile` olarak güncelle (fonksiyon yeniden adlandırıldı).

---

## 5. Dosya haritası (en çok dokunulanlar)

```
app/(tabs)/home.tsx            akış (PostCard + CommentsSheet + PostOptionsSheet)
app/(tabs)/search.tsx          kullanıcı adı ile herkese açık hesap açma (signInPublic)
app/(tabs)/profile.tsx         Instagram profili
app/dashboard/index.tsx        Profesyonel pano
app/insights/index.tsx         İstatistikler (?tab=overview|content|audience)
app/media/[id].tsx             gönderi detayı + içgörüler
app/(auth)/connect.tsx         bağlantı ekranı (Instagram ile Bağlan / public / manuel / demo)
components/feed/PostCard.tsx   akış kartı (yeni görünüm)
components/feed/CommentsSheet.tsx  yorumlar alt sayfası (yeni)
components/common/BottomSheet.tsx  alt sayfa altyapısı
services/instagram/publicWebParser.ts      HTML/embed ayrıştırıcı (saf fonksiyonlar, Deno kopyası _shared'da)
services/instagram/PublicInstagramProvider.ts  herkese açık sağlayıcı (HTML → embed → önbellek → sayfalama)
services/instagram/normalize.ts            Meta/HTML/JSON → AppAccount/AppMedia; estimatePublicCounts, applyEmbedDetails
services/instagram/MetaInstagramProvider.ts canlı sağlayıcı (backend proxy)
services/auth/authService.ts   signInDemo / signInPublic / signInManual / signInLive / signOut
features/instagram/hooks.ts    React Query hook'ları (+ useProviderRefinements)
features/simulation/useSimulation.ts   senaryo katmanı
constants/config.ts            env, redirect URI, izinler, önbellek süreleri
supabase/functions/auth        OAuth köprüsü + kod değişimi + oturum
supabase/functions/instagram   Graph API proxy (account, media, insights, audience, comments)
supabase/functions/public-profile  herkese açık profil proxy'si (HTML+embed)
__tests__/                     8 suite (publicWebParser, normalize, growth, simulation, …)
docs/                          orijinal Türkçe spesifikasyon (14 dosya)
```

## 6. Kurallar (docs/ ve kullanıcı isteklerinden)
- Uygulamada Instagram kullanıcı adı/şifre alanı **yok**; giriş yalnızca Instagram'ın resmi sayfasında.
- App Secret / access token **asla** mobil bundle'a girmez (backend, AES-256-GCM).
- Gerçek veriler salt okunur; beğeni/izlenme/yorum sayısını değiştiren bot/API yok.
- Arayüzde "simülasyon" kelimesi geçmez ("Senaryo"); rozet/banner varsayılan kapalı.
- Uygulamada Instagram'da olmayan ekstra öğe olmasın (ekstra araçlar ⚙ altında).
- Uydurma içerik gerçek hesaplara atfedilmez (herkese açık hesaplarda yorum metni gösterilmez, sayılar gerçek).

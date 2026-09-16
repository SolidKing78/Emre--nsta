# SocialLens — Devir-Teslim Notu (başka PC'de devam etmek için)

Tarih: 2026-09-16 · Durum: **tsc temiz · lint temiz · jest 19 suite / 192 test geçiyor (bileşen + etkileşim testleri dâhil) · `expo export --platform android` başarılı · web'de demo akışı uçtan uca çalıştırıldı (aşağıda)**

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

### 3.5 Video oynatma (herkese açık hesaplar dahil) — `expo-video`
- Paket: `expo-video ~57.0.4` (`npx expo install`), `app.json` plugin eklendi; Expo Go'da çalışır, native build gerekmez.
- Veri: profil HTML sayfası video URL'si **vermiyor**; embed sayfası (`/p/<kod>/embed/captioned/`) `video_url` (mp4, ~32 saat geçerli imzalı CDN linki) veriyor → zaten `applyEmbedDetails` ile `AppMedia.videoUrl` alanına yazılıyordu. Yeni: albüm çocukları için `AppMediaChild.videoUrl`; Meta Graph için `media_url` (mp4) → `videoUrl`.
- `components/feed/MediaVideo.tsx`: `useVideoPlayer` + `VideoView`; kapak (`poster`) ilk kare gelene kadar üstte; hata olursa `refreshPublicVideoUrl()` (embed'i önbelleksiz yeniden okur) ile **bir kez** link yenilenir, yine olmazsa kapak kalır. Oynatıcı durumu `drive()` yardımcısıyla effect içinde sürülür (React Compiler lint kuralı).
- Yalnızca **ekrandaki** kart oynatıcı oluşturur: `home.tsx`, `media/[id].tsx`, `reels.tsx` `onViewableItemsChanged` (eşik %55–60) ile `active` id'yi tutar. Feed: sessiz başlar, videoya tek dokunuş sesi açar/kapatır (`store/playbackStore.ts` → oturum boyunca hatırlanır; rozet MuteIcon/SoundIcon). Reels: sesli, dokununca durur (PlayIcon overlay).
- Web'de sesli otomatik oynatma tarayıcı tarafından engellenebilir (Reels sekmesi); telefonda sorun yok.

### 3.6 "Etkileşimi artır" (senaryo) — `services/simulation/boost.ts`
- Beş kadran (`BoostKey`: followers · plays · views · likes · comments), her biri kendi yüzdesi, `SimulationProfile.boosts`.
- Hangi metriği sürdüğü `ACCOUNT_TARGETS` / `MEDIA_TARGETS` / `DERIVED_WEIGHT` tablolarında: takipçi → followers, new_followers, follows_from_post · izlenme (plays) → gönderi views/replays, reach ×0,85, profile_visits ×0,6 · görüntülenme (views) → hesap views, reach ×0,85 · beğeni/yorum → likes/comments; interactions & accounts_engaged = set edilen beğeni/yorum kadranlarının ortalaması.
- **Bağlaşık model (kullanıcı isteği: "birini artırınca diğerleri de yükselsin")**: her ayarlı kadran toplam ilgide bir artış ima eder (`DIAL_UPSTREAM`: views/plays 1, likes 0,8, comments 0,7, followers 0,6); sinyaller + büyüme oranı `combine()` ile birleşir (en büyük mutlak değer önder + diğerlerinin çeyreği); kadranın adlandırmadığı her metrik `GROWTH_ELASTICITY` ile bu gizli ilgiyi izler (`boostPercentFor(boosts, scope, metric, growthPercent)`). Etkileşim/accounts_engaged = beğeni·yorum·paylaşım·kaydetme etkin değişimlerinin ortalaması (kadran adlandırıyorsa tam değeri). `effectiveDial()` editörde "diğer ayarlarla birlikte" satırını besler. Çözüm sırası (`resolveMetric`): **açık override > kadran (doğrudan ya da indüklenmiş) > büyüme oranı > gerçek**. Gönderi başına ±%4 deterministik sapma korunur; `avg_watch_time` 1 ondalık.
- UI: `components/simulation/EngagementBoostEditor.tsx` (satıra dokun → slider + hazır yüzdeler + yazı kutusu; "Artışı uygula" hepsini birden yazar; "Artışları kaldır"). Senaryo Laboratuvarı'nda kart olarak, Profesyonel pano ⚙ menüsünde ve gönderi istatistikleri ⋯ menüsünde sheet olarak.
- Store: `setBoost/setBoosts/clearBoosts`; `resetAll` kadranları da temizler; `duplicateProfile` kadranı ve büyüme oranını kopyalar. Hook: `useBoosts()`; `resolveWithGrowth(..., boosts)` 7. parametre — `useContentPerformance`, `useMediaDetail`, `compare.tsx` geçiyor.
- Yeni metrik anahtarı `reposts` (Yeniden paylaşım) ve `SIMULATABLE_MEDIA_METRICS`'e `reposts`, `profile_visits` eklendi.

### 3.7 Kendi profil + "Gönderiler" + "Gönderi istatistikleri" (kullanıcının ekran görüntüleri)
- **Profil** (`ProfileHeader` `own` prop, public hesaplarda kapalı): avatar üstünde not balonu (demo: `MOCK_NOTE`, yoksa "Not…"), avatarda **+** rozeti, ad yanında onaylı değilse kesikli rozet (`VerifiedOutlineIcon`), bio altında **Threads pill + "+ Ekle"**, istatistik yazıları 19/14. Üst barda Threads ikonu (threads.net/@kullanıcı). Profesyonel pano satırı korunuyor.
- **Gönderiler** (`app/media/[id].tsx` yeniden yazıldı): dokunulan gönderi en üstte, altında eskiler (FlatList, `media.slice(index)`), başlık sola yaslı. `PostCard own`: medya altında **"👁 N · İstatistikleri gör" + mavi "Gönderiyi Öne Çıkar"** (IG-only sheet → Instagram'ı aç); aksiyon satırında sayılar **yalnızca >0 iken** ikon yanında (♡ 💬 ↻ ✈ — paylaşım sayısı artık ✈ yanında); demo'da beğenen avatar dizisi (`likerAvatars`, gerçek hesaplara uydurma kişi gösterilmez); açıklama + tarih ("12 Nisan" / "19 Ekim 2025"). Eski `?insights=1` linki yeni ekrana yönlendirir.
- **Gönderi istatistikleri** (`app/insights/post/[id].tsx`, yeni rota `/insights/post/<id>`): küçük resim (Reels 9:16), ♡ 💬 ↻ ✈ 🔖 sayıları, yapışkan sekmeler **Genel Bakış / Etkileşim / Hedef Kitle**. Genel bakış: Özet 2×2 (gönderi: Görüntülemeler · Erişilen hesaplar · Profil ziyaretleri · Takipler; Reels: Görüntülemeler · Görüntüleyenler · Ortalama izlenme süresi "30sn" · Takipler), gönderide "Başlıca görüntüleme kaynakları" çubukları, Reels'te "Zaman içindeki görüntülemeler" (Tümü / Takipçiler / Takipçi olmayanlar çipleri + çizgi grafik). Etkileşim: "Görüntülemeden sonra gerçekleştirilen eylemler" (Profil ziyaretleri, Takipler) + "Etkileşimler" (Beğenmeler, Yorumlar, Yeniden Paylaşımlar, Paylaşımlar, Kaydetmeler) (+ Reels bölümü, izlenme eğrisi). Hedef kitle: Takipçiler (magenta) / Takipçi olmayanlar (mor) çubukları + Yaş / Ülke / Cinsiyet çipleri. ⓘ → açıklama sheet'i. Başlık sağında yalnızca Instagram Android'deki gibi 📈 (dokun → hesap istatistikleri; **uzun bas → senaryo menüsü**: Senaryo modu anahtarı, Etkileşimi artır, Bu gönderi için senaryo, Bu gönderiyi gerçek değerlere döndür). Gönderi küçük resmi kare, Reels 9:16.
- **Her sayı senaryo katmanından geçer** (`useDisplayMetrics(mediaScope)`): uzun basınca (senaryo açıkken tek dokunuşla) `SimulationMetricEditor` açılır; kadranlar ve büyüme oranı otomatik uygulanır. Kaynağın vermediği alanlar (`profile_visits`, `reposts`, Reels `avg_watch_time`/`replays`, görüntüleme kaynakları, takipçi payı, günlük seri) `services/analytics/postInsights.ts` ile gönderi id'sine göre **deterministik** üretilir (`completePostMetrics`, `buildPostBreakdown`, `buildPostViewSeries`); `app/simulation/media/[id].tsx` de aynı seti listeler → düzenlemeler birebir eşleşir.
- **Uzun basma**: senaryo editörünü açan her uzun basma `touch.longPressMs` (650 ms) kullanır; senaryo modu açıkken **tek dokunuşla açılma kaldırıldı** (MetricRow, MetricCard, İstatistikler sekmeleri, gönderi istatistikleri). Profilde **"Profesyonel pano" satırına uzun basınca** bütün sayfa için senaryo kadranları (`EngagementBoostSheet`) açılır → takipçi, tüm gönderilerin izlenme/beğeni/yorumu birlikte artar. Gönderi istatistikleri Özet kartları Reels'te de aynı dört kart (Görüntülemeler · Erişilen hesaplar · Profil ziyaretleri · Takipler); izlenme süresi Etkileşim sekmesinde.
- **Tutarlılık kuralları** (aynı gönderi her ekranda aynı sayı): beğeni/yorum/izlenme akışta `useEffectiveMedia`, ızgara/✈/İçerik sekmesinde `applyMediaOverrides` (içgörü), Gönderi istatistiklerinde `completePostMetrics`+overlay ile çözülür — üçü de aynı gerçek değer + aynı tohum (`<id>:<metrik>`) → aynı sonuç. Yeniden paylaşım tek fonksiyondan (`estimateReposts`) gelir ve içgörüye eksikse eklenip kendi tohumuyla çözülür; `ContentPerformance.reposts` alanı eklendi (İçerik sekmesi artık `shares×0,35` kullanmıyor). Senaryo gönderileri de kadranları/büyümeyi izler. Hesap düzeyi "Etkileşimler" = parçaların paylarına göre ağırlıklı değişim (beğeni 0,78 · yorum 0,07 · paylaşım 0,06 · kaydetme 0,09). Growth Lab bilerek gerçek veride kalır.
- **Metrik düzenleme kaydırıcısı** (`SimulationMetricEditor`): sabit 1 Mn üst sınır kaldırıldı; aralık gerçek değerin 10× / 100× / 1000× katı (çiplerle seçilir, 1/2/5×10ⁿ'e yuvarlanır), adım = aralık/500, giriş kutusunun iki yanında −/+ düğmeleri (gerçek değerin %5'i). 37 beğenilik gönderide bir tık ≈ 1, milyonluk Reels'te ≈ 20 bin.
- Testler: `__tests__/boost.test.ts` (16), `__tests__/postInsights.test.ts` (4), `format.test.ts` +1. Toplam **11 suite / 79 test**. `__tests__/scenarioConsistency.test.ts` (6): dört senaryoda aynı gönderinin beğeni/yorum/izlenme/paylaşım/kaydetme/yeniden paylaşım sayısının akış kartı, performans (ızgara · ✈ · İçerik sekmesi) ve Gönderi istatistikleri ekranında **birebir aynı** çıktığını, etkileşimin parçaların toplamı olduğunu ve hesap değerlerinin aynı yönde hareket ettiğini doğrular.

### 3.11 Tipografinin ölçülmesi, test altyapısı ve tam entegrasyon

**Yazı tipi tahmin değil, ölçüldü.** Ekran kaydından kesilen metinler Inter'de 100px'te render edilip iki mürekkep kutusunun oranı alındı (kayıt 576px genişlikte, 393pt cihaz → 1.466 px/pt):
- **Genişlik**: Instagram'ın fontu, aynı mürekkep yüksekliğinde Inter'den yalnızca **%0,8–2,7 daha geniş**. Yani Inter doğru seçim; harf formları da üst üste bindirildiğinde örtüşüyor (`ş`, `ı`, `ğ`, `ö` dâhil).
- **Harf aralığı**: bu yüzden eklediğim negatif tracking (−0,1 … −0,5) **yanlış yöndeydi** — metni Instagram'dan daha da dar yapıyordu. `letterSpacingFor` artık her boyutta **0** döndürüyor ve neden'i kodda yazılı (`constants/theme.ts`).
- **Boyutlar** (ölçülen → uygulanan): bölüm başlığı 16,3–16,4pt → `heading` **20→18**; özet kartı etiketi 12,4pt → `body`(15) yerine **`caption`(13)**; özet kartı değeri 20,0/20,3pt (iki bağımsız dize aynı sonucu verdi) → **26→22**; faktör alt başlığı 12,0pt → **`caption`**; çubuk değeri 15,3pt → boyut `bodyStrong`(15)'te kaldı, sadece **kalınlık 700** (videodaki fark boyut değil kalınlıkmış). Çubuk etiketi (15,1pt), sekme etiketi (14,5pt), faktör etiketi (14,5pt) ve trend satırı (12,2pt) zaten doğruydu.
- Ölçülen değerler `__tests__/fonts.test.tsx` içinde kilitli — biri "daha büyük olsun" diye geri almasın diye.

**Klip önizlemesi gerçek oynatıcı**: videoda "İnsanların Reels videonu izleme süresi" başlığının altındaki küçük kare, kapak değil **oynayan videonun kendisi**. Artık `MediaVideo` (sessiz, döngülü) kullanılıyor; video olmayan gönderilerde kapak karesine düşüyor.

**Test altyapısı** (ilk kez bileşen testleri):
- `__mocks__/react-native-reanimated.js` ve `__mocks__/react-native-gesture-handler.js` — Reanimated 4 jest'te native worklet runtime istediği için kök `__mocks__` klasöründen otomatik devreye giriyor; her suite karşılıksız yararlanıyor.
- `__tests__/helpers/render.tsx` — sağlayıcılar + `texts` / `allText` / `byLabel` / `editViaLongPress` yardımcıları.
- Yeni suite'ler: `fonts.test.tsx` (11), `postInsightsScreen.test.tsx` (21), `accountAudienceTab.test.tsx` (4), `audienceMixEditor.test.tsx` (7), `postStatsStore.test.ts` (18), `reelInsights.test.ts` (27), `audienceMix.test.ts` (10) + mevcutlar. Ekran testleri üç sekmeyi de mount ediyor, **her uzun basma → düzenle → uygula akışını** uçtan uca yürütüyor, fotoğraf/Reels ayrımını, senaryo açık/kapalı, kadran, büyüme oranı, senaryo değiştirme, tüm çubukların sabitlenmesi ve **TR/EN** durumlarını kapsıyor.
- Bu testler üç gerçek hata yakaladı: yüzdelerin `+%38,6` diye işaretli çıkması, hesap ekranında `%93,0` gibi gereksiz ondalık, ve çubuk değerinin boyutunun yanlış büyütülmesi.

**Tam entegrasyon** (artık hiçbir istatistik simülasyon dışında değil):
- **Hesap istatistikleri ekranındaki yaş / şehir / ülke çubukları da uzun basılıp ayarlanabiliyor** (`accountStats`, `setAccountStat`). Aynı `StatPercentSheet` hem gönderi hem hesap düzeyini yönetiyor; hesap düzeyinde "Bu değer hesabın tamamı için geçerlidir" diyor. `useEffectiveAudience` bunları uygulayıp toplamı 100'de tutuyor.
- **`resetAll` artık gerçekten her şeyi sıfırlıyor**: senaryo override'ları + büyüme + kadranlar + kitle dağılımı + gönderi başına bölünmeler + tüm elle ayarlı yüzdeler (hesap ve gönderi). Yarısı simüle kalan bir "sıfırla" hiç sıfırlamamaktan kötüydü.
- **Senaryo Laboratuvarı'ndaki gönderi rozetleri** artık üç şeyi birden sayıyor: sayı override'ları, kitle bölünmesi ve yüzdeler (`countPostEdits` / `usePostEditCount`, canlı güncelleniyor). `/simulation/media/<id>` ekranı elle ayarlı yüzde sayısını gösteriyor ve gönderi istatistiklerine götürüyor; oradaki "gerçek değerlere döndür" de üçünü birden temizliyor.
- Senaryo store'u **version 5**.

### 3.10 Gönderi istatistikleri ekranı, iOS Instagram'a birebir (kullanıcının ekran kaydı)

Kullanıcının gönderdiği ekran kaydı (iOS, "Reels videosu istatistikleri") kare kare çıkarılıp eksik bölümler eklendi. Ekranın son hâli (`app/insights/post/[id].tsx` yeniden yazıldı):

**Başlık** — sağda artık Instagram'daki gibi tek bir hapta **📈 + ⋯** var (eskiden yalnızca 📈 vardı, menü uzun basışla açılıyordu). ⋯ → senaryo menüsü (senaryo modu, Etkileşimi artır, Bu gönderinin kitlesi, Bu gönderi için senaryo, gerçek değerlere döndür).

**Genel Bakış**
- **Özet** kartları Reels'te değişti: Görüntülemeler · **Görüntüleyenler** · **Ortalama izlenme süresi** · Takipler (gönderide eskisi gibi Görüntülemeler · Erişilen hesaplar · Profil ziyaretleri · Takipler).
- **Zaman içindeki görüntülemeler** artık günlük çizgi grafik değil: **kümülatif iki eğri** — bu gönderi (dolu macenta) ve *tipik gönderin* (kesikli gri) — 0 / ortadaki / son etiketiyle bir zaman penceresinde (`buildViewsOverTime`: pencere gönderinin yaşına göre 6h → 12h → 24h → 3d → 7d → 30d → 90d → 1y; gönderinin eğrisi kendi yaşında biter, tipik eğri pencerenin sonuna kadar gider). Yeni bileşen `components/charts/ComparisonChart.tsx`, altında nokta göstergeli açıklama.
- **Görüntülemelerini etkileyen faktörler** (yeni): "Oranlar, erişim için önem sırasına göre listelenir." + 6 satır — Geçme · Paylaşım · Beğenme · Kaydetme · Yeniden paylaşım · Yorum oranı. Her satır: daire içinde ikon, oran, altında *Daha yüksek / Ortalama / Daha düşük*. **Yalnızca iyi haber yeşil**: geçme oranının yükselmesi yeşil değildir. Oranlar gönderinin kendi sayılarından türer (beğeni ÷ görüntüleme), yani senaryo kadranını açınca beğenme oranı da yükselir. `components/analytics/insights/FactorList.tsx`, yeni ikon `SkipRateIcon`.
- **İnsanların Reels videonu izleme süresi** (yeni): küçük klip önizlemesi + %100'den başlayıp sönen izlenme eğrisi, x ekseni 0:00 → klip süresi (`components/charts/PlaybackChart.tsx`). Kaynak gerçek retention veriyorsa o kullanılır.
- **Başlıca görüntüleme kaynakları** artık Reels'te de görünüyor (eskiden yalnızca fotoğrafta). Reels kaynak ağırlıkları videodaki dağılıma çekildi: Reels sekmesi ~%62–82, Keşfet, Akış, Profil, Hikayeler ("Diğer" kaldırıldı).
- **Reklam** (yeni): "Bu Reels videosunu öne çıkar" satırı → Instagram'a devreden sheet.

**Etkileşim** — Görüntülemeden sonra gerçekleştirilen eylemler + Etkileşimler listeleri aynı; sonuna **"İnsanlar Reels videonu gördüğünde"** (klip önizlemesi + dikenli etkileşim eğrisi, y ekseni 0/15/30 %) eklendi. Eski "Reels" bloğu (görüntülemeler / ortalama izlenme / tekrar izleme + retention) kaldırıldı — iOS'ta orada yok, izlenme süresi Özet'te.

**Hedef Kitle** — Reels videonu görüntüleyen kişiler (Takipçiler macenta / Takipçi olmayanlar mor) + Yaş / Ülke / Cinsiyet çipleri; cinsiyet satırı **Erkekler önce**.

**Her sayı uzun basılıp değiştirilebilir** (kullanıcının açık isteği):
- Sayılar (beğeni, yorum, görüntüleme, erişim, profil ziyareti, takip, ortalama izlenme süresi…) eskisi gibi senaryo katmanından (`SimulationMetricEditor`).
- **Yüzdeler yeni**: faktör oranları, görüntüleme kaynakları, yaş ve ülke çubukları, izlenme eğrisinin kuyruğu, etkileşim eğrisinin tepesi, tipik gönderi eğrisi — hepsi gönderi başına `mediaStats` override'ı (`store/simulationStore`, **version 4**), noktalı anahtarla: `factor.likes`, `source.reels`, `age.18-24`, `country.Türkiye`, `watch.end`, `engagement.peak`, `views.typical`. Uzun basış → `components/simulation/StatPercentSheet.tsx` (ortak `PercentField` kaydırıcı + sayı kutusu + hazır yüzdeler); "Gerçek değere dön" tek değeri geri verir, ⋯ → "Bu gönderiyi gerçek değerlere döndür" hepsini.
- Bir çubuğu elle ayarlayınca **kalanlar oranlarını koruyarak yeniden dağıtılır**, toplam 100'de kalır (`applyBucketOverrides`).
- Takipçi / cinsiyet oranları §3.9'daki kitle dağılımından gelir (uzun basış → `AudienceMixSheet`).

**Yüzde biçimi** — Instagram tam sayıyı ondalıksız yazar: `%92`, `%2,8`; `formatShare` (`utils/format.ts`) bunu yapar ve işaret koymaz (eskiden `formatPercent` `+%92,0` üretiyordu). `InsightBars` satırları artık uzun basılabilir ve elle ayarlanmış değeri senaryo renginde gösterir.

**Testler** — `__tests__/reelInsights.test.ts` (15) ve **ilk bileşen testi** `__tests__/postInsightsScreen.test.tsx` (4): ekran gerçekten mount edilip üç sekmenin bölüm başlıkları ve yüzde biçimi doğrulanıyor. Reanimated 4 jest'te native worklet runtime istediği için test dosyası içinde elle stub'lanıyor; `SafeAreaProvider` `initialMetrics` ile sarmalanıyor. Bu test zaten bir gerçek hatayı yakaladı (yüzdeler `+` işaretiyle çıkıyordu).

**Bilerek yapılmayan**: ekran kaydında sayı ayıracı Türkçe'de de ABD biçiminde ("1,467"); uygulama yerel biçimi koruyor ("1.467"). Değiştirilmesi bütün ekranları etkilerdi.

### 3.9 Kitle dağılımı (takipçi payı + cinsiyet) ve uygulama yazı tipi

**Kitle dağılımı** — istatistiklerdeki iki oran artık tahmin değil, ayar:
- Varsayılan **%0,7 takipçi / %99,3 takipçi olmayan** ve **%7 kadın / %93 erkek** (`DEFAULT_AUDIENCE_MIX`, `types/simulation.ts`).
- Her gönderi temel değerin **±sapma** kadar etrafında kendi oranını alır (varsayılan takipçi ±%0,4, cinsiyet ±%2 → 5/95, 6/94, 8/92 gibi), sapma gönderi id'sinden türetildiği için **deterministik**: aynı video her açılışta aynı oranı gösterir. `services/analytics/audienceMix.ts` (`followerSplitFor`, `genderSplitFor`, `varyAround`, `normalizeMix`).
- Elle düzenleme: **Senaryo Laboratuvarı → "Kitle dağılımı" kartı** (hesap geneli), **İstatistikler → Hedef kitle → cinsiyet çubuklarına uzun basış**, **Gönderi istatistikleri → ⋯ → "Bu gönderinin kitlesi"** ve **Hedef kitle sekmesindeki çubuklara uzun basış** (yalnız o gönderi), **`/simulation/media/<id>` kartı**. Bileşen: `components/simulation/AudienceMixEditor.tsx` (kaydırıcı + sayı kutusu + hazır yüzdeler; takipçi kaydırıcısı karesel ölçekli, çünkü 0–100 doğrusal bir kaydırıcıda %0,7 seçilemiyor). Gönderi ayarı "Genel dağılıma dön" ile sapmaya iade edilir.
- Store: hesap düzeyinde `audienceMix` + `mediaAudienceMix` (senaryoya değil hesaba bağlı; senaryo değiştirmek oranları değiştirmez), `setAudienceMix / resetAudienceMix / setMediaAudienceMix / clearMediaAudienceMix`. **Senaryo store'u `version: 3`** — eski kayıtlar sanitizer üzerinden varsayılanlara oturur.
- Okuma tarafı tek yerden: `features/analytics/useAudienceSplits.ts` → `useEffectiveAudience()` (sağlayıcı ne döndürürse döndürsün iki oranı karışımdan yazar; yaş/şehir/ülke/aktif saatler olduğu gibi kalır) ve `usePostAudienceSplits(mediaId)`. `useInsightsData`, `AudienceTab`, `OverviewTab` ve gönderi istatistikleri aynı kaynağı okuduğu için hesap ve gönderi ekranları birbiriyle çelişmiyor. `estimateAudience` / `DEMO_AUDIENCE` / `buildPostBreakdown` da karışımı kullanıyor (eski rastgele %28–68 kadın ve %30–65 takipçi payı kaldırıldı). Hem hesap hem gönderi çubuklarında **erkek satırı önce** (Instagram büyükten küçüğe sıralar).
- Testler: `__tests__/audienceMix.test.ts` (10) + `postInsights.test.ts` güncellendi + `persistence.test.ts`'e v3 / karışım doğrulaması eklendi.

**Yazı tipi** — Instagram'ın Instagram Sans'ı lisanslanamıyor; en yakın karşılığı olan **Inter**'in dört statik kesimi pakete eklendi (`assets/fonts/Inter-{Regular,Medium,SemiBold,Bold}.ttf`, Google Fonts).
- `constants/fonts.ts`: `fontStyleForWeight(weight)` → `{ fontFamily, fontWeight }` çifti. **İkisi birlikte kullanılmalı**: Android özel bir aile atandığında `fontWeight`'i yok sayar (kalınlık aile adında olmalı), iOS önce aileyi çözüp ağırlığı uygular (uyuşmazsa başka kesim seçer).
- `constants/theme.ts` → `typography` her varyantta aileyi ve Instagram'ın sıkı harf aralığını taşır (`letterSpacingFor`: ≥24px −0,5 … ≤13px 0).
- `components/common/Text.tsx` tek geçiş noktası: varyanttan, `weight` prop'undan **veya çağıranın `style`'ındaki `fontWeight`'ten** gelen ağırlığı doğru Inter kesimine çevirir, harf aralığını son font boyutuna göre ayarlar. Ham `Text`/`TextInput` kullanan yerler (`Wordmark`, `AppErrorBoundary`, bütün giriş kutuları) `fontStyles.*` ile aynı aileye bağlandı.
- Yükleme: `app/_layout.tsx` içinde `useFonts(fontAssets)`; splash font hazır olana kadar açık kalıyor, yükleme başarısız olursa sistem fontuna düşülüp devam ediliyor. Native derlemede gömülmesi için `app.json` → `expo-font` eklentisi (APK/IPA için `expo prebuild` / EAS build gerekir).

### 3.8 Kalıcı senaryo hafızası ve çökme koruması
- `store/persistence.ts` → **`durableStorage`**: AsyncStorage sarmalayıcısı; hiç fırlatmaz, geçersiz JSON döndürmez, her yazımda `<anahtar>.bak` yedeği bırakır. Okumada asıl değer bozuksa yedek kullanılır (ve asıl onarılır), yedek de yoksa varsayılanlara dönülür. Yazma hataları sessizce yutulur (UI için asla ölümcül değil). Senaryo/ayar/manuel profil store'ları buna geçti; oturum SecureStore'da kaldı.
- **`hydrationHandler`**: rehydration hata verse bile `hydrated=true` (eskiden hata yolunda splash sonsuza kadar açık kalırdı — zustand `onRehydrateStorage(undefined, error)` çağırır, `state?.setHydrated` hiç çalışmazdı). Dört store da bunu kullanır; auth'ta "loading → signOut" mantığı korundu.
- Senaryo store'u **`version: 2`** + `migratePersisted` + doğrulayan `merge` (`sanitizePersisted`): profil/override/kadran/büyüme/senaryo gönderisi/profil düzenlemesi alanları tek tek doğrulanır, uymayan atılır, sayılar clamp'lenir, aktif profil yoksa ilki seçilir — bozuk bir kayıt en fazla o hesabın senaryosuna mal olur, uygulamaya değil. Eski v0/v1 kayıtlar veri kaybı olmadan taşınır. Ayarlar store'u enum doğrulaması, manuel profil store'u şekil doğrulaması yapar.
- **`components/common/AppErrorBoundary.tsx`** kökte (`app/_layout.tsx`, QueryClientProvider içinde): render hatası → "Bir şeyler ters gitti / Tekrar dene" ekranı, Expo Go kapanmaz; hook'suz yazıldı (tema/i18n sağlayıcısı bozulsa da çalışır), dev'de hata mesajını gösterir.
- Testler: `__tests__/persistence.test.ts` (10): yedek yazma/okuma, bozuk asıl → yedekten kurtarma, yedeksiz bozuk → temiz başlangıç, depolama hatasında fırlatmama, sanitize/migrate, **gerçek round-trip** (kaydet → "yeniden başlat" → aynı senaryo geri gelir; yarım kalmış dosya → yedekten geri gelir; çöp dosya → hydrated + temiz).

## 4. Yarım / bekleyen işler (öncelik sırasıyla)

0. **Web'de uçtan uca çalıştırıldı (Chrome, demo hesap)** — demo giriş → akış (own satırı "24,5 B · İstatistikleri gör", ikon yanı sayılar 1,2 B · 68 · 123) → Profil (not balonu, +, Threads pill, ızgara sayıları) → ızgara → "Gönderiler" (video `<video>` elemanı mount oldu, kaynak yüklendi, readyState 4; tarayıcı arka plan sekmesi olduğu için "video-only background media was paused" ile duraklattı — uygulama hatası değil) → "İstatistikleri gör" → Reels videosu istatistikleri üç sekme (Özet 4 kart, Zaman içindeki görüntülemeler grafiği, Etkileşim satırları, Hedef kitle çubukları) → Profil'de "Profesyonel pano" satırına **uzun basış** → Etkileşimi artır → Beğeni +%100 (Yorum satırı canlı "+%72 · diğer ayarlarla birlikte") → Uygula → takipçi 11,3 B→14 B, "Son 30 günde" 1,47 Mn→2,66 Mn, ızgara 24,5 B→44,4 B, akış 2,5 B · 114 · 228, Gönderi istatistikleri 2.548 · 114 · 22 · 228 · 283 / 44.402 — **hepsi birbiriyle tutarlı**. Bu turda yakalanan ve düzeltilen gerçek hata: `Invariant Violation: Changing onViewableItemsChanged on the fly is not supported` (hot reload sonrası) → üç listede de `viewabilityConfigCallbackPairs` `useState` içinde sabitlendi; görünürlük eşiği `viewAreaCoveragePercentThreshold: 40` (uzun gönderiler küçük ekranda da "aktif" olur). Demo Reels'lere örnek klipler eklendi (`SAMPLE_VIDEOS`, test-videos.co.uk, 10 sn / 1–2 MB) → video yolu demo'da da görülebilir. **Telefonda hâlâ denenmedi**: Expo Go → demo → akışta ilk Reels oynuyor mu (sessiz, dokununca ses) · Reels sekmesi sesli · Ara → `natgeo` → gerçek Instagram videosu.
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
app/media/[id].tsx             "Gönderiler" listesi (dokunulan gönderi üstte; 👁 N · İstatistikleri gör)
app/insights/post/[id].tsx     "Gönderi istatistikleri" / "Reels videosu istatistikleri" (3 sekme, ⋯ senaryo menüsü)
app/(auth)/connect.tsx         bağlantı ekranı (Instagram ile Bağlan / public / manuel / demo)
components/feed/PostCard.tsx   akış kartı (own satırı, >0 sayılar, facepile, satır içi video)
components/feed/MediaVideo.tsx expo-video oynatıcı (kapak, sessiz/sesli, link yenileme)
components/simulation/EngagementBoostEditor.tsx  "Etkileşimi artır" kadranları (kart + sheet)
services/simulation/boost.ts   kadran → metrik eşlemesi, applyBoost
services/analytics/postInsights.ts  gönderi istatistikleri için deterministik tamamlayıcılar
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

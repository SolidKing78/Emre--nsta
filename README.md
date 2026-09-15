# SocialLens · [Emre--nsta](https://github.com/SolidKing78/Emre--nsta)

Instagram deneyimine birebir yakın, **profesyonel Instagram analitik ve simülasyon** mobil uygulaması.
React Native + Expo + TypeScript ile yazılmıştır; Expo Go'da demo modunda tamamen çalışır.

- Instagram ile birebir aynı yapı: **Ana sayfa · Reels · Mesajlar · Ara · Profil** alt barı, profil (Profili düzenle / Profili paylaş, grid'de görüntülenme sayıları), **Profesyonel pano** (İstatistikler satırları + Araçların listesi) ve **İstatistikler** ekranı (Genel bakış / İçerik / Hedef kitle: pembe çizgi grafik, içerik türüne göre görüntülemeler ve etkileşimler, profil hareketleri, takipçi artışı, cinsiyet/yaş/şehir/ülke dağılımı)
- **Herkese açık bir Instagram hesabının** kullanıcı adını girerek gönderilerini ve profil sayılarını görüntüleme (salt okunur)
- **Simülasyon Modu**: takipçi, görüntülenme, erişim, beğeni, yorum… tüm istatistikleri **elle düzenleme**, senaryolar, önce/sonra karşılaştırma, hikaye boyutunda paylaşım kartı
- **Growth Lab**: deterministik öneri motoru (LLM bağımlılığı yok)
- Canlı mod: Meta/Instagram **resmi OAuth** + Supabase Edge Functions (token'lar yalnızca sunucuda, şifreli)

> Gerçek Instagram verisi hiçbir zaman değiştirilmez. Senaryo değerleri yalnızca cihazdaki overlay katmanında tutulur.

---

## İçindekiler

1. [Requirements (Gereksinimler)](#1-requirements-gereksinimler)
2. [Install (Kurulum)](#2-install-kurulum)
3. [Environment Variables](#3-environment-variables)
4. [Demo Mode](#4-demo-mode)
5. [Public Account Mode (Herkese açık hesap)](#5-public-account-mode-herkese-açık-hesap)
6. [Live Mode](#6-live-mode)
7. [Meta Developer Setup](#7-meta-developer-setup)
8. [OAuth Setup](#8-oauth-setup)
9. [Development Build](#9-development-build)
10. [Supabase Setup](#10-supabase-setup)
11. [Database Migration](#11-database-migration)
12. [Security Notes](#12-security-notes)
13. [Simülasyon Modu](#13-simülasyon-modu)
14. [Mimari](#14-mimari)
15. [Geliştirme ve Test](#15-geliştirme-ve-test)
16. [Kabul Testleri](#16-kabul-testleri)

---

## 1. Requirements (Gereksinimler)

| Araç | Sürüm |
|------|-------|
| Node.js | 20+ (22 önerilir) |
| npm | 10+ |
| Expo SDK | 57 (React Native 0.86, React 19.2) |
| Expo Go | SDK 57 ile uyumlu güncel sürüm (demo / herkese açık hesap modu) |
| EAS CLI | Canlı mod için (`npm i -g eas-cli`) |
| Supabase CLI | Canlı mod backend'i için |

## 2. Install (Kurulum)

### Başka PC'de hızlı kurulum (3 komut)

```bash
git clone https://github.com/SolidKing78/Emre--nsta.git
cd Emre--nsta
npm run setup
npm start
```

`npm run setup` otomatik olarak `.env` dosyasını oluşturur ve bağımlılıkları yükler. Ek ayar gerekmez — **demo modu** varsayılan olarak açılır.

**Windows (PowerShell):**
```powershell
git clone https://github.com/SolidKing78/Emre--nsta.git
cd Emre--nsta
npm run setup
npm start
```

**Gereksinimler:** Node.js 20+, npm 10+, telefonda [Expo Go](https://expo.dev/go) (SDK 57).

QR kodu Expo Go ile okutun. Uygulama açılır, **"Demo Hesapla Devam Et"** ile tüm ekranlar mock veriyle kullanılabilir.

### Manuel kurulum

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npx expo start
```

Faydalı komutlar:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (ESLint)
npm test            # jest
node scripts/generate-icons.js   # uygulama ikonlarını yeniden üret
```

## 3. Environment Variables

Mobil uygulama yalnızca `EXPO_PUBLIC_*` değişkenlerini okur. **Bu dosyaya asla secret koymayın** — bundle içine gömülür.

| Değişken | Açıklama |
|----------|----------|
| `EXPO_PUBLIC_APP_MODE` | `demo` (Expo Go) veya `live` (Development Build + backend) |
| `EXPO_PUBLIC_API_URL` | Backend taban URL'si, örn. `https://<ref>.supabase.co/functions/v1` |
| `EXPO_PUBLIC_META_APP_ID` | Meta uygulama ID'si (public identifier) |
| `EXPO_PUBLIC_META_REDIRECT_URI` | Meta konsolunda kayıtlı redirect URI, örn. `sociallens://oauth` |
| `EXPO_PUBLIC_PUBLIC_PROFILE_PROXY_URL` | (İsteğe bağlı) herkese açık profil proxy'si, örn. `https://<ref>.supabase.co/functions/v1/public-profile` |

Sunucu tarafı secret'ları (`META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) yalnızca `supabase/.env` içinde tutulur ve `supabase secrets set` ile yüklenir. Bkz. `supabase/.env.example`.

## 4. Demo Mode

`EXPO_PUBLIC_APP_MODE=demo` iken:

- Hesap: **@zmtprefabrik** (11.369 takipçi, 15 takip, 284 gönderi)
- Son 30 gün: 1.478.200 görüntülenme · 227.139 erişim · 4.824 profil ziyareti · 362 web tıklaması · 1.186 yeni takipçi
- 28 mock medya (14 gönderi, 9 Reel, 5 carousel), her biri farklı performans değerleriyle; Reels için retention eğrisi
- Hikayeler, öne çıkanlar, yorumlar ve etkinlik akışı

Demo verisi Meta API shape'ine yakın normalize edilmiştir (`mocks/mockData.ts`), UI bunun mock olduğunu bilmez.

## 5. Public Account Mode (Herkese açık hesap)

Bağlantı ekranında **"Herkese açık bir hesabı görüntüle"** → kullanıcı adı girin. Uygulama Instagram'ın giriş gerektirmeyen herkese açık profil uç noktasından (`web_profile_info`) hesabın profil bilgisini, sayılarını ve son gönderilerini salt okunur çeker ve Instagram görünümünde gösterir.

Bilinmesi gerekenler:

- Instagram bu uç noktayı IP bazlı **rate limit** uygular. Uygulama sırasıyla `www.instagram.com` → `i.instagram.com` → (yapılandırıldıysa) sunucu proxy'sini dener; başarısız olursa **son başarılı önbelleği** gösterir ve kullanıcı dostu hata ekranı çıkarır. Mobil/ev ağlarında genelde doğrudan çalışır; sunucu proxy'si için `supabase/functions/public-profile` deploy edip `EXPO_PUBLIC_PUBLIC_PROFILE_PROXY_URL` verin.
- Instagram, sahibi olmadığınız hesapların **içgörülerini (görüntülenme, erişim vb.) vermez**. Bu değerler herkese açık etkileşimden deterministik biçimde **tahmin edilir** ve UI'da **"Tahmini"** olarak etiketlenir. Simülasyon Modunda hepsi elle düzenlenebilir.
- Gizli hesaplar yalnızca profil sayılarıyla, "Bu hesap gizli" durumuyla gösterilir.
- Alternatif: **"Manuel profil oluştur"** ile tamamen elle (fotoğraf, isim, sayılar, galeriden gönderiler) bir profil kurabilirsiniz; Instagram'a hiç bağlanmaz.

## 6. Live Mode

`EXPO_PUBLIC_APP_MODE=live` + `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_META_APP_ID` tanımlı olmalıdır. Akış:

```
Expo App ──(OAuth code, PKCE)──▶ Supabase Edge Function (auth) ──▶ Meta token exchange
   ▲                                   │ token AES-256-GCM ile şifrelenir, DB'ye yazılır
   └──── app session token ◀───────────┘
Expo App ──(Bearer session)──▶ Edge Function (instagram) ──▶ Graph API (READ-ONLY)
```

Uygulama hiçbir zaman Instagram access token'ını görmez; yalnızca kendi opak oturum token'ını SecureStore'da saklar. Token süresi dolunca **"Yeniden bağlantı gerekli"** ekranı çıkar.

**Expo Go canlı modu desteklemez** (özel OAuth scheme kısıtı). Development Build gerekir (bkz. §9).

## 7. Meta Developer Setup

1. [developers.facebook.com](https://developers.facebook.com) → yeni uygulama → **Instagram** ürünü → *Instagram API with Instagram Login*.
2. Instagram hesabınız **Business** veya **Creator** olmalıdır (Kişisel hesaplar "Profesyonel hesap gerekli" ekranını görür).
3. **App ID**'yi mobil `.env` (`EXPO_PUBLIC_META_APP_ID`) ve `supabase/.env` (`META_APP_ID`) içine; **App Secret**'i yalnızca `supabase/.env` (`META_APP_SECRET`) içine yazın.
4. Kullandığımız minimum izinler (`constants/config.ts`): `instagram_business_basic`, `instagram_business_manage_insights`. Yorum/yayınlama izinleri **istenmez**.
5. Test kullanıcıları: *Instagram Testers* bölümünden hesabınızı ekleyip Instagram uygulamasından daveti kabul edin.
6. Graph API sürümü tek yerde tutulur: `META_GRAPH_API_VERSION` (`constants/config.ts` ve edge function env).

## 8. OAuth Setup

- Uygulama scheme'i: `sociallens` (`app.json` → `scheme`). Varsayılan redirect: `sociallens://oauth`.
- Meta konsolu → Instagram → *Business login settings* → **OAuth redirect URIs** listesine aynı URI'yi ekleyin.
- Edge function `META_ALLOWED_REDIRECT_URIS` env'inde de aynı listeyi tutun (redirect validation).
- Akış: Authorization Code Flow + **state** doğrulaması + PKCE (`code_challenge` S256; Meta yok sayarsa zararsızdır). Kod değişimi ve long-lived token yenileme (`ig_refresh_token`, 7 günden az kaldığında) backend'de yapılır.

## 9. Development Build

```bash
npm i -g eas-cli
eas login
eas init                      # app.json → extra.eas.projectId doldurulur
eas build --profile development --platform android   # veya ios
```

`eas.json` içinde `development` profili `EXPO_PUBLIC_APP_MODE=live` ayarlar. Build cihaza kurulduktan sonra:

```bash
npx expo start --dev-client
```

Yerel prebuild isterseniz: `npx expo prebuild` (ios/android klasörleri `.gitignore`'dadır).

## 10. Supabase Setup

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>

# server secrets
cp supabase/.env.example supabase/.env
# META_APP_ID, META_APP_SECRET, TOKEN_ENCRYPTION_KEY (openssl rand -base64 32) doldurun
supabase secrets set --env-file supabase/.env

# edge functions
supabase functions deploy auth
supabase functions deploy instagram
supabase functions deploy public-profile
```

Backend sözleşmesi (mobil `MetaInstagramProvider` bunu kullanır):

| Endpoint | Açıklama |
|----------|----------|
| `POST /auth/instagram/callback` | `{ code, state, code_verifier, redirect_uri }` → `{ session_token, expires_at, account }` |
| `POST /auth/logout` | oturumu siler |
| `GET /instagram/account` | profil (Graph `/me`) |
| `GET /instagram/media?after=` | medya listesi (sayfalı) |
| `GET /instagram/media/:id` | tek medya |
| `GET /instagram/insights/account?since=&until=` | hesap içgörüleri (desteklenmeyen metrikler sessizce atlanır) |
| `GET /instagram/insights/media/:id` | medya içgörüleri (Reels için retention/avg watch time) |
| `GET /public-profile?username=` | herkese açık profil proxy'si |

Edge function'lar IP bazlı rate limit uygular (`rate_limits` tablosu) ve metrik snapshot'larını `metric_snapshots`'a yazar (geçmiş dönem grafikleri için).

## 11. Database Migration

```bash
supabase db push           # supabase/migrations/0001_init.sql uygulanır
# veya SQL editöründen dosyayı çalıştırın
```

Tablolar: `users`, `instagram_accounts` (token_encrypted), `app_sessions` (yalnızca hash), `media_snapshots`, `metric_snapshots`, `simulation_profiles`, `simulation_values`, `recommendations`, `rate_limits`. Tüm tablolarda RLS açıktır; erişim yalnızca service role ile edge function'lar üzerinden yapılır.

## 12. Security Notes

- Uygulama içinde **Instagram kullanıcı adı/şifre alanı yoktur**; giriş yalnızca Instagram'ın resmi sayfasında olur.
- Meta App Secret, Instagram token'ları ve service role key **mobil bundle'a girmez**. Token'lar DB'de AES-256-GCM ile şifrelidir; oturum token'ları yalnızca SHA-256 hash olarak saklanır.
- Mobilde SecureStore yalnızca uygulama oturumu için kullanılır.
- OAuth `state` doğrulanır, PKCE uygulanır, redirect URI allow-list ile kontrol edilir, edge function'larda CORS + rate limit vardır.
- Gerçek veri **salt okunurdur**: hiçbir kodda beğeni/yorum/görüntülenme değiştiren API çağrısı yoktur. Simülasyon değerleri Instagram'a asla gönderilmez.
- Senaryo rozetleri (paylaşım kartı dahil) isteğe bağlıdır ve varsayılan olarak kapalıdır (Ayarlar → Senaryo).

## 13. Simülasyon Modu

- Kontrol panelindeki **GERÇEK VERİ / SİMÜLASYON** anahtarı (varsayılan: gerçek veri).
- **Büyüme oranı (%):** Kontrol paneli → Araçlar → "Büyüme oranı" veya Simülasyon Laboratuvarı'ndaki kart. Tek bir yüzde (örn. +35%) girilir; görüntülenme/beğeni 1:1, kaydetme ×1,15, erişim ×0,85, yeni takipçi ×1,3, toplam takipçi ×0,3 esnekliğiyle, gönderi başına ±%4 doğal sapmayla tüm metrikler o oranda artar (`services/simulation/growth.ts`). Elle düzenlenen metrikler oranın üzerine yazar. Negatif oranla düşüş senaryosu da kurulabilir.
- **Rozet/etiket yok:** Uygulama içinde "simülasyon" kelimesi geçmez; özellik "Senaryo" olarak adlandırılır. Senaryo modu açıkken tüm ekranlar (paylaşım kartı ve Önce/Sonra dahil) gerçek görünümle birebir aynıdır. Rozetler yalnızca Ayarlar → Senaryo → "Senaryo rozetini göster" açıksa görünür (varsayılan kapalı).
- **Senaryo araçları:** Profesyonel pano → sağ üstteki ⚙ (Senaryo modu anahtarı, Büyüme oranı, Senaryo Laboratuvarı, Önce/Sonra, Growth Lab, Hesap özeti). Metriklere uzun basarak da düzenlenir. Instagram ekranlarında ekstra hiçbir kontrol yoktur.
- Herhangi bir metriğe **uzun basın** (veya simülasyon açıkken dokunun) → metrik editörü: gerçek değer, simüle değer girişi, slider (0 → 1M+), hazır ayarlar (+10% … 10X), "Simülasyonu uygula", "Gerçek değere döndür". Sayılar animasyonla geçer (12.482 → 50.000).
- Profil sayıları (gönderi/takipçi/takip), hesap KPI'ları, gönderi bazlı beğeni/yorum/görüntülenme/erişim/paylaşım/kaydetme, simüle profil (isim, bio, avatar, onay rozeti) ve galeriden **simüle gönderi ekleme** desteklenir.
- Birden fazla **senaryo** oluşturulabilir; hepsi hesap bazında namespace'lenir ve cihazda kalıcıdır (uygulama yeniden başlatılınca korunur).
- **Önce / Sonra** ekranı ekran görüntüsü kalitesinde karşılaştırma tablosu sunar ve paylaşılabilir.
- Veri modeli: her metrik için `realValue` / `overrideValue` / `displayValue` (`services/simulation/resolve.ts`): açık düzenleme > büyüme oranı > gerçek değer. Gerçek API yanıtı hiçbir zaman mutate edilmez.

## 14. Mimari

```
app/                 Expo Router ekranları ( (auth), (tabs), media/[id], dashboard, simulation, growth, reels, settings, account, share, create )
components/          common · feed · profile · analytics · charts · simulation · navigation · icons
features/            instagram (TanStack Query hook'ları) · simulation (overlay hook'ları) · analytics · activity
services/
  instagram/         InstagramProvider arayüzü + Mock / Public / Meta / Manual provider'ları, normalize katmanı
  analytics/         engagement rate, içerik performansı, tahmin motoru
  recommendations/   deterministik Growth Lab kuralları
  simulation/        displayValue çözümleyici
  auth/              OAuth (PKCE) + oturum yönetimi
store/               Zustand: authStore (SecureStore) · simulationStore · settingsStore · manualProfileStore
schemas/             Zod şemaları (Graph API, backend, public web profile)
types/               AppAccount, AppMedia, AppMetric, AppInsight, AppMediaInsight …
i18n/                Türkçe / İngilizce
supabase/            migrations + edge functions (auth, instagram, public-profile)
```

- UI yalnızca `App*` tiplerini kullanır; provider `APP_MODE` ve oturum kaynağına göre `providerFactory` tarafından seçilir. **UI mock/live ayrımını bilmez.**
- TanStack Query önbellek süreleri: profil 10 dk, medya 5 dk, içgörüler 15 dk. Pull-to-refresh tüm sorguları ve provider önbelleğini yeniler.
- Tüm hata durumları (`loading`, `empty`, `error`, `offline`, `auth_expired`, `insufficient_permission`, `not_professional`, `no_posts`, `rate_limit`, `unsupported_metric`, `private_account`, `login_required`) `ErrorState` ile kullanıcı dostu gösterilir; ham API hatası dökülmez.
- Desteklenmeyen metrikler UI'ı kırmaz: yalnızca mevcut metrikler gösterilir, eksikler bilgilendirme notuyla belirtilir.

## 15. Geliştirme ve Test

```bash
npm run typecheck && npm run lint && npm test
```

Birim testleri (`__tests__/`): sayı formatlayıcı, engagement rate, tarih aralığı, normalize katmanı (Zod dahil), Growth Lab kuralları ve **simulationStore** (`real 1000 / sim 5000 → off 1000, on 5000, reset 1000`).

Metro bundle kontrolü: `npx expo export --platform android`.

## 16. Kabul Testleri

| # | Test | Nasıl doğrulanır |
|---|------|------------------|
| 1 | `npm install` + `npx expo start` | Expo Go'da uygulama açılır |
| 2 | Demo hesap | Bağlantı ekranı → "Demo Hesapla Devam Et" |
| 3 | Feed | Ana sayfa: hikayeler + Instagram tarzı gönderiler, çift dokunma kalp |
| 4 | Profil grid | Profil sekmesi: 3 kolon, Reels/Carousel rozetleri, lazy loading |
| 5 | Medya detayı | Gönderiye dokun → detay + "İçgörüleri görüntüle" |
| 6 | Dashboard | Profil → "Profesyonel pano" kartı |
| 7 | Tarih aralığı | İstatistikler → "30 gün ▾" → 7/14/30/90 gün |
| 8 | Senaryo modu | Profesyonel pano → ⚙ → Senaryo modu |
| 9 | Metrik override | İstatistikler → Görüntülemeler kartına uzun bas → 50.000 uygula |
| 10 | Real Data | ⚙ → Senaryo modu kapat → gerçek değer görünür |
| 11 | Veri izolasyonu | Store real değerleri yazmaz (bkz. `__tests__/simulationStore.test.ts`) |
| 12 | Kalıcılık | Uygulamayı kapat/aç → senaryo ve mod korunur |
| 13 | Dark mode | Ayarlar → Tema (Sistem / Açık / Koyu) |
| 14 | Offline | Uçak modu → "İnternet bağlantısı yok" durumu, önbellek varsa gösterilir |
| 15 | Auth expired | Canlı modda token süresi dolunca "Yeniden bağlantı gerekli" ekranı |

---

Proje adı geçicidir; markalama `constants/config.ts` (`APP_NAME`, `APP_TAGLINE`) ve `app.json` üzerinden değiştirilebilir.

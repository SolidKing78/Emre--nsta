# 48. Development Experience

Proje kurulduğunda:

```bash
npm install
npx expo start
```

ile Demo Mode çalışmalı.

## README Gereksinimleri

README oluştur. README içerisinde:

- Requirements
- Install
- Environment Variables
- Demo Mode
- Live Mode
- Meta Developer Setup
- OAuth Setup
- Development Build
- Supabase Setup
- Database Migration
- Security Notes

ayrıntılı yaz.

---

# 49. Environment

`.env.example` oluştur.

## Örnek

```env
EXPO_PUBLIC_APP_MODE=demo
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_META_APP_ID=
EXPO_PUBLIC_META_REDIRECT_URI=
```

## Secret Yönetimi

**Secret değerleri mobil `.env` içerisine koyma.**

Server-only env (backend tarafında kalmalı):

```env
META_APP_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

---

# 50. Development Approach

Projeyi tek seferde devasa bir dosyada yazma.

## Geliştirme Fazları

| Phase | Açıklama |
|-------|----------|
| PHASE 1 | Project foundation |
| PHASE 2 | Design system |
| PHASE 3 | Navigation |
| PHASE 4 | Mock data layer |
| PHASE 5 | Instagram-style feed |
| PHASE 6 | Profile |
| PHASE 7 | Professional Dashboard |
| PHASE 8 | Content analytics |
| PHASE 9 | Simulation Lab |
| PHASE 10 | Growth Lab |
| PHASE 11 | Authentication architecture |
| PHASE 12 | Meta Instagram API |
| PHASE 13 | Backend |
| PHASE 14 | Security |
| PHASE 15 | Performance optimization |
| PHASE 16 | Testing |

Her phase bittikten sonra mevcut kodu bozup tekrar yazmak yerine modüler ilerle.

---

# 51. Acceptance Tests

Uygulama tamamlandığında aşağıdakiler çalışmalı.

| # | Test | Beklenen Sonuç |
|---|------|----------------|
| TEST 1 | Expo Go'da `npm install` + `npx expo start` | Uygulama açılıyor |
| TEST 2 | Demo hesap seçimi | Demo hesap seçiliyor |
| TEST 3 | Feed | Feed açılıyor |
| TEST 4 | Profile grid | Profile grid açılıyor |
| TEST 5 | Media detail | Bir gönderiye basıldığında media detail açılıyor |
| TEST 6 | Analytics dashboard | Analytics dashboard çalışıyor |
| TEST 7 | Date range | 7D / 30D / 90D değiştirilince grafikler değişiyor |
| TEST 8 | Simulation Mode | Simulation Mode açılıyor |
| TEST 9 | Metric override | 12.4K view → 50K olarak değiştirilebiliyor |
| TEST 10 | Real Data restore | Real Data'ya dönüldüğünde tekrar 12.4K gösteriliyor |
| TEST 11 | Data isolation | Gerçek veri hiçbir zaman simulation tarafından overwrite edilmiyor |
| TEST 12 | Persistence | Application restart edildiğinde kayıtlı simulation tercihi korunuyor |
| TEST 13 | Dark mode | Dark mode çalışıyor |
| TEST 14 | Offline | Network olmadığı zaman düzgün error state gösteriliyor |
| TEST 15 | Auth expired | Expired authentication durumunda reconnect ekranı çıkıyor |

---

# 52. Testing

## Unit Test Kapsamı

- metric formatter
- engagement rate
- simulation override
- normalization layer
- date range
- growth rules

Özellikle **simulationStore** için test yaz.

## simulationStore Test Senaryosu

```
real value = 1000
simulation = 5000

simulationMode false → 1000
simulationMode true  → 5000
reset                → 1000
```

---

# 53. Final Quality Requirement

Bu proje yalnızca UI mockup olmayacak.

**Çalışan React Native/Expo uygulaması olacak.**

## Kalite Kontrol Listesi

- Placeholder ekranlar bırakma
- "TODO" bırakarak geçme
- Pseudo-code verme
- Import hatası bırakma
- TypeScript hatası bırakma
- Navigation kırık bırakma
- Demo Mode tamamen kullanılabilir halde olmalı
- Her ekran profesyonel görünsün
- Mobil cihaz ekranına uygun spacing kullan
- Android ve iOS safe area sorunlarını çöz

## Doğrulama Adımları

Dosyaları oluşturduktan sonra:

1. TypeScript kontrolü yap
2. ESLint çalıştır
3. Expo başlangıç hatalarını kontrol et
4. Import hatalarını düzelt
5. Runtime warning'leri kontrol et

---

# 54. Çıktı Şekli

Önce mevcut klasörü incele.

Eğer boşsa projeyi sıfırdan oluştur.

## Geliştirme Kuralları

- Bana yalnızca kod örneği verme
- **DOSYALARI GERÇEKTEN OLUŞTUR**
- İlk olarak çalışan DEMO sürümünü tamamla
- Ardından Live Instagram entegrasyon altyapısını ekle
- Her önemli aşamada kısa şekilde ne yaptığını, hangi dosyaları oluşturduğunu ve sıradaki işlemi belirt
- Benden her dosya için ayrı ayrı onay isteme
- Teknik olarak mantıklı kararları kendin ver ve uygulamayı tamamlayana kadar ilerle

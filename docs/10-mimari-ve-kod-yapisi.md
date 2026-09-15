# 36. Mock Data

Demo modunda çok kaliteli fake dataset hazırla.

## Örnek Profil

| Alan | Değer |
|------|-------|
| username | zmtprefabrik |
| followers | 11,369 |
| following | 15 |
| mediaCount | 284 |

## Son 30 Gün Metrikleri

| Metrik | Değer |
|--------|-------|
| views | 1,478,200 |
| reach | 227,139 |
| profileVisits | 4,824 |
| websiteClicks | 362 |
| newFollowers | 1,186 |

## Mock İçerik Gereksinimleri

En az:

- 12 post
- 8 reel
- 4 carousel

Her medyada farklı performans değerleri olsun.

Demo data gerçek API data shape'ine mümkün olduğunca yakın normalize edilsin.

---

# 37. Normalization Layer

Meta API response'unu UI içerisine direkt dağıtma.

Adapter oluştur.

## Örnek Akış

```
InstagramApiMedia
    ↓
normalizeMedia()
    ↓
AppMedia
```

UI yalnızca **AppMedia** tipini kullansın.

## App Tipleri

Benzer şekilde şu tipleri oluştur:

- AppAccount
- AppMetric
- AppInsight
- AppMediaInsight

Bu sayede Meta API değiştirilirse bütün UI bozulmasın.

---

# 38. TypeScript

Strict TypeScript kullan.

**`any` kullanma.**

API response'larını Zod ile doğrula.

## Schema Örnekleri

- InstagramMediaSchema
- InstagramAccountSchema
- MetricSchema

Invalid response yakalanmalı.

---

# 39. Folder Structure

Aşağıdaki gibi temiz mimari oluştur:

```
app/
  _layout.tsx
  index.tsx

  (auth)/
    connect.tsx

  (tabs)/
    _layout.tsx
    home.tsx
    analytics.tsx
    create.tsx
    activity.tsx
    profile.tsx

  media/
    [id].tsx

  dashboard/
    index.tsx

  simulation/
    index.tsx
    media/[id].tsx

  growth/
    index.tsx

components/
  common/
  feed/
  profile/
  analytics/
  simulation/
  charts/
  navigation/

features/
  auth/
  instagram/
  analytics/
  simulation/
  growth/

services/
  api/
  instagram/
  auth/

store/
  authStore.ts
  simulationStore.ts
  settingsStore.ts

hooks/
types/
schemas/
constants/
utils/
mocks/
assets/
```

---

# 43. API Abstraction

Şu interface oluştur:

```typescript
interface InstagramProvider {
  getAccount(): Promise<AppAccount>;
  getMedia(cursor?: string): Promise<PaginatedMedia>;
  getMediaById(id: string): Promise<AppMedia>;
  getAccountInsights(range: DateRange): Promise<AppMetric[]>;
  getMediaInsights(id: string): Promise<AppMetric[]>;
}
```

Sonra:

- **MockInstagramProvider**
- **MetaInstagramProvider**

oluştur.

`APP_MODE` değerine göre provider seç.

**Bu çok önemli. UI mock/live ayrımını bilmesin.**

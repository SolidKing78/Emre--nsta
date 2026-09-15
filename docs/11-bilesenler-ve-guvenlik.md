# 40. Reusable Components

En az şu componentleri oluştur:

| Component | Kullanım |
|-----------|----------|
| AppHeader | Üst navigasyon başlığı |
| Avatar | Profil fotoğrafı |
| IconButton | İkon butonları |
| MetricCard | KPI kartları |
| MetricRow | Metrik satırları |
| PostCard | Feed gönderi kartı |
| ReelCard | Reel kartı |
| MediaGrid | 3 kolonlu grid |
| MediaThumbnail | Medya önizleme |
| ProfileHeader | Profil üst bölümü |
| StatCounter | Animasyonlu sayaç |
| AnalyticsChart | Grafik bileşeni |
| DateRangeSelector | Tarih filtresi |
| SegmentControl | Segment seçici |
| Skeleton | Yükleme iskeleti |
| EmptyState | Boş durum |
| ErrorState | Hata durumu |
| SimulationBadge | Simülasyon rozeti |
| SimulationMetricEditor | Metrik düzenleyici |
| BottomSheet | Alt panel |
| GrowthRecommendationCard | Öneri kartı |
| ContentPerformanceCard | İçerik performans kartı |

---

# 41. Security

**Çok önemli.**

## Kesinlikle Yapma

- Instagram şifresi toplama
- plaintext token saklama
- App Secret'i Expo env içerisine koyma
- API secret'ı git repository içerisine koyma

## Güvenlik Gereksinimleri

- SecureStore yalnızca mobil session için kullanılabilir
- Instagram provider secret backend'de tutulmalı
- OAuth state validation yap
- PKCE mümkün olan yerde kullan
- Backend endpoint rate limiting uygula
- CORS ve redirect validation yap

---

# 42. API Permissions

2026 itibarıyla Meta'nın güncel Instagram Platform dokümantasyonunu kontrol ederek gereken minimum permission setini kullan.

Instagram Login akışında yalnızca gerçekten gereken izinleri iste.

## Örnek Scope'lar

İşlevlere göre gerekli olabilecek scope'lar:

- `instagram_business_basic`
- `instagram_business_manage_insights`
- `instagram_business_manage_comments`
- `instagram_business_content_publish`

**Ancak bunları körlemesine ekleme.**

Kullandığımız fonksiyona göre minimum yetki prensibi uygula.

## API Versiyonu

API sürümünü tek bir config içerisinde tut:

```
META_GRAPH_API_VERSION
```

Endpoint'lerin içine ayrı ayrı hard-code etme.

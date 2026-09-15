# 13. Professional Dashboard

Uygulamanın en önemli ekranlarından biri olacak.

Instagram Professional Dashboard hissinde, fakat daha gelişmiş bir analytics ekranı oluştur.

## Üst Bölüm

- **Professional Dashboard** başlık

## Tarih Filtresi

- 7D
- 30D
- 90D
- Custom

## Ana KPI Kartları

API tarafından sağlanan verilere göre dinamik göster:

- Views
- Reach
- Interactions
- Followers
- Profile Visits
- Website Clicks

## KPI Kart Yapısı

Her kartta:

- metric
- değer
- önceki döneme göre değişim
- yüzde değişim
- mini sparkline

### Örnek

```
Reach

124,820

↑ 18.4%

Last 30 days
```

---

# 14. Analytics Charts

Profesyonel chart bileşenleri hazırla.

## Ekran Bölümleri

- Overview
- Reach
- Views
- Engagement
- Followers

## Chart Türleri

- Line chart
- Bar chart
- Donut chart (gerektiğinde)

**Not:** Ekranı grafik çöplüğüne dönüştürme. Minimal ve premium tasarım uygula.

## Interaktivite

Chart üzerinde dokunulduğunda ilgili tarihin değeri tooltip olarak görünsün.

---

# 15. Content Performance

Dashboard içerisinde **"Top Content"** alanı oluştur.

## Filtre

- All
- Posts
- Reels
- Carousels

## Sıralama

- Most Viewed
- Most Reached
- Most Engaged
- Most Saved
- Most Shared
- Most Commented

## İçerik Kartı

Her içerik kartında:

- thumbnail
- views
- reach
- likes
- comments
- saves
- shares
- engagement rate

---

# 16. Reels Analytics

Reels için özel ekran oluştur.

## İçerik

- Reel thumbnail/video preview

## Metrikler

- Views
- Reach
- Likes
- Comments
- Shares
- Saves
- Interactions

## Retention Metrikleri

- API destekliyorsa ek retention metriclerini de göster
- Desteklenmiyorsa uydurma veri üretme
- Demo modunda retention için mock veri kullanılabilir
- **LIVE ve DEMO verileri kesin olarak birbirinden ayır**

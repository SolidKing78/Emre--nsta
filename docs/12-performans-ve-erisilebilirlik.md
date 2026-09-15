# 44. Performance

## Liste Optimizasyonu

- FlatList kullan
- Post listesinde gereksiz render önle
- memo / useMemo / useCallback gerektiği yerde kullan

## Image & Media

- Expo Image caching kullan
- Media grid virtualization yap
- Lazy load
- Video bileşenlerini yalnızca görünürken aktive et

## Charts

Analytics ekranındaki grafikler ekran dışında render edilmesin.

---

# 45. Accessibility

- Button `accessibilityLabel` kullan
- Color contrast kontrol et
- Text scaling destekle
- Sadece renk ile durum belirtme

## Simulation Mode

Simulation Mode'da **badge + text** kullan.

---

# 46. Settings

Settings ekranı oluştur.

## Bölümler

- Account
- Appearance
- Analytics
- Simulation
- Security
- About

## Simulation Alt Ayarları

- Enable Simulation
- Reset All Simulations
- Default Growth Preset
- Show Simulation Badge

**Not:** "Show Simulation Badge" gerçek veriyle karışmayı önlemek için kapatılamaz hale getirilebilir veya minimum işaret zorunlu tutulabilir.

---

# 47. Export

Analytics raporunu dışa aktarma altyapısı oluştur.

## İlk Sürüm: Share Summary

Analytics screenshot/share card.

### Örnek Kart

```
Last 30 Days

Reach        227K
Views        1.4M
Interactions 18.2K
Followers    +1,186
```

Instagram Story boyutunda paylaşılabilir kart oluştur.

## Simulation Export Kuralı

Simulation raporu export edildiğinde **SIMULATION** etiketi görsel üzerinde kesinlikle bulunmalı.

# 27. Sync

Instagram verilerini her ekran açıldığında gereksiz tekrar çekme.

## TanStack Query

TanStack Query kullan.

## Cache Stratejisi

| Veri Tipi | Cache Süresi |
|-----------|--------------|
| profile | 10 dakika |
| media | 5 dakika |
| insights | 15 dakika |

## Manuel Refresh

**Pull to Refresh** desteği olsun.

## Metric Snapshots

Backend mümkünse metric snapshot kaydetsin.

Bu sayede geçmiş dönem grafikleri oluşturulabilecek.

---

# 28. Error States

Aşağıdaki tüm state'leri tasarla:

| State | Açıklama |
|-------|----------|
| loading | Veri yükleniyor |
| empty | Veri yok |
| error | Genel hata |
| no internet | Bağlantı yok |
| OAuth expired | Token süresi dolmuş |
| insufficient permission | Yetki yetersiz |
| account not professional | Profesyonel hesap gerekli |
| no posts | Gönderi yok |
| API rate limit | Rate limit aşıldı |
| unsupported metric | Desteklenmeyen metrik |

Her durumda kullanıcı dostu ekran göster.

**Raw API error dump etme.**

---

# 29. Account Type Kontrolü

Instagram hesabı professional değilse **"Professional Account Required"** ekranı göster.

## Alt Açıklama

"Analytics özelliklerini kullanabilmek için hesabınızın Instagram Business veya Creator hesabı olması gerekir."

Kullanıcıya rehber gösterilebilir.

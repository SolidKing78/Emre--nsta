# 23. Engagement Rate

Gerçek ve simulated veriler için engagement rate hesaplamaları yap.

Tek bir formülü körü körüne kullanma.

Kullanıcı setting üzerinden hesaplama yöntemini değiştirebilsin.

## Formül Seçenekleri

### Engagement by Reach

```
(likes + comments + saves + shares) / reach × 100
```

### Engagement by Followers

```
(likes + comments + saves + shares) / followers × 100
```

Hangi formülün kullanıldığı UI üzerinde açıklansın.

---

# 24. Growth Lab

Sahte engagement üretmek yerine gerçek engagement geliştirmeye yardımcı olacak bir bölüm oluştur.

**Adı:** Growth Lab

## İşlevsellik

Growth Lab içerisinde account analytics verilerini değerlendir.

## Örnek Analizler

- "Reels içerikleriniz carousel gönderilerine göre %38 daha fazla reach sağlıyor."
- "19:00–21:00 arasında yayınlanan içeriklerde ortalama etkileşim daha yüksek."
- "Son 10 Reel içerisinde ilk 3 saniyede güçlü hook kullanan içerikler daha iyi performans göstermiş."
- "Carousel gönderileriniz daha fazla save üretiyor."

## Veri Yetersizliği

Gerçek API verisinde desteklenmeyen analizleri kesin bilgi gibi verme.

Gerekli veri bulunmadığında:

**"Insufficient Data"**

göster.

---

# 25. Recommendation Engine

İlk versiyonda **deterministic analytics engine** yap.

LLM entegrasyonuna bağımlı olmasın.

## Örnek Kurallar

```
if reelAverageReach > postAverageReach * 1.3
  → recommend: "Reels içeriğine daha fazla ağırlık ver."

if saves / reach yüksekse
  → "Bu içerik bilgilendirici içerik formatı için güçlü bir sinyal veriyor."

if comments yüksek fakat saves düşükse
  → "Conversation odaklı içerik olarak sınıflandır."
```

## Recommendation Model

```
type
title
description
evidence
confidence
priority
```

---

# 26. Account Overview

Account ekranında **Profile Overview** göster.

## Alanlar

- Username
- Account Type
- Media Count
- Connected Since
- Last Sync
- API Status

## API Status State'leri

- Connected
- Token Expiring
- Authentication Required
- Sync Error

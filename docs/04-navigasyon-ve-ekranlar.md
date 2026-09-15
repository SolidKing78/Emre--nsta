# 7. Ana Navigasyon

Instagram'a çok yakın bir bottom navigation oluştur.

## 5 Ana Sekme

1. **Home**
2. **Analytics**
3. **Create / Content**
4. **Activity**
5. **Profile**

## Navigasyon Gereksinimleri

- Alt navigation ekranın tabanına sabitlensin
- Safe Area düzgün çalışsın
- iPhone ve Android üzerinde responsive olsun
- Seçili tab animasyonla vurgulansın
- Haptic feedback kullan

---

# 8. Splash Screen

Minimal fakat premium bir splash screen.

## İçerik

- Ortada **SocialLens** logosu
- Alt tarafta küçük: **"Professional Social Analytics"** yazısı
- Dark/light mode desteği olsun

## Akış

Splash sonrasında session kontrolü gerçekleştir.

Session yoksa **Connect Account** ekranına geç.

---

# 9. Login / Connect Account

Detaylı auth gereksinimleri için [02-calisma-modlari-ve-auth.md](./02-calisma-modlari-ve-auth.md) dosyasına bakın.

---

# 10. Home Feed

Instagram feed deneyimine çok yakın hissettirsin.

## Top Bar

- **SocialLens** yazısı
- Sağ tarafta:
  - bildirim
  - mesaj / analytics shortcut

## Feed Yapısı

- Üstte horizontal story/profile avatar alanı olabilir
- Ardından hesabın gerçek gönderilerini feed şeklinde göster

## Her Post İçeriği

- profile image
- username
- üç nokta
- media
- carousel indicator
- like icon
- comment icon
- share icon
- save icon
- like count
- caption
- comment count
- publishing date

**Not:** Bunlar gerçek Instagram hesabının kendi medyaları olmalı.

Post üzerine tıklandığında **Content Detail** aç.

---

# 11. Profile Screen

Instagram profil görünümüne çok yakın bir profil ekranı oluştur.

## Üst Bölüm

- username
- profile photo
- **Posts / Followers / Following** istatistikleri
- Biography
- Website
- Professional dashboard butonu

## Aksiyon Butonları

Edit yerine:

- **"Dashboard"**
- **"Account"**

aksiyonları olabilir.

## Alt Bölüm Tabs

- **GRID**
- **REELS**
- **INSIGHTS**

### Grid Gereksinimleri

- 3 kolonlu Instagram benzeri media grid
- Lazy loading kullan
- Image caching kullan
- Infinite scroll destekle
- Skeleton loader oluştur

---

# 12. Content Detail

Bir gönderiye tıklandığında detay ekranı aç.

## Üst Kısım

- medya

## Alt Taraf Metrikleri

API tarafından erişilebilen değerleri göster:

- Likes
- Comments
- Shares
- Saves
- Views
- Reach
- Interactions

## Dinamik Metric Desteği

- Desteklenmeyen metric geldiğinde UI kırılmamalı
- Metric availability dinamik olmalı
- API tarafından mevcut olmayan metric gizlenmeli
- Sabit API response varsayımı yapma

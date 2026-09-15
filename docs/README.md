# SocialLens — Proje Dokümantasyonu

Profesyonel Instagram analitik ve simülasyon mobil uygulaması için kapsamlı teknik spesifikasyon.

## Proje Özeti

**SocialLens**, profesyonel Instagram hesabınızı uygulamaya bağlayabileceğiniz, yayınlanan içerikleri görüntüleyebileceğiniz, hesap ve içerik istatistiklerini detaylı inceleyebileceğiniz ve ayrı bir simülasyon modunda istatistikleri değiştirerek farklı senaryoları görselleştirebileceğiniz modern bir mobil uygulamadır.

Uygulama görsel ve kullanım deneyimi açısından Instagram mobil uygulamasına son derece yakın hissettirmelidir.

## Dokümantasyon İndeksi

| # | Dosya | Konu |
|---|-------|------|
| 1 | [01-proje-amaci-ve-hedefler.md](./01-proje-amaci-ve-hedefler.md) | Proje amacı, marka kuralları, hedef platform |
| 2 | [02-calisma-modlari-ve-auth.md](./02-calisma-modlari-ve-auth.md) | Demo/Live modları, OAuth, Instagram bağlantısı |
| 3 | [03-backend-ve-veritabani.md](./03-backend-ve-veritabani.md) | Backend mimarisi, Supabase, veritabanı şeması |
| 4 | [04-navigasyon-ve-ekranlar.md](./04-navigasyon-ve-ekranlar.md) | Splash, login, feed, profil, content detail |
| 5 | [05-analytics-dashboard.md](./05-analytics-dashboard.md) | Professional dashboard, charts, content performance, Reels |
| 6 | [06-simulation-lab.md](./06-simulation-lab.md) | Simulation mode, metric editor, before/after |
| 7 | [07-growth-ve-oneriler.md](./07-growth-ve-oneriler.md) | Engagement rate, Growth Lab, recommendation engine |
| 8 | [08-sync-hata-durumlari.md](./08-sync-hata-durumlari.md) | Sync stratejisi, error states, account type kontrolü |
| 9 | [09-design-system.md](./09-design-system.md) | Design system, typography, dark mode, animations |
| 10 | [10-mimari-ve-kod-yapisi.md](./10-mimari-ve-kod-yapisi.md) | Mock data, normalization, TypeScript, folder structure |
| 11 | [11-bilesenler-ve-guvenlik.md](./11-bilesenler-ve-guvenlik.md) | Reusable components, security, API permissions |
| 12 | [12-performans-ve-erisilebilirlik.md](./12-performans-ve-erisilebilirlik.md) | Performance, accessibility, settings, export |
| 13 | [13-gelistirme-ve-test.md](./13-gelistirme-ve-test.md) | Dev experience, environment, phases, acceptance tests |
| 14 | [14-urun-prensipleri.md](./14-urun-prensipleri.md) | Final quality requirements, core product principles |

## Temel Prensipler

### Yapılması Gerekenler

- Gerçek login yalnızca Meta/Instagram resmi OAuth sayfası üzerinden
- Gerçek API verileri READ-ONLY olarak korunmalı
- Simülasyon değerleri yalnızca uygulama içi SIMULATION MODE katmanında
- Demo modunda Expo Go'da tam çalışır uygulama
- Production kalitesine yakın, modüler mimari

### Kesinlikle Yapılmaması Gerekenler

- Instagram logosunu birebir kopyalama
- Instagram ticari markasını uygulamanın kendi markasıymış gibi kullanma
- Sahte Instagram login formu oluşturma
- Kullanıcının Instagram parolasını backend'e gönderme
- Gerçek like/view/comment sayılarını değiştiren API veya bot
- Meta App Secret veya token'ları mobil uygulamada hard-code etme

## Teknoloji Stack

- React Native + Expo + TypeScript
- Expo Router, Reanimated, Gesture Handler
- TanStack Query, Zustand, Zod, React Hook Form
- Supabase (backend)
- Meta Instagram Graph API (live mode)

## Geliştirme Fazları

1. Project foundation
2. Design system
3. Navigation
4. Mock data layer
5. Instagram-style feed
6. Profile
7. Professional Dashboard
8. Content analytics
9. Simulation Lab
10. Growth Lab
11. Authentication architecture
12. Meta Instagram API
13. Backend
14. Security
15. Performance optimization
16. Testing

Detaylı faz açıklamaları için [13-gelistirme-ve-test.md](./13-gelistirme-ve-test.md) dosyasına bakın.

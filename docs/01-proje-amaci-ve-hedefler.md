# 1. Proje Amacı ve Hedefler

## 1.1 Proje Amacı

Profesyonel Instagram hesabımı uygulamaya bağlayabileceğim, hesabımda yayınlanan içerikleri görebileceğim, hesap ve içerik istatistiklerini detaylı inceleyebileceğim ve ayrı bir simülasyon modunda istatistikleri değiştirerek farklı senaryoları görselleştirebileceğim modern bir mobil uygulama geliştir.

Uygulama görsel ve kullanım deneyimi açısından Instagram mobil uygulamasına son derece yakın hissettirmeli.

## 1.2 Marka ve Güvenlik Kuralları

### Yapılmaması Gerekenler

- Instagram logosunu birebir kopyalama
- Instagram ticari markasını uygulamanın kendi markasıymış gibi kullanma
- Instagram kullanıcı adı ve şifresini uygulama içinde isteyen sahte bir login formu oluşturma
- Kullanıcının Instagram parolasını hiçbir zaman uygulamanın backend'ine gönderme
- Gerçek Instagram like/view/comment sayılarını yapay şekilde değiştirecek API veya bot oluşturma

### Yapılması Gerekenler

- Gerçek login işlemi yalnızca Meta/Instagram'ın resmi OAuth sayfası üzerinden yapılmalı
- Kullanıcı adı/şifre bizim uygulamamız tarafından hiçbir zaman görülmemeli
- Gerçek API verileri READ-ONLY olarak korunmalı
- Kullanıcının değiştirdiği değerler yalnızca uygulama içerisindeki **SIMULATION MODE** katmanında tutulmalı

## 1.3 Proje Adı

Uygulamaya geçici proje adı olarak:

**SocialLens**

Kod yapısı daha sonra kolayca yeniden markalanabilecek şekilde hazırlanmalı.

---

## 2. Hedef Platform

React Native + Expo kullan.

### Teknoloji Stack

| Kategori | Teknoloji |
|----------|-----------|
| Framework | React Native |
| Platform | Expo |
| Dil | TypeScript |
| Routing | Expo Router |
| Animasyon | React Native Reanimated |
| Gesture | React Native Gesture Handler |
| Image | Expo Image |
| Gradient | Expo Linear Gradient |
| Blur | Expo Blur |
| Haptics | Expo Haptics |
| Secure Storage | Expo SecureStore |
| Data Fetching | TanStack Query |
| State Management | Zustand |
| Validation | Zod |
| Forms | React Hook Form |
| Icons | Lucide React Native veya Expo Vector Icons |

### UI Yaklaşımı

- UI mümkün olduğunca native ve yüksek performanslı olsun
- Gereksiz büyük UI framework kullanma
- StyleSheet veya iyi organize edilmiş NativeWind kullanılabilir
- **Tercihen StyleSheet + reusable design tokens kullan**

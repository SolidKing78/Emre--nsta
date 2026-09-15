# 55. En Önemli Ürün Prensibi

## Uygulamanın Amacı

Uygulamanın amacı:

1. Instagram verilerini **görüntülemek**
2. Instagram verilerini **analiz etmek**
3. Geçmiş performansı **karşılaştırmak**
4. Gelecekteki senaryoları **simüle etmek**
5. Organik içerik performansını **artırmaya yardımcı olmak**

## Temel Veri Ayrımı

Simülasyon verisi ve gerçek Instagram verisi **hiçbir koşulda birbirine karıştırılmamalıdır**.

```
REAL DATA    = Meta API
SIMULATION   = sadece SocialLens içerisinde oluşturulan scenario data
```

Bu ayrımı kod mimarisinden UI'a kadar koru.

---

## Veri Akış Diyagramı

```
┌─────────────────────────────────────────────────────────────┐
│                        SocialLens App                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   UI Layer   │    │  Simulation  │    │   Display    │  │
│  │              │───▶│    Layer     │───▶│    Value     │  │
│  │  (Screens)   │    │  (Overlay)   │    │  Resolver    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         │                   │                    │          │
│         ▼                   ▼                    ▼          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  App Types   │    │ simulation   │    │ realValue /  │  │
│  │ (Normalized) │    │   Store      │    │ overrideValue│  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              InstagramProvider Interface                │  │
│  │  ┌─────────────────┐    ┌─────────────────────────┐  │  │
│  │  │ MockInstagram   │    │ MetaInstagram           │  │  │
│  │  │ Provider        │    │ Provider                │  │  │
│  │  │ (Demo Mode)     │    │ (Live Mode)             │  │  │
│  │  └─────────────────┘    └─────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                              │
└──────────────────────────────│──────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  Backend API     │
                    │  (Supabase)      │
                    └──────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │ Meta Instagram   │
                    │ Graph API        │
                    │ (READ-ONLY)      │
                    └──────────────────┘
```

---

## Simulation Mode Kuralları

### İzin Verilen

- Local/database simulation overlay oluşturma
- UI'da simüle edilmiş değerleri gösterme
- Before/After karşılaştırma
- Simülasyon raporu export (SIMULATION etiketi ile)

### Kesinlikle Yasak

- Gerçek Instagram API verilerini mutate etme
- Gerçek like/view/comment sayılarını değiştiren bot veya API
- Simülasyon verisini gerçek veri gibi sunma (badge zorunlu)
- Backend'e simülasyon değerlerini Instagram'a gönderme

---

## Güvenlik Özet Tablosu

| Veri | Mobil App | Backend | Database |
|------|-----------|---------|----------|
| Instagram Password | ❌ Asla | ❌ Asla | ❌ Asla |
| Meta App Secret | ❌ Asla | ✅ Encrypted | ❌ Asla |
| Access Token | ❌ Asla (session only) | ✅ Encrypted | ✅ Encrypted |
| Session Token | ✅ SecureStore | ✅ | ✅ |
| Real API Data | ✅ Read-only | ✅ Read-only | ✅ Snapshots |
| Simulation Data | ✅ Local/DB | ✅ | ✅ |

---

## Marka ve UX Sınırları

| Yapılabilir | Yapılamaz |
|-------------|-----------|
| Instagram benzeri UX/UI | Instagram logosu kopyalama |
| Instagram tarzı feed layout | Instagram markasını kendi markası gibi kullanma |
| Resmi OAuth ile bağlantı | Sahte login formu |
| "Instagram ile Bağlan" butonu | Kullanıcı adı/şifre alanları |
| Professional analytics dashboard | Instagram'ın birebir kopyası |

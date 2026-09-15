# 3. Expo Go ve Production Auth Ayrımı

Projeyi iki çalışma modunda hazırla.

## MODE A — DEMO / EXPO GO

Expo Go içerisinde uygulama tamamen açılabilmeli.

Gerçek Instagram OAuth gerektirmeden:

- mock hesap
- mock gönderiler
- mock Reels
- mock Insights
- mock kullanıcı profili
- mock yorumlar

ile bütün UI çalışmalı.

`.env` içerisinde:

```env
EXPO_PUBLIC_APP_MODE=demo
```

olduğunda demo moduna geç.

Demo modunda uygulamadaki bütün ekranlar kullanılabilir olmalı.

---

## MODE B — LIVE INSTAGRAM

Gerçek Instagram bağlantısı için:

```env
EXPO_PUBLIC_APP_MODE=live
```

kullan.

### ÖNEMLİ

Expo Go'nun custom OAuth redirect/scheme kısıtları nedeniyle gerçek OAuth entegrasyonu için **Expo Development Build / EAS Development Build** mimarisini destekle.

Gerçek Instagram hesabı bağlantısını Expo Go üzerinde zorla çalıştırmaya çalışma.

Gerekirse:

```bash
npx expo prebuild
```

veya

```bash
eas build --profile development
```

yapısına hazır ol.

`app.json` / `app.config.ts` içerisinde custom scheme tanımla.

Örneğin:

```
sociallens://oauth
```

Ancak gerçek redirect URI Meta Developer yapılandırmasına göre environment üzerinden değiştirilebilir olmalı.

---

# 4. Instagram Bağlantısı

Instagram kullanıcı adı ve parola alanları **OLUŞTURMA**.

## Login Ekranı

Login ekranında:

**"Instagram Hesabını Bağla"**

butonu olsun.

Butona basıldığında resmi Meta/Instagram OAuth sayfası browser üzerinden açılsın.

## OAuth Akışı

- **Authorization Code Flow** kullan
- **PKCE** uygulanabiliyorsa uygula

## Güvenlik Kuralları

Mobil uygulamanın içerisinde hiçbir:

- Meta App Secret
- Instagram App Secret
- client secret
- uzun süreli access token

hard-code edilmemeli.

Bunlar backend üzerinde saklanmalı.

- Token exchange backend üzerinde gerçekleştirilmeli
- Mobil uygulamaya yalnızca uygulamaya ait güvenli session bilgisi döndürülmeli

## Connect Account Ekranı Tasarımı

Instagram login sayfasının sahte kopyasını yapma.

Bunun yerine Instagram tarzı minimal tasarım oluştur.

### Ekran İçeriği

- **SocialLens** başlık
- "Instagram profesyonel hesabınızı bağlayın." alt metin
- **[ Instagram ile Bağlan ]** buton
- Alt açıklama: "Giriş işlemi Instagram'ın güvenli yetkilendirme sayfasında gerçekleştirilir. Parolanız SocialLens tarafından görülmez."

### Demo Modu Ek Buton

Demo modunda ayrıca:

**[ Demo Hesapla Devam Et ]**

butonu göster.

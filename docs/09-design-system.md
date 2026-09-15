# 30. Design System

Uygulama Instagram hissi vermeli fakat birebir marka kopyası olmamalı.

## Design Principles

- edge-to-edge media
- white/light background
- true black dark mode
- minimal dividers
- 1 px borders
- rounded profile avatars
- 44–48px touch targets
- restrained typography
- premium animations
- instant feedback

## Spacing System

```
4, 8, 12, 16, 20, 24, 32
```

## Border Radius

```
8, 12, 16, 20, 999
```

---

# 31. Typography

Native sistem fontları kullan.

| Platform | Font |
|----------|------|
| iOS | SF Pro hissi |
| Android | Roboto/system |

## Type Scale

| Rol | Boyut / Ağırlık |
|-----|-----------------|
| Display | 28 / Bold |
| Heading | 20 / Semibold |
| Title | 16 / Semibold |
| Body | 15 / Regular |
| Caption | 13 / Regular |
| Metric | 28 / Bold |

---

# 32. Dark Mode

Tam dark mode desteği yap.

System preference okuyabilsin.

## Settings Seçenekleri

- System
- Light
- Dark

---

# 33. Animations

Abartılı animasyon kullanma.

## Kullanılacak Animasyonlar

- fade
- scale
- spring
- bottom sheet
- smooth tab indicator
- chart transitions
- number count animation
- press scale
- skeleton loading

**60 FPS hedefle.**

---

# 34. Number Animation

Metric değiştiğinde animasyonlu geçiş:

```
12,482 → 50,000
```

- Counter animation oluştur
- Simulation preset'e basıldığında değer akıcı şekilde yükselsin

---

# 35. Content Types

Aşağıdaki medya türlerini destekle:

- IMAGE
- VIDEO
- REEL
- CAROUSEL_ALBUM

API farklı bir medya türü döndürürse uygulama crash olmamalı.

**Fallback MediaCard** kullan.

# 17. Simulation Lab

Bu uygulamanın özel özelliklerinden biri olacak.

## Dashboard Switch

Dashboard içerisinde:

- **[ REAL DATA ]**
- **[ SIMULATION ]**

switch'i olsun.

**Varsayılan:** REAL DATA

## Simulation Mode Badge

Simulation açıldığında üstte belirgin fakat estetik bir **"Simulation Mode"** badge'i göster.

## Temel Kural

Bu modda **GERÇEK Instagram değerlerini değiştirme**.

Yalnızca local/database simulation overlay oluştur.

## Simüle Edilebilir Metrikler

Örneğin gerçek değer:

```
Views: 12,483
```

Kullanıcı bunu **50,000** yapabilsin.

Aynı şekilde şunlar simülasyon kapsamında değiştirilebilir olsun:

- Likes
- Comments
- Shares
- Saves
- Followers
- Reach
- Profile Visits

---

# 18. Simulation Data Model

Her metric için:

- `realValue`
- `overrideValue`
- `displayValue`

mantığı kullan.

## Örnek

```
realValue = 12483
overrideValue = 50000
```

```
simulationMode === true  → displayValue = overrideValue
simulationMode === false → displayValue = realValue
```

**Gerçek API response hiçbir zaman mutate edilmemeli.**

---

# 19. Metric Editor

Simulation mode açıkken metric kartına uzun basıldığında veya küçük edit ikonuna tıklandığında bottom sheet açılsın.

## Örnek UI

```
Views

Real value:
12,483

Simulated value:
[ 50,000 ]

slider:
0 ---------------------------- 1M

Preset:
+10%  +25%  +50%  2X  5X  10X

Buton:
Apply Simulation

Altında:
Reset to Real Value
```

## Formatting

Numeric input formatter kullan.

Örneğin:

- `12500` → `12.5K`
- `1250000` → `1.25M`

---

# 20. Profile Simulation

Simulation mode sadece dashboard üzerinde değil profil üzerinde de çalışsın.

## Örnek

```
Gerçek:       1,248 followers
Simulation:   15,000 followers
```

Profil ekranında **15K** gösterilebilir.

Ancak ekranın sağ üstünde **SIMULATION** badge'i kalmalı.

Kullanıcı bunun gerçek Instagram verisi olmadığını açıkça görebilmeli.

---

# 21. Post Simulation

Post detayında likes, comments, views simüle edilebilsin.

## Örnek

```
Original:
1,284 likes
68 comments
24.5K views

Simulation:
8,420 likes
410 comments
128K views
```

Postun gerçek Instagram verisini değiştirmeye çalışma.

---

# 22. Before / After

Simulation ekranına **Compare** özelliği ekle.

## Layout

```
         REAL       SIMULATION
Views    12.4K       50K
Likes     824        4.5K
Comments   48         240
Reach     9.2K       38K
Followers 11.3K      20K
```

Bu alan screenshot alınabilecek kadar kaliteli tasarlansın.

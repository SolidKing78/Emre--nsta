# 5. Backend Mimarisi

Backend'i frontend'den soyutla.

## Servis Katmanı

Aşağıdaki servis katmanını oluştur:

```
services/
  auth/
  instagram/
  analytics/
  simulation/
  recommendations/
```

## Tercih Edilen Mimari

```
Expo App
    ↓
Backend API / Edge Functions
    ↓
Meta Instagram API
```

Mobil uygulamanın doğrudan Instagram API access token saklamasını mümkün olduğunca engelle.

## Backend Sorumlulukları

Backend şu işlemleri yönetsin:

- Instagram OAuth callback
- authorization code exchange
- token refresh
- Instagram API proxy
- kullanıcı hesap eşleştirme
- analytics snapshot
- simulation state
- user preferences

## Backend Çözümü

Backend çözümü olarak **Supabase** kullanılabilir.

---

# 6. Database

Aşağıdaki tabloları tasarla.

## users

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| email | String |
| created_at | Timestamp |
| updated_at | Timestamp |

## instagram_accounts

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| user_id | FK → users |
| instagram_account_id | String |
| username | String |
| name | String |
| profile_picture_url | String |
| account_type | Enum |
| media_count | Integer |
| token_encrypted | Text (encrypted) |
| token_expires_at | Timestamp |
| connected_at | Timestamp |
| updated_at | Timestamp |

## media_snapshots

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| instagram_account_id | FK → instagram_accounts |
| instagram_media_id | String |
| media_type | Enum |
| permalink | String |
| thumbnail_url | String |
| media_url | String |
| caption | Text |
| timestamp | Timestamp |
| created_at | Timestamp |

## metric_snapshots

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| instagram_account_id | FK → instagram_accounts |
| instagram_media_id | String (nullable) |
| metric_name | String |
| metric_value | Numeric |
| snapshot_time | Timestamp |

## simulation_profiles

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| user_id | FK → users |
| instagram_account_id | FK → instagram_accounts |
| name | String |
| is_active | Boolean |
| created_at | Timestamp |

## simulation_values

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| simulation_profile_id | FK → simulation_profiles |
| instagram_media_id | String (nullable) |
| metric_name | String |
| original_value | Numeric |
| simulated_value | Numeric |
| updated_at | Timestamp |

## recommendations

| Alan | Tip |
|------|-----|
| id | UUID / Primary Key |
| instagram_account_id | FK → instagram_accounts |
| instagram_media_id | String (nullable) |
| recommendation_type | String |
| title | String |
| description | Text |
| priority | Integer |
| created_at | Timestamp |

## Güvenlik Notu

**Token değerlerini plaintext olarak database'te bırakma.**

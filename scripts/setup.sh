#!/usr/bin/env bash
# SocialLens — macOS / Linux kurulum scripti
# Kullanım: bash scripts/setup.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "SocialLens kurulumu başlıyor..."

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: Node.js bulunamadı. https://nodejs.org adresinden Node 20+ yükleyin."
  exit 1
fi

echo "Node: $(node -v)"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env oluşturuldu (.env.example'dan kopyalandı)"
else
  echo ".env zaten mevcut, atlanıyor"
fi

echo "Bağımlılıklar yükleniyor..."
npm install

echo ""
echo "Kurulum tamam!"
echo "Başlatmak için:  npm start"
echo "Expo Go ile QR kodu tarayın, Demo Hesapla Devam Et seçin."

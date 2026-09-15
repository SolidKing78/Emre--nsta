# SocialLens — Windows kurulum scripti
# Kullanım: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "SocialLens kurulumu basliyor..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "HATA: Node.js bulunamadi. https://nodejs.org adresinden Node 20+ yukleyin." -ForegroundColor Red
  exit 1
}

$nodeVersion = node -v
Write-Host "Node: $nodeVersion"

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host ".env olusturuldu (.env.example'dan kopyalandi)" -ForegroundColor Green
} else {
  Write-Host ".env zaten mevcut, atlaniyor" -ForegroundColor Yellow
}

Write-Host "Bagimliliklar yukleniyor..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "Kurulum tamam!" -ForegroundColor Green
Write-Host "Baslatmak icin:  npm start" -ForegroundColor White
Write-Host "Expo Go ile QR kodu tarayin, Demo Hesapla Devam Et secin." -ForegroundColor White

@echo off
chcp 65001 >nul
title SocialLens — Expo (tunnel)

rem Emre PC proje klasoru
set "PROJECT_DIR=C:\Users\Emre\Desktop\Social-Lens"

rem .bat proje icindeyse otomatik o klasoru kullan
if exist "%~dp0package.json" set "PROJECT_DIR=%~dp0"

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
  echo [HATA] Klasor bulunamadi: %PROJECT_DIR%
  pause
  exit /b 1
)

echo.
echo  SocialLens baslatiliyor...
echo  Klasor: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi.
  echo        https://nodejs.org adresinden Node 20+ yukleyin.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Ilk kurulum: bagimliliklar yukleniyor...
  call npm run setup
  if errorlevel 1 (
    echo [HATA] Kurulum basarisiz.
    pause
    exit /b 1
  )
  echo.
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo .env olusturuldu.
  )
)

echo Expo tünel modu aciliyor...
echo Telefona exp://... linkini veya QR kodu gonderin.
echo Kapatmak icin bu pencerede Ctrl+C veya pencereyi kapat.
echo.

call npx expo start --tunnel

if errorlevel 1 (
  echo.
  echo [HATA] Expo baslatilamadi.
  pause
  exit /b 1
)

pause

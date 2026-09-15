#!/usr/bin/env node
/**
 * Cross-platform setup: copies .env.example → .env if missing, then npm install.
 * Windows:  npm run setup
 * macOS:    npm run setup
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

console.log('SocialLens kurulumu başlıyor...\n');

const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (major < 20) {
  console.error(`HATA: Node 20+ gerekli (mevcut: ${nodeVersion})`);
  process.exit(1);
}
console.log(`Node: ${nodeVersion}`);

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('.env oluşturuldu (.env.example kopyalandı)');
} else {
  console.log('.env zaten mevcut, atlanıyor');
}

console.log('\nBağımlılıklar yükleniyor...');
execSync('npm install', { cwd: root, stdio: 'inherit' });

console.log('\n✓ Kurulum tamam!');
console.log('  npm start          → Expo başlat');
console.log('  npm run start:lan  → Aynı Wi-Fi (LAN)');
console.log('  npm run start:tunnel → Farklı ağ (tunnel)');

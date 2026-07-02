# TriTech Hub iOS — Android APK Generation Guide

This guide explains how to build and distribute the Android APK for TriTech Hub iOS.

## What is an APK?

An APK (Android Package) is a compiled app file that Android users can download and install directly on their phones, without needing the Google Play Store.

## Prerequisites

You'll need:
- **Node.js** (v18+)
- **Java Development Kit (JDK)** (v11+)
- **Android SDK** (installed via Android Studio)
- **Bubblewrap** (installed via npm)

## Setup (First Time Only)

### 1. Install Java

```bash
# macOS
brew install openjdk@11

# Linux (Ubuntu)
sudo apt-get install openjdk-11-jdk

# Windows
# Download from https://adoptium.net/
```

### 2. Install Android SDK

```bash
# macOS
brew install --cask android-sdk

# Linux / Windows
# Download Android Studio from https://developer.android.com/studio
```

Set environment variables:
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
export ANDROID_HOME=~/Library/Android/sdk  # macOS
# OR
export ANDROID_HOME=$HOME/Android/Sdk      # Linux
```

### 3. Accept Android Licenses

```bash
$ANDROID_HOME/tools/bin/sdkmanager --licenses
# Press 'y' to accept all
```

## Build the APK

### Option 1: Generate APK (Recommended)

```bash
# Build the APK with pre-configured settings
npm run build:apk

# This will:
# - Use android/bubblewrap.json config
# - Sign the APK (you'll be prompted for a keystore)
# - Output to: dist/app-release-signed.apk
```

### Option 2: Initialize from Scratch

If you want to reconfigure:

```bash
npm run build:apk:init

# Follow the prompts to customize the APK settings
# (usually you can press enter for defaults)
```

## Signing the APK

On first build, you'll be asked to create a keystore file:

```
Keystore path: android/tritech.keystore
Keystore password: [create a strong password]
Key alias: tritech
Key password: [same as keystore, or different]
```

**⚠️ IMPORTANT:** Save these credentials in a safe place. You'll need them to update the app later.

## Testing the APK

### On a Connected Android Phone

```bash
# Connect your phone via USB (enable Developer Mode first)
adb install dist/app-release-signed.apk

# The app will install and appear on home screen
```

### Using an Emulator

```bash
# Start Android Emulator (from Android Studio)
# Then:
adb install dist/app-release-signed.apk
```

## Distribution Methods

### 1. Direct Download Link

Host the APK on your server:

```bash
# Copy to your web server
cp dist/app-release-signed.apk /var/www/tritechhub/downloads/
chmod 644 /var/www/tritechhub/downloads/app-release-signed.apk
```

Users download from: `https://tritechhub.online/downloads/app-release-signed.apk`

### 2. GitHub Releases

Create a GitHub Release and upload the APK:

```bash
gh release create v1.0.0 dist/app-release-signed.apk \
  --title "TriTech Hub iOS v1.0.0" \
  --notes "Android app for staff and customers"
```

Users download from: `https://github.com/nanayaw01my/TriTech_Hub_ios/releases`

### 3. Email Distribution

Attach `dist/app-release-signed.apk` to emails sent to staff/customers.

### 4. Google Play Store (Future)

To publish to Play Store, submit the APK through [Google Play Console](https://play.google.com/console/).

## Updating the APK

When you have new features or bug fixes:

1. **Increment the version** in `android/bubblewrap.json`:
   ```json
   "appVersionName": "1.0.1",
   "appVersion": 2
   ```

2. **Rebuild**:
   ```bash
   npm run build:apk
   ```

3. **Distribute** the new APK using any method above

Users will be prompted to update when they install the newer version.

## Installation Instructions for Users

Share these instructions with Android users:

### Enable Installation from Unknown Sources

On Android 8+, this happens per-app:
1. Open **Settings** → **Apps** → **Special app access**
2. Select **Install unknown apps**
3. Find your browser (Chrome, Firefox, etc.)
4. Toggle **Allow from this source**

### Install the APK

1. Download the APK file
2. Tap it to install
3. Tap "Install" when prompted
4. Wait for installation to complete
5. Tap "Open" to launch TriTech Hub iOS

### Add to Home Screen

Once installed:
1. Open TriTech Hub iOS
2. Tap ⋮ (menu) → "Install app"
3. Confirm installation
4. App icon appears on home screen

## Troubleshooting

### "Could not find Java"

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
npm run build:apk
```

### "Android SDK not found"

```bash
export ANDROID_HOME=~/Library/Android/sdk
npm run build:apk
```

### "Keystore not found"

You'll be prompted to create a new one. Make sure to save the password.

### App crashes after install

Check logs:
```bash
adb logcat | grep tritechhub
```

## APK Size

Typical size: **~10-15 MB**

## Security

- APK is **signed** with your private key (in `android/tritech.keystore`)
- Never commit the keystore to git (already in `.gitignore`)
- Users verify authenticity from the signature

## Version Numbering

- **appVersion**: Integer, increments by 1 each release (required for Play Store)
- **appVersionName**: Semantic versioning (1.0.0, 1.0.1, etc.)

Always increment `appVersion` when you rebuild, otherwise Android won't allow installation over the old version.

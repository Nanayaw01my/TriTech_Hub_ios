#!/bin/bash

# TriTech Hub iOS — Android APK Builder
# Run this once to generate the APK

set -e

echo "🚀 TriTech Hub iOS — Android APK Builder"
echo "=========================================="
echo ""

# Check Java
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Install Java 11+:"
    echo "   macOS: brew install openjdk@11"
    echo "   Linux: sudo apt-get install openjdk-11-jdk"
    exit 1
fi

echo "✅ Java found: $(java -version 2>&1 | head -1)"

# Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME not set. Set it with:"
    echo "   export ANDROID_HOME=~/Library/Android/sdk  (macOS)"
    echo "   export ANDROID_HOME=\$HOME/Android/Sdk     (Linux)"
    exit 1
fi

echo "✅ Android SDK: $ANDROID_HOME"

# Install dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Build frontend
echo ""
echo "🏗️  Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Install Bubblewrap
echo ""
echo "📱 Installing Bubblewrap..."
npm install --global @bubblewrap/cli

# Build APK
echo ""
echo "🔨 Building Android APK..."
echo "   (First run will ask for keystore password)"
echo "   (Save this password safely!)"
echo ""

npx @bubblewrap/cli build --config android/bubblewrap.json

echo ""
echo "=========================================="
echo "✅ APK built successfully!"
echo "📁 Location: dist/app-release-signed.apk"
echo ""
echo "Next steps:"
echo "1. Test on phone: adb install dist/app-release-signed.apk"
echo "2. Share with users: email, GitHub Releases, or your server"
echo "3. See ANDROID_APK_GUIDE.md for full instructions"
echo "=========================================="

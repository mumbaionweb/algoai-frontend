#!/bin/bash

# Script to help update Firebase config in .env.local
# This will auto-fill values that can be derived and prompt for the rest

PROJECT_ID="algo-ai-477010"
ENV_FILE=".env.local"

echo "🔥 Firebase Config Updater"
echo "=========================="
echo ""
echo "This script will help you update your .env.local with Firebase credentials."
echo ""

# Check if .env.local exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.local not found!"
    exit 1
fi

# Auto-fill values that can be derived
AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com"
PROJECT_ID_VALUE="$PROJECT_ID"
STORAGE_BUCKET="${PROJECT_ID}.appspot.com"

echo "✅ Auto-filled values (from project ID):"
echo "   - AUTH_DOMAIN: $AUTH_DOMAIN"
echo "   - PROJECT_ID: $PROJECT_ID_VALUE"
echo "   - STORAGE_BUCKET: $STORAGE_BUCKET"
echo ""

# Prompt for values that need to be copied from Firebase Console
echo "📋 You need to get these 3 values from Firebase Console:"
echo "   👉 https://console.firebase.google.com/project/${PROJECT_ID}/settings/general"
echo ""
echo "   Steps:"
echo "   1. Scroll to 'Your apps' section"
echo "   2. Click on your web app (or create one if needed)"
echo "   3. Copy these values:"
echo "      - apiKey (starts with 'AIzaSy...')"
echo "      - messagingSenderId (numbers only)"
echo "      - appId (format: '1:123456789012:web:abc123')"
echo ""
read -p "Press Enter when you have Firebase Console open..."

echo ""
read -p "Enter Firebase API Key (AIzaSy...): " API_KEY
read -p "Enter Messaging Sender ID (numbers only): " SENDER_ID
read -p "Enter App ID (1:123456789012:web:abc123): " APP_ID

# Validate inputs
if [ -z "$API_KEY" ] || [ -z "$SENDER_ID" ] || [ -z "$APP_ID" ]; then
    echo "❌ All fields are required!"
    exit 1
fi

# Backup original file
cp "$ENV_FILE" "${ENV_FILE}.backup"
echo "✅ Created backup: ${ENV_FILE}.backup"

# Update the file using sed (works on macOS)
sed -i '' "s|NEXT_PUBLIC_FIREBASE_API_KEY=.*|NEXT_PUBLIC_FIREBASE_API_KEY=${API_KEY}|g" "$ENV_FILE"
sed -i '' "s|NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=.*|NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${AUTH_DOMAIN}|g" "$ENV_FILE"
sed -i '' "s|NEXT_PUBLIC_FIREBASE_PROJECT_ID=.*|NEXT_PUBLIC_FIREBASE_PROJECT_ID=${PROJECT_ID_VALUE}|g" "$ENV_FILE"
sed -i '' "s|NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=.*|NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${STORAGE_BUCKET}|g" "$ENV_FILE"
sed -i '' "s|NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=.*|NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${SENDER_ID}|g" "$ENV_FILE"
sed -i '' "s|NEXT_PUBLIC_FIREBASE_APP_ID=.*|NEXT_PUBLIC_FIREBASE_APP_ID=${APP_ID}|g" "$ENV_FILE"

echo ""
echo "✅ Updated .env.local with Firebase config!"
echo ""
echo "📝 Updated values:"
grep "NEXT_PUBLIC_FIREBASE" "$ENV_FILE"
echo ""
echo "⚠️  Don't forget to restart your dev server:"
echo "   npm run dev"
echo ""


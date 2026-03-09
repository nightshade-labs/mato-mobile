# Mato

Mato is a Solana mobile trading app, where users choose an amount and a duration and let orders stream into the market over time.

## Continuous Clearing Auctions

It uses a continuous clearing auction: the market clears continuously as buy and sell flow changes. That is cool because it can reduce instantaneous price impact, make execution fairer, and weaken toxic flow such as sandwiching.

![Continuous Clearing Auction](assets/cca.png)

## Build And Install

Requirements: Node.js, Android Studio, an Android phone with USB debugging enabled, and `adb`.

Create a `.env` file with:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Build the APK:

```bash
npm install
npm run android:build
cd android
./gradlew assembleRelease
```

Install it on your phone:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

If you do not want to use `adb`, copy `android/app/build/outputs/apk/release/app-release.apk` to your phone and open it there.

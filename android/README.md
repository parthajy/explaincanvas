# ExplainCanvas for Android

The Android app is a Trusted Web Activity: a signed wrapper that opens explaincanvas.com full screen in Chrome's
engine, with no browser bar. Everything the site does, the app does. Nothing is rebuilt.

## What is in this folder

| Path | What | In git? |
| --- | --- | --- |
| `pwabuilder/out-v3/ExplainCanvas.aab` | The app bundle to upload to Google Play (minSdk 24, version 1.0.1, code 3) | no |
| `pwabuilder/out-v3/ExplainCanvas.apk` | Installable build for testing on a phone (`adb install` or send the file) | no |
| `pwabuilder/out/signing.keystore` + `signing-key-info.txt` | The upload signing key and its passwords. Back these up somewhere safe. Losing them means a new package name and a new listing. | no |
| `pwabuilder/out/source/` | The Android Studio project, if you ever want to customise the wrapper | no |
| `pwabuilder/request.json` | The exact PWABuilder request used to generate the package | no (holds the key password) |
| `store/` | Icon, feature graphic and listing copy for the Play Console | yes |

Package name: `com.explaincanvas.app`. Current upload: version 1.0.1, version code 3, minimum Android 7.0 (API 24), which Play's automatic protection requires. `pwabuilder/out/` holds the first build (API 21) and is superseded.

The key store and key passwords are the ones in `signing-key-info.txt` (PWABuilder generated them; `request.json` passwords were not used).

## What the app shows

Signed out, the app opens on three onboarding screens (Ask, See, Check) with Skip and Next, then the sign-in page.
The screens are shown once per device; later launches go straight to sign-in. The marketing site never appears
inside the app. Signed in, the app opens on the chat, exactly like the website.

## How the site knows it is inside the app

The wrapper launches `https://explaincanvas.com/?source=app`. The proxy sets a one-year `ec_app` cookie and
redirects to `/`. With that cookie, the pricing page and account page hide every buy button and say that
plans are managed on the website. Google Play requires its own billing for digital purchases made inside an
app, so the app sells nothing. Credits bought on the web work in the app immediately.

Asset links live at `/.well-known/assetlinks.json`, generated from `ANDROID_SHA256_FINGERPRINTS`. Chrome checks
that file to allow full-screen mode; if the fingerprint does not match, the app still works but shows a URL bar.

## Publishing, step by step

1. **Play Console account.** https://play.google.com/console, one-time fee of USD 25, identity verification
   (government ID, a few days). Choose a personal account unless you have a registered business.
2. **Create the app.** Name ExplainCanvas, default language English (India), app, free.
3. **Play App Signing.** Accept it when prompted. Upload `ExplainCanvas.aab` to Internal testing first.
   Then open Release, Setup, App signing and copy the **App signing key certificate** SHA-256. Add it to
   `ANDROID_SHA256_FINGERPRINTS` next to the existing one (comma-separated) in `.env.production` and redeploy.
   Google re-signs the app with that key, so asset links must list it or the URL bar appears.
4. **Store listing.** Copy from `store/listing.md`. Upload `store/icon-512.png` and
   `store/feature-graphic-1024x500.png`, plus 4 to 8 phone screenshots (1080x1920 or similar) taken from the
   installed app: chat, a diagram, a 3D model, the library, the account page.
5. **Policy forms.** Privacy policy URL `https://explaincanvas.com/legal/privacy`. Account deletion URL `https://explaincanvas.com/delete-account`. Data safety: collects email
   and name for account, user content (questions, photos) for app functionality, not shared, encrypted in
   transit, deletable from Account. Content rating questionnaire: Education, no user-to-user communication.
   Target audience: 13 and over (parents create accounts for younger children). Ads: none.
6. **Closed testing.** New personal accounts must run a closed test with at least 12 testers opted in for
   14 days before production is unlocked. Create a Closed testing track, add tester emails or a Google Group,
   share the opt-in link. Testers install from Play; their phones should show full screen with no URL bar.
7. **Production.** After the 14 days, apply for production access in the console, then promote the same
   release to Production. Review usually takes a few days.

## Updating the app

The app shows whatever the website serves, so most changes need no new release. Release a new version only
to change the wrapper itself (name, icon, colours, start URL, Android settings). Regenerate with the same
request at https://www.pwabuilder.com (or the API in `request.json`), set `signingMode` to `"mine"` with the
existing `signing.keystore`, bump `appVersion` and `appVersionCode`, upload the new `.aab`.

## Testing without Play

`adb install pwabuilder/out/ExplainCanvas.apk`, or copy the APK to the phone and open it. Android will warn
about an unknown source; that is expected for a sideloaded build.

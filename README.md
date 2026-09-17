# Event App

Expo SDK 57, React Native 0.86 and TypeScript application for iOS and Android.

## Run

Use Node.js 22. Run `npm install`, then `npx expo start`. Open the QR code with Expo Go for SDK 57. The phone and computer should share a network. `npm run ios` and `npm run android` open an available simulator/emulator.

The application uses Expo Go-compatible native modules. A development build is not required for the implemented features. The custom `eventapp://` scheme is registered in an installed application build; Expo Go uses Expo development URLs. Shared links to locally created events only resolve on devices with that event's data.

## Structure

- `app/`: 16 screen routes plus root layout and missing-route fallback.
- `src/screens/`: welcome, three onboarding steps, approval, interests, discovery, event details, rooms/chat, map, ten-step event creation, search, notifications and profile.
- `src/native/`: reusable native components, image picking, sharing, navigation and persisted state.
- `src/theme/styles.ts`: StyleSheet tokens preserving the original dark/gold palette and spacing.
- `assets/fonts/`: bundled Outfit and Fraunces fonts with OFL licenses.

`npm install` uses the committed dependency versions. `.npmrc` disables automatic peer installation because optional desktop/browser peers pulled in by Router are unnecessary for the two mobile targets. Required mobile modules are declared explicitly and validated against Expo's bundled compatibility map.

## Validation

- `npm run typecheck`
- `npx expo install --check`
- `npm test`: renders all 16 screen states against native host mocks; checks search, participation/cancellation, persisted state, every event-creation step and route coverage.
- `npm run export:native`: generates both iOS and Android Metro/Hermes bundles.

Host-mock tests and bundle export do not replace device testing. Camera permission prompts, keyboard/safe areas, gestures and visual fidelity still require verification in Expo Go on physical iOS/Android devices. This machine's Xcode license has not been accepted, so simulator verification was unavailable.

## Current data and behavior

The original prototype's sample users, events, Turkish text and application flows are retained. Profile edits, interests, participation, saved events, created events and chat messages persist locally using AsyncStorage. Selected photos are copied into the app's document directory. Date/time selection, image picking, copying and system sharing use native APIs.

There is no backend, production login, real membership approval, shared chat service or push-notification service. Approval/reference simulations and the existing “Yakında” feature cards remain prototype behavior. The original map is a stylized local discovery visualization, not GPS/map-provider data; its original approximate distances and date labels remain sample data. Notification items are original sample content. Remote event/avatar images require internet and have a fallback on failure.

EAS preview/production profiles are provided in `eas.json`. Set your own application identifiers in `app.json` before store distribution.

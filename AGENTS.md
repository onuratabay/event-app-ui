# Event App

Expo SDK 57 + React Native + TypeScript application for iOS and Android.

- `app/`: Expo Router routes, native stack and safe-area/keyboard setup.
- `src/screens/`: Existing application screens. Preserve their Turkish copy and dark/gold visual design.
- `src/components/`: Shared cards, controls, icons and bottom navigation.
- `src/native/UI.tsx`: Native layout, typography, press feedback, scrolling, images and sheets.
- `src/native/Store.tsx`: AsyncStorage-backed local prototype state.
- `src/theme/styles.ts`: React Native StyleSheet tokens.
- `src/data.ts`: Original sample users, events and messages.
- `assets/fonts/`: Bundled Outfit/Fraunces fonts and licenses.

Use native components and StyleSheet. Do not introduce DOM elements, CSS, WebView or a web bundler.

Run `npm install`, `npx expo start`, `npm run typecheck`, `npm test`, and `npx expo install --check`.
`npm run export:native` checks both platform bundles. Device verification remains separate from host-mock tests and Metro export.

New routes require a default export. Keep route names aligned with `src/types.ts` and preserve native back navigation.

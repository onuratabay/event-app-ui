# EwentApp logo

`ewentapp-logo.png` is the main app logo: a transparent 1024 × 1024 embossed tile with about 1.2% minimum padding. Used by the installed app icon. The website has an identical copy named `assets/ewentapp-logo.png` because it deploys independently.

Created using the built-in imagegen tool with the prompt: "Remove the outer flat background; preserve the embossed rounded tile and W; clean the alpha edge; no redesign." Fitted to the canvas without changing its aspect ratio.

`app.config.js` runs `scripts/prepare-brand-icons.cjs` to derive an opaque iOS icon and mask-safe Android foreground into ignored `.cache/brand/`. These are generated build artifacts, not alternative source logos. Delete the cache to regenerate. The original `ewent-w.png` is used by the create-event navigation button; `ewent-wordmark-transparent.png` is used by the welcome screen, discovery header and event share cards. The in-app splash screen uses the same standalone W inside its animated glass tile. These in-app assets retain their original artwork.

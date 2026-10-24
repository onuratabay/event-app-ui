# EwentApp logo

`ewentapp-logo.png` is the only source logo: a transparent 1024 × 1024 embossed tile with about 1.2% minimum padding. Used by the installed app icon, welcome screen, discovery header, navigation and share cards. The website has an identical copy named `assets/ewentapp-logo.png` because it deploys independently.

Created using the built-in imagegen tool with the prompt: "Remove the outer flat background; preserve the embossed rounded tile and W; clean the alpha edge; no redesign." Fitted to the canvas without changing its aspect ratio.

`app.config.js` runs `scripts/prepare-brand-icons.cjs` to derive an opaque iOS icon and mask-safe Android foreground into ignored `.cache/brand/`. These are generated build artifacts, not alternative source logos. Delete the cache to regenerate. Old logo files have been removed.

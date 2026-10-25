import { Image } from "expo-image";

export const BRAND_NAME = "Ewent.app";
/** The website as people read it (always capitalised); links use BRAND_URL. */
export const BRAND_SITE = "Ewent.app";
export const BRAND_URL = "https://ewent.app";

export const BRAND_LOGO = require("../../assets/brand/ewentapp-logo.png");

export function BrandLogo({ size = 72 }: { size?: number }) {
  return <Image source={BRAND_LOGO} accessibilityLabel={BRAND_NAME} contentFit="contain"
    style={{ width: size, height: size }} />;
}

/** Original artwork for in-app headers and share cards. */
export const BRAND_WORDMARK = require("../../assets/brand/ewent-wordmark-transparent.png");

export function BrandWordmark({ width = 150 }: { width?: number }) {
  return <Image source={BRAND_WORDMARK} accessibilityLabel={BRAND_NAME} contentFit="contain"
    style={{ width, height: width / 3 }} />;
}

/** Original standalone W for the create-event button. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <Image source={require("../../assets/brand/ewent-w.png")} accessible={false}
    contentFit="contain" style={{ width: size, height: size * 158 / 240 }} />;
}

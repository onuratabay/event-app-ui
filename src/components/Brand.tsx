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

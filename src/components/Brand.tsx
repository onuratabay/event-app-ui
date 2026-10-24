import { Image } from "expo-image";

export const BRAND_NAME = "Ewent.app";
/** The website as people read it (always capitalised); links use BRAND_URL. */
export const BRAND_SITE = "Ewent.app";
export const BRAND_URL = "https://ewent.app";

export function BrandWordmark({ width = 150 }: { width?: number }) {
  return <Image source={require("../../assets/brand/ewent-wordmark-transparent.png")}
    accessibilityLabel={BRAND_NAME} contentFit="contain"
    style={{ width, height: width / 3 }} />;
}

/** The W cut from the wordmark (same glossy artwork), aspect 240:158. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <Image source={require("../../assets/brand/ewent-w.png")} accessible={false}
    contentFit="contain" style={{ width: size, height: size * 158 / 240 }} />;
}

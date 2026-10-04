import { Image } from "expo-image";

export const BRAND_NAME = "ewent.app";
export const BRAND_URL = "https://ewent.app";

export function BrandWordmark({ width = 150 }: { width?: number }) {
  return <Image source={require("../../assets/brand/ewent-wordmark-transparent.png")}
    accessibilityLabel={BRAND_NAME} contentFit="contain"
    style={{ width, height: width / 3 }} />;
}

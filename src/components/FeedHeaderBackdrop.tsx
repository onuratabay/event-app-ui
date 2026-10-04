import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

// Short strips gradually reduce both blur and tint below the action row.
// The transparent tail blends into the scrolling feed without a divider.
export default function FeedHeaderBackdrop() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: undefined, height: 96 }]}>
    <BlurView intensity={38} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 68 }} />
    {Array.from({ length: 14 }, (_, index) => {
      const fade = 1 - (index + 0.5) / 14;
      return <BlurView key={index} intensity={38 * fade} tint="dark"
        style={{ position: "absolute", top: 68 + index * 2, left: 0, right: 0, height: 2, opacity: fade }} />;
    })}
    <LinearGradient colors={["rgba(8,11,24,.56)", "rgba(8,11,24,.32)", "rgba(8,11,24,0)"]}
      locations={[0, 68 / 96, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill} />
  </View>;
}

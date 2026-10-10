import type { ReactNode } from "react"
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Box, type NativeStyleProp } from "./UI"
import { palette } from "../theme/palette"

/** Background fills the window; only content avoids cutouts and system bars. */
export default function Screen({ children, background, canvas, style }: {
  children: ReactNode
  background?: ReactNode
  canvas?: ReactNode
  style?: NativeStyleProp
}) {
  const { position, top, bottom, left, right, height, width, backgroundColor, overflow, ...content } = StyleSheet.flatten(style) || {}
  return <View style={[styles.root, { backgroundColor: backgroundColor || palette.background }]}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>{background}</View>
    {canvas}
    <KeyboardAvoidingView pointerEvents="box-none" style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <SafeAreaView pointerEvents="box-none" style={styles.fill} edges={["top", "right", "bottom", "left"]}>
        <Box pointerEvents="box-none" style={[content, styles.fill]}>{children}</Box>
      </SafeAreaView>
    </KeyboardAvoidingView>
  </View>
}
const styles = StyleSheet.create({
  root: { flex: 1, width: "100%", overflow: "hidden" },
  fill: { flex: 1, minHeight: 0, minWidth: 0 },
})

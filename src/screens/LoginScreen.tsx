import { useState } from "react"
import { AtmoBackground } from "../components/GlassUI"
import { ErrorNotice } from "../components/ErrorNotice"
import { Field, Label, Touch, Box } from "../native/UI"
import { getApiErrorMessage, login } from "../api/client"
import { useStore } from "../native/Store"
import type { NavigateFn } from "../types"
import { ui } from "../theme/styles"

export default function LoginScreen({ navigate }: { navigate: NavigateFn }) {
  const { refreshEvents } = useStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const submit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("E-posta ve şifre gerekli.")
      return
    }
    setErrorMessage(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      await refreshEvents()
      navigate("discover")
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Bilgilerini kontrol edip tekrar dene."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box style={[[ui.flex, ui.bg06060e, ui.px8, ui.justifyCenter, ui.overflowHidden]]}>
      <AtmoBackground variant="violet" />
      <Box style={[[ui.relative, ui.spaceY4]]}>
        <Label style={[[ui.fontDisplay, ui.text4xl, ui.textWhite]]}>Tekrar hoş geldin.</Label>
        <Label style={[[ui.textWhite50, ui.leadingRelaxed]]}>Vibeus hesabınla devam et.</Label>
        {errorMessage && (
          <ErrorNotice
            title="Giriş yapılamadı"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
            onRetry={submit}
          />
        )}
        <Field
          mode="email"
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          autoComplete="email"
          style={[[ui.mt4, ui.p4, ui.roundedXl, ui.bgWhite8, ui.textWhite]]}
        />
        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          secureTextEntry
          style={[[ui.p4, ui.roundedXl, ui.bgWhite8, ui.textWhite]]}
        />
        <Touch
          onPress={submit}
          disabled={busy}
          style={[[ui.p4, ui.roundedXl, ui.textCenter, ui.fontSemibold, { color: "#1a1200" }]]}
          gradient={["#c8a44a", "#dab96e", "#c09038"]}
        >
          {busy ? "Bağlanıyor..." : "Giriş Yap"}
        </Touch>
        <Touch onPress={() => navigate("welcome")} style={[[ui.p3, ui.textCenter, ui.textWhite50]]}>
          Vazgeç
        </Touch>
      </Box>
    </Box>
  )
}
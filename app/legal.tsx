import { useLocalSearchParams } from "expo-router"
import type { LegalDocumentType } from "../src/api/client"
import { LEGAL_TITLES } from "../src/legal/links"
import { useNavigate } from "../src/native/navigation"
import Screen from "../src/screens/LegalScreen"
export default function Route() {
  const navigate = useNavigate()
  const { type } = useLocalSearchParams<{ type?: string }>()
  const known = type && type in LEGAL_TITLES ? type as LegalDocumentType : "privacy"
  return <Screen navigate={navigate} type={known} />
}

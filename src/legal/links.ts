import { useRouter, type Href } from "expo-router"
import { useCallback } from "react"
import type { LegalDocumentType } from "../api/client"

export const LEGAL_TITLES: Record<LegalDocumentType, string> = {
  terms: "Kullanım Koşulları",
  community: "Topluluk Kuralları",
  privacy: "Gizlilik Politikası",
  kvkk: "KVKK Aydınlatma Metni",
  marketing: "Ticari Elektronik İleti Bilgilendirme Metni",
}

/**
 * Opens a legal text above the current page. Unlike `navigate`, it always pushes, so going back
 * returns to the sign-up form (with its inputs) instead of being redirected away from sign-in pages.
 */
export function useOpenLegal() {
  const router = useRouter()
  return useCallback((type: LegalDocumentType) => router.push({ pathname: "/legal", params: { type } } as Href), [router])
}

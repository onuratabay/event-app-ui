/** Replace URLs with approved, published documents before a production build. */
export const legalDocuments = {
  privacy: {
    title: "Gizlilik bildirimi",
    url: process.env.EXPO_PUBLIC_PRIVACY_URL,
  },
  terms: {
    title: "Kullanım koşulları",
    url: process.env.EXPO_PUBLIC_TERMS_URL,
  },
} as const;

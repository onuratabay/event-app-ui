import { useState } from 'react'
import { Box, Label, Touch, openExternal } from '../native/UI'
import { legalDocuments } from '../content/legal'
import { palette } from '../theme/palette'

export default function LegalConsent({ accepted, onChange }: { accepted: boolean; onChange: (value: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const available = Boolean(legalDocuments.privacy.url && legalDocuments.terms.url)
  return <Box style={{ marginTop: 16, borderWidth: 1, borderColor: palette.border, borderRadius: 18, overflow: 'hidden' }}>
    <Touch accessibilityLabel="Gizlilik ve kullanım koşullarını aç" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ padding: 16 }}>
      <Label>Gizlilik ve kullanım koşulları {open ? '▴' : '▾'}</Label>
    </Touch>
    {open && <Box style={{ padding: 16, gap: 12 }}>
      <Label>Başvurunu tamamlamadan önce aşağıdaki belgeleri okuyabilirsin.</Label>
      {Object.values(legalDocuments).map(doc => <Touch key={doc.title} disabled={!doc.url} onPress={() => { if (doc.url) void openExternal(doc.url).catch(() => setError('Belge açılamadı. Lütfen yeniden dene.')) }} style={{ padding: 12 }}><Label>{doc.title} · Oku</Label></Touch>)}
      {!available && <Label style={{ color: palette.muted }}>Onaylı belgeler henüz yayımlanmamış. Belge bağlantıları eklendiğinde bu bölümden okuyup kabul edebilirsin.</Label>}
      {error && <Label accessibilityRole="alert">{error}</Label>}
      <Touch accessibilityRole="checkbox" accessibilityLabel="Gizlilik ve kullanım koşullarını kabul ediyorum" accessibilityState={{ checked: accepted }} disabled={!available} onPress={() => onChange(!accepted)} style={{ padding: 12, flexDirection: 'row', gap: 10 }}>
        <Label>{accepted ? '☑' : '☐'}</Label><Label style={{ flex: 1 }}>Gizlilik bildirimini ve kullanım koşullarını okudum, kabul ediyorum.</Label>
      </Touch>
    </Box>}
  </Box>
}

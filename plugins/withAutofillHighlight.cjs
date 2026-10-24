const { withAndroidStyles, withDangerousMod, AndroidConfig } = require('expo/config-plugins')
const fs = require('node:fs/promises')
const path = require('node:path')

// Android draws this over autofilled controls. Alpha keeps white input text readable.
const AUTOFILL_HIGHLIGHT_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#336978FF" />
    <corners android:radius="16dp" />
</shape>
`
function withAutofillHighlight(config) {
  config = withAndroidStyles(config, config => {
    config.modResults = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:autofilledHighlight',
      value: '@drawable/ewent_autofill_highlight',
    })
    return config
  })
  return withDangerousMod(config, ['android', async config => {
    const directory = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/drawable')
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, 'ewent_autofill_highlight.xml'), AUTOFILL_HIGHLIGHT_XML)
    return config
  }])
}
module.exports = withAutofillHighlight
module.exports.AUTOFILL_HIGHLIGHT_XML = AUTOFILL_HIGHLIGHT_XML

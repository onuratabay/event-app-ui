// Feed ad placement: the first ad after four events, then one after every eight, never at the end.
module.exports = async function checkAds() {
  const assert = require("node:assert/strict")
  const { withAdSlots, adsModule } = require("../src/ads/ads.ts")
  const events = n => Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}` }))
  const positions = list => list.map((item, i) => item.ad ? i + 1 : null).filter(Boolean)
  assert.deepEqual(positions(withAdSlots(events(30), true)), [5, 14, 23, 32], "An ad after the 4th, 12th, 20th and 28th event")
  assert.deepEqual(positions(withAdSlots(events(4), true)), [], "Four events or fewer: no ad, nothing ends the feed with an ad")
  assert.deepEqual(positions(withAdSlots(events(5), true)), [5])
  assert.equal(withAdSlots(events(12), true).filter(item => !item.ad).length, 12, "Every event is kept")
  assert.deepEqual(withAdSlots(events(30), false).map(item => item.id), events(30).map(item => item.id), "Without ads the feed is unchanged")
  assert.equal(adsModule(), null, "Outside a native build the ads SDK is never loaded")
  console.log("PASS: feed ads after the 4th event and every 8 events, none at the end, none without the native SDK.")
}

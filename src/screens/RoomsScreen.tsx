import BackButton from "../components/BackButton";
import { Circle, Path, Polygon, Polyline, Rect } from "react-native-svg";
import BottomNav from "../components/BottomNav";
import { ComingSoonCard } from "../components/Expressive";
import { AtmoBackground, GlassCard } from "../components/GlassUI";
import { useStore } from "../native/Store";
import { Box, Label, Picture, Scroll, Touch, Vector } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
}
export default function RoomsScreen({
  navigate
}: Props) {
  const {
    data: store
  } = useStore();
  const EVENTS = store.events;
  const activeEvents = EVENTS.filter(e => e.isActive && (e.host.id === "me" || e.participants.some(p => p.id === "me")));
  const formingEvents = EVENTS.filter(e => !e.isActive);
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.overflowHidden]]}>
      <AtmoBackground />

      <Scroll style={[[ui.relative, ui.hFull, ui.pb28]]}>
        <Box style={[[ui.pt14, ui.px5, ui.pb5]]}>
          <BackButton navigate={navigate} fallback="discover" onPress={() => navigate("discover")} />
          <Label style={[[ui.fontDisplay, ui.text3xl, ui.fontLight, ui.textWhite, ui.mb1]]}>
            Etkinliklerim
          </Label>
          <Label style={[[ui.textXs, ui.textWhite35]]}>
            Katıldığın ve düzenlediğin etkinlikler
          </Label>
        </Box>

        {/* Active rooms */}
        <Box style={[[ui.px5, ui.mb6]]}>
          <Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Aktif Odalar
          </Label>
          {activeEvents.length > 0 ? <Box style={[[ui.spaceY3]]}>
              {activeEvents.map(event => <Touch key={event.id} onPress={() => navigate("event-room", {
            eventId: event.id
          })} style={[[ui.wFull, ui.textLeft]]}>
                  <GlassCard style={[[ui.p4, ui.borderEmerald40010]]}>
                    <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                      <Box style={[[ui.relative]]}>
                        <Picture uri={event.coverImage} accessibilityLabel="" style={[[ui.w12, ui.h12, ui.roundedXl]]} />
                        <Box style={[[ui.fixed, ui.Top1, ui.Right1, ui.w35, ui.h35, ui.roundedFull, ui.bgEmerald400, ui.border2, ui.border06060e]]} />
                      </Box>
                      <Box style={[[ui.flex1, ui.minW0]]}>
                        <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite85]]} numberOfLines={1}>
                          {event.title}
                        </Label>
                        <Label style={[[ui.textXs, ui.textWhite40]]}>
                          {event.date} · {event.time}
                        </Label>
                        <Box style={[[ui.flex, ui.itemsCenter, ui.gap15, ui.mt1]]}>
                          <Box style={[[ui.flex]]}>
                            {event.participants.slice(0, 4).map(p => <Picture key={p.id} uri={p.avatar} accessibilityLabel="" style={[[ui.w4, ui.h4, ui.roundedFull]]} />)}
                          </Box>
                          <Label style={[[ui.text10px, ui.textWhite30]]}>
                            {event.participants.length} katılımcı
                          </Label>
                        </Box>
                      </Box>
                      <Box style={[[ui.flex, ui.flexCol, ui.itemsEnd, ui.gap1]]}>
                        <Label style={[[ui.text10px, ui.textEmerald400, ui.fontMedium]]}>
                          Aktif
                        </Label>
                        <Label style={[[ui.text10px, ui.textWhite30]]}>
                          Odaya gir →
                        </Label>
                      </Box>
                    </Box>
                  </GlassCard>
                </Touch>)}
            </Box> : <GlassCard style={[[ui.p6, ui.textCenter]]}>
              <Label style={[[ui.text2xl, ui.mb2, ui.opacity30]]}>🚀</Label>
              <Label style={[[ui.textSm, ui.textWhite35]]}>
                Henüz aktif etkinliğin yok.
              </Label>
              <Touch onPress={() => navigate("discover")} style={[[ui.mt3, ui.textXs, ui.textC8a44a, ui.underline]]}>
                Etkinlikleri keşfet
              </Touch>
            </GlassCard>}
        </Box>

        {/* Forming events */}
        <Box style={[[ui.px5, ui.mb6]]}>
          <Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Katılımcı Bekleyenler
          </Label>

          <Box style={[[ui.spaceY3]]}>
            {formingEvents.map(event => <Touch key={event.id} onPress={() => navigate("event-detail", {
            eventId: event.id
          })} style={[[ui.wFull, ui.textLeft]]}>
                <GlassCard style={[[ui.p4]]}>
                  <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
                    <Picture uri={event.coverImage} accessibilityLabel="" style={[[ui.w12, ui.h12, ui.roundedXl, ui.opacity60]]} />
                    <Box style={[[ui.flex1, ui.minW0]]}>
                      <Label style={[[ui.textSm, ui.fontMedium, ui.textWhite70]]} numberOfLines={1}>
                        {event.title}
                      </Label>
                      <Label style={[[ui.textXs, ui.textWhite35]]}>
                        {event.date} · {event.time}
                      </Label>
                      <Box style={[[ui.mt1, ui.flex, ui.itemsCenter, ui.gap2]]}>
                        <Box style={[[ui.flex1, ui.h1, ui.roundedFull, ui.bgWhite8, ui.overflowHidden]]}>
                          <Box style={[[ui.hFull, ui.roundedFull, ui.bgAmber40060], {
                        width: `${event.currentParticipants / event.minParticipants * 100}%`
                      }]} />
                        </Box>
                        <Label style={[[ui.text10px, ui.textAmber40070]]}>
                          {event.currentParticipants}/{event.minParticipants}
                        </Label>
                      </Box>
                    </Box>
                  </Box>
                </GlassCard>
              </Touch>)}
          </Box>
        </Box>

        {/* Coming soon features */}
        <Box style={[[ui.px5, ui.mb6, ui.spaceY3]]}>
          <Label style={[[ui.textXs, ui.textWhite30, ui.uppercase, ui.trackingWider, ui.mb3]]}>
            Yakında
          </Label>
          <ComingSoonCard accent="violet" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(178,174,248,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <Circle cx="12" cy="10" r="3" />
              </Vector>} title="Canlı Konum Paylaşımı" subtitle="Buluşma noktasını gerçek zamanlı görün, geç kalma." />
          <ComingSoonCard accent="gold" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(200,164,74,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <Rect x="3" y="3" width="18" height="18" rx="2" />
                <Circle cx="8.5" cy="8.5" r="1.5" />
                <Polyline points="21 15 16 10 5 21" />
              </Vector>} title="Etkinlik Fotoğraf Galerisi" subtitle="Anlarını toplulukla paylaş, sonradan tekrar yaşa." />
          <ComingSoonCard accent="emerald" icon={<Vector width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(110,231,183,0.9)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </Vector>} title="Etkinlik Sonrası Puanlama" subtitle="Birlikte geçirdiğin anları değerlendir, güveni birlikte inşa et." />
        </Box>
      </Scroll>

      <BottomNav active="rooms" navigate={navigate} />
    </Box>;
}

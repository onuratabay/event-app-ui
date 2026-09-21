import BackButton from "../components/BackButton";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Alert } from "react-native";
import { AtmoBackground, GlassCard } from "../components/GlassUI";
import { getMessages, sendMessage, getApiErrorMessage, getEvent, type ApiMessage } from "../api/client";
import { EMPTY_USER, mapApiEvent } from "../native/Store";
import { useStore } from "../native/Store";
import { Box, Field, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import { NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
  eventId?: string;
}
export default function EventRoomScreen({
  navigate,
  eventId
}: Props) {
  const {
    data: store,
    setData: setStore
  } = useStore();
  const EVENTS = store.events;
  const ME = store.user;
  const event = EVENTS.find(e => e.id === eventId);
  const [messages, setMessages] = useState<import('../types').ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const mapMessage = (message: ApiMessage) => ({ id: message.id, text: message.text, time: new Date(message.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), user: { ...EMPTY_USER, id: message.user.id, name: `${message.user.firstName} ${message.user.lastName}` } });
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    const load = async () => { try { const result = await getMessages(eventId); if (active) { setMessages(result.items.map(mapMessage)); setError(''); } } catch (cause) { if (active) setError(getApiErrorMessage(cause, 'Mesajlar yüklenemedi.')); } };
    void getEvent(eventId).then(value => { if (active) setStore(p => ({ ...p, events: [mapApiEvent(value), ...p.events.filter(e => e.id !== value.id)] })); }).catch(() => {});
    void load(); const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [eventId]);
  const [input, setInput] = useState("");
  const messagesEnd = useRef<ScrollView>(null);
  useEffect(() => {
    messagesEnd.current?.scrollToEnd({
      animated: true
    });
  }, [messages]);
  const send = async () => {
    if (!input.trim() || !eventId || sending) return;
    setSending(true);
    try { const saved = await sendMessage(eventId, input.trim()); setMessages(prev => [...prev.filter(m => m.id !== saved.id), mapMessage(saved)]); setInput(''); }
    catch (cause) { Alert.alert('Mesaj gönderilemedi', getApiErrorMessage(cause)); }
    finally { setSending(false); }
  };
  if (!event) return <Box><Touch onPress={() => navigate('rooms')}>Geri</Touch><Label>{error || 'Etkinlik yükleniyor…'}</Label></Box>;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />
      {error && <Label>{error}</Label>}

      {/* Header */}
      <Box style={[[ui.relative, ui.pt14, ui.px5, ui.pb3, ui.flexShrink0]]}>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
          <BackButton navigate={navigate} fallback="rooms" onPress={() => navigate("event-detail", { eventId: event.id, back: true })} />
          <Box style={[[ui.flex1, ui.minW0]]}>
            <Label style={[[ui.fontDisplay, ui.textLg, ui.fontLight, ui.textWhite]]} numberOfLines={1}>
              {event.title}
            </Label>
            <Label style={[[ui.textXs, ui.textWhite35]]}>
              {event.categoryEmoji} {event.date} · {event.time} ·{" "}
              {event.location}
            </Label>
          </Box>
          <Box style={[[ui.px25, ui.py1, ui.roundedFull, ui.textXs, ui.textEmerald300], {
          backgroundColor: "rgba(52,211,153,0.12)",
          borderWidth: 1,
          borderColor: "rgba(52,211,153,0.2)"
        }]}>
            ● Aktif
          </Box>
        </Box>
      </Box>

      {/* Event info strip */}
      <Box style={[[ui.px5, ui.pb3, ui.flexShrink0]]}>
        <Scroll style={[[ui.flex, ui.gap2]]} horizontal>
          {[{
          icon: "👥",
          text: `${event.currentParticipants}/${event.maxParticipants} kişi`
        }, {
          icon: "◎",
          text: event.location
        }, {
          icon: "◷",
          text: event.time
        }, {
          icon: "◈",
          text: event.level
        }].map((item, i) => <Box key={i} style={[[ui.flexShrink0, ui.flex, ui.itemsCenter, ui.gap15, ui.px3, ui.py15, ui.roundedFull, ui.textXs, ui.textWhite50], {
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.07)"
        }]}>
              <Label>{item.icon}</Label>
              <Label>{item.text}</Label>
            </Box>)}
        </Scroll>
      </Box>

      {/* Participants row */}
      <Box style={[[ui.px5, ui.pb4, ui.flexShrink0]]}>
        <GlassCard style={[[ui.p3]]}>
          <Box style={[[ui.flex, ui.itemsCenter, ui.gap3]]}>
            <Box style={[[ui.flex]]}>
              {event.participants.slice(0, 5).map(p => <Picture key={p.id} uri={p.avatar} accessibilityLabel={p.name} style={[[ui.w7, ui.h7, ui.roundedFull]]} />)}
            </Box>
            <Box style={[[ui.flex1]]}>
              <Label style={[[ui.textXs, ui.textWhite50]]}>
                {event.participants.slice(0, 2).map(p => p.name.split(" ")[0]).join(", ")}{" "}
                ve diğerleri
              </Label>
            </Box>
            <Touch style={[[ui.textXs, ui.px25, ui.py1, ui.roundedLg, ui.textWhite40, ui.border, ui.borderWhite8]]}>
              Tümü
            </Touch>
          </Box>
        </GlassCard>
      </Box>

      <Box style={[[ui.hPx, ui.mx5, ui.flexShrink0], {
      backgroundColor: "rgba(255,255,255,0.06)"
    }]} />

      {/* Chat */}
      <Scroll ref={messagesEnd} onContentSizeChange={() => messagesEnd.current?.scrollToEnd({
      animated: true
    })} style={[[ui.flex1, ui.px5, ui.py4, ui.spaceY4]]}>
        {messages.map(msg => {
        const isMe = msg.user.id === store.user.id;
        return <Box key={msg.id} style={[[ui.flex, ui.gap25, isMe ? [ui.flexRowReverse] : []]]}>
              {!isMe && <Picture uri={msg.user.avatar} accessibilityLabel={msg.user.name} style={[[ui.w7, ui.h7, ui.roundedFull, ui.flexShrink0, ui.mt05]]} />}
              <Box style={[[ui.maxW72, isMe ? [ui.itemsEnd] : [ui.itemsStart], ui.flex, ui.flexCol, ui.gap1]]}>
                {!isMe && <Box style={[[ui.textXs, ui.textWhite30, ui.ml1, ui.flex, ui.itemsCenter, ui.gap15]]}>
                    {msg.user.name.split(" ")[0]}
                    {msg.isHost && <Label style={[[ui.textC8a44a, ui.text9px, ui.px1, ui.py05, ui.rounded], {
                backgroundColor: "rgba(200,164,74,0.1)"
              }]}>
                        Organizatör
                      </Label>}
                  </Box>}
                <Box style={[[ui.px4, ui.py25, ui.rounded2xl, ui.textSm, ui.leadingRelaxed, isMe ? [ui.roundedTrSm, ui.text1a1200] : [ui.roundedTlSm, ui.textWhite80]], isMe ? {} : {
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.09)"
            }]}>
                  {msg.text}
                </Box>
                <Label style={[[ui.text10px, ui.textWhite20, ui.mx1]]}>
                  {msg.time}
                </Label>
              </Box>
            </Box>;
      })}
      </Scroll>

      {/* Input */}
      <Box style={[[ui.px5, ui.pb8, ui.pt3, ui.flexShrink0]]}>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.rounded2xl, ui.px3, ui.py2], {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)"
      }]} glass>
          <Field value={input} onChangeText={e => setInput(e)} onSubmitEditing={send} placeholder="Bir mesaj yaz..." style={[[ui.flex1, ui.bgTransparent, ui.textSm, ui.textWhite, ui.py15]]} />
          <Touch onPress={send} accessibilityLabel="Mesaj gönder" disabled={sending || !input.trim()} style={[[ui.w9, ui.h9, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0], {}]} gradient={["#c8a44a", "#c09038"]}>
            <Label style={[[ui.text1a1200, ui.textSm]]}>↑</Label>
          </Touch>
        </Box>
      </Box>
    </Box>;
}

import { palette } from "../theme/palette";
import { UsersIcon, LocationIcon, ClockIcon, StarIcon, SendIcon } from "../components/Icons";
import { useScreenActive } from '../native/useScreenActive';
import { EventActivity } from '../components/EventActivity';
import { onSocket, retainEvent, socketAction } from '../services/socket';
import TopNavBar from "../components/TopNavBar";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Alert } from "react-native";
import { AtmoBackground, GlassCard } from "../components/GlassUI";
import { getMessages, getApiErrorMessage, getEvent, type ApiMessage } from "../api/client";
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
  const screenActive = useScreenActive();
  const EVENTS = store.events;
  const ME = store.user;
  const event = EVENTS.find(e => e.id === eventId);
  const [messages, setMessages] = useState<import('../types').ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [typing, setTyping] = useState(false);
  const typingExpiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mapMessage = (message: ApiMessage) => ({ id: message.id, createdAt: message.createdAt, text: message.kind === 'announcement' ? `📣 ${message.text}` : message.text, time: new Date(message.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), user: { ...EMPTY_USER, id: message.user.id, name: `${message.user.firstName} ${message.user.lastName}` } });
  useEffect(() => {
    if (!eventId || !ME.id || !screenActive) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const load = async () => {
      try { const result = await getMessages(eventId, controller.signal); if (active) { setMessages(prev => [...new Map([...result.items.map(mapMessage), ...prev].map(m => [m.id, m])).values()]); setCursor(result.nextCursor || null); setError(''); } }
      catch (cause) { if (active) setError(getApiErrorMessage(cause, 'Mesajlar yüklenemedi.')); }
      finally { if (active) setLoading(false); }
    };
    if (!event) void getEvent(eventId).then(value => { if (active) setStore(p => ({ ...p, events: [mapApiEvent(value), ...p.events.filter(e => e.id !== value.id)] })); }).catch(() => {});
    const release = retainEvent(eventId);
    const unsubscribe = onSocket('chat:message_created', payload => {
      if (payload.eventId !== eventId) return;
      setMessages(prev => [...prev.filter(m => m.id !== payload.message.id), mapMessage(payload.message)]);
      void socketAction('chat:read', { eventId, messageId: payload.message.id }).catch(() => {});
    });
    const announced = onSocket('event:announcement', payload => { if (payload.eventId === eventId) setMessages(prev => [...prev.filter(m => m.id !== payload.message.id), mapMessage(payload.message)]); });
    const typingListener = onSocket('chat:typing', payload => {
      if (payload.eventId !== eventId || payload.userId === ME.id) return;
      setTyping(payload.typing === true);
      if (typingExpiry.current) clearTimeout(typingExpiry.current);
      typingExpiry.current = setTimeout(() => setTyping(false), 3000);
    });
    const sync = onSocket('sync:required', () => { void load(); });
    void load();
    return () => { active = false; controller.abort(); release(); unsubscribe(); announced(); sync(); typingListener(); if (typingExpiry.current) clearTimeout(typingExpiry.current); };
  }, [eventId, reload, ME.id, screenActive]);
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
    try { const saved = await socketAction<ApiMessage>('chat:message', { eventId, text: input.trim() }); setMessages(prev => [...prev.filter(m => m.id !== saved.id), mapMessage(saved)]); setInput(''); void socketAction('chat:typing', { eventId, typing: false }).catch(() => {}); }
    catch (cause) { Alert.alert('Mesaj gönderilemedi', getApiErrorMessage(cause)); }
    finally { setSending(false); }
  };
  if (!event) return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}><TopNavBar navigate={navigate} fallback="rooms" title="Etkinlik Odası" /><Box style={{ paddingTop: 96, paddingHorizontal: 20 }}><Label>{error || 'Etkinlik yükleniyor…'}</Label></Box></Box>;
  return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="rooms" onBack={() => navigate("event-detail", { eventId: event.id, back: true })} title={event.title} subtitle={`${event.date} · ${event.time}`} />
      {error && <Label>{error}</Label>}
      <Touch accessibilityLabel="Mesajları yenile" disabled={loading || sending} onPress={() => setReload(value => value + 1)} style={{ padding: 12, marginTop: 76, backgroundColor: 'rgba(255,255,255,.08)' }}><Label>{loading ? 'Mesajlar yükleniyor…' : 'Mesajları eşitle'}</Label></Touch>

      {/* Event info strip */}
      <Box style={[[ui.px5, ui.pb3, ui.flexShrink0]]}>
        <Scroll style={[[ui.flex, ui.gap2]]} horizontal>
          {[{
          icon: <UsersIcon size={16} />,
          text: `${event.currentParticipants}/${event.maxParticipants} kişi`
        }, {
          icon: <LocationIcon size={16} />,
          text: event.location
        }, {
          icon: <ClockIcon size={16} />,
          text: event.time
        }, {
          icon: <StarIcon size={16} />,
          text: event.level
        }].map((item, i) => <Box key={i} style={[[ui.flexShrink0, ui.flex, ui.itemsCenter, ui.gap15, ui.px3, ui.py15, ui.roundedFull, ui.textXs, ui.textWhite50], {
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.07)"
        }]}>
              <Box style={{ color: palette.muted }}>{item.icon}</Box>
              <Label>{item.text}</Label>
            </Box>)}
        </Scroll>
      </Box>

      <EventActivity event={event} userId={ME.id} active={screenActive} />
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

      {cursor && <Touch disabled={loading} onPress={async () => {
        if (!eventId) return;
        setLoading(true);
        try { const result = await getMessages(eventId, undefined, cursor); setMessages(prev => [...new Map([...result.items.map(mapMessage), ...prev].map(m => [m.id, m])).values()]); setCursor(result.nextCursor || null); }
        catch (cause) { setError(getApiErrorMessage(cause)); } finally { setLoading(false); }
      }}><Label>Önceki mesajları yükle</Label></Touch>}
      {/* Chat */}
      <Scroll ref={messagesEnd} onContentSizeChange={() => messagesEnd.current?.scrollToEnd({
      animated: true
    })} style={[[ui.flex1, ui.px5, ui.py4, ui.spaceY4]]}>
        {messages.slice().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") || a.id.localeCompare(b.id)).map(msg => {
        const isMe = msg.user.id === store.user.id;
        return <Box key={msg.id} style={[[ui.flex, ui.gap25, isMe ? [ui.flexRowReverse] : []]]}>
              {!isMe && <Picture uri={msg.user.avatar} accessibilityLabel={msg.user.name} style={[[ui.w7, ui.h7, ui.roundedFull, ui.flexShrink0, ui.mt05]]} />}
              <Box style={[[ui.maxW72, isMe ? [ui.itemsEnd] : [ui.itemsStart], ui.flex, ui.flexCol, ui.gap1]]}>
                {!isMe && <Box style={[[ui.textXs, ui.textWhite30, ui.ml1, ui.flex, ui.itemsCenter, ui.gap15]]}>
                    {msg.user.name.split(" ")[0]}
                    {msg.isHost && <Label style={[[ui.textC8a44a, ui.text9px, ui.px1, ui.py05, ui.rounded], {
                backgroundColor: "rgba(105,120,255,0.1)"
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

      {typing && <Label>Bir katılımcı yazıyor…</Label>}
      {/* Input */}
      <Box style={[[ui.px5, ui.pb8, ui.pt3, ui.flexShrink0]]}>
        <Box style={[[ui.flex, ui.itemsCenter, ui.gap2, ui.rounded2xl, ui.px3, ui.py2], {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)"
      }]} glass>
          <Field value={input} onChangeText={value => {
            setInput(value);
            if (eventId && Date.now() - lastTyping.current > 1000) { lastTyping.current = Date.now(); void socketAction('chat:typing', { eventId, typing: Boolean(value) }).catch(() => {}); }
          }} onSubmitEditing={send} placeholder="Bir mesaj yaz..." style={[[ui.flex1, ui.bgTransparent, ui.textSm, ui.textWhite, ui.py15]]} />
          <Touch onPress={send} accessibilityLabel="Mesaj gönder" disabled={sending || !input.trim()} style={[[ui.w11, ui.h11, ui.roundedXl, ui.flex, ui.itemsCenter, ui.justifyCenter, ui.flexShrink0], {}]} gradient={["#4d5bcb", "#6651c9"]}>
            <SendIcon size={20} style={{ color: palette.text }} />
          </Touch>
        </Box>
      </Box>
    </Box>;
}

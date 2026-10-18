import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type ScrollView } from "react-native";
import { useKeyboardOverlap } from "../native/useKeyboardOverlap";
import { getApiErrorMessage, getDirectMessages, markDirectRead, openDirectConversation, sendDirectMessage, type DirectConversation, type DirectMessage } from "../api/client";
import { useBottomNavInset } from "../components/BottomNav";
import { AtmoBackground } from "../components/GlassUI";
import { SendIcon } from "../components/Icons";
import TopNavBar from "../components/TopNavBar";
import { useStore } from "../native/Store";
import { useScreenActive } from "../native/useScreenActive";
import { Box, Field, Label, Scroll, Touch } from "../native/UI";
import { onSocket } from "../services/socket";
import { palette } from "../theme/palette";
import type { NavigateFn } from "../types";

// Same limit the backend enforces.
const MAX_MESSAGE_LENGTH = 2000;
type ChatLine = DirectMessage & { pending?: boolean; failed?: boolean };
const instant = (iso?: string) => Date.parse(iso || "") || 0;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const day = new Date(iso); day.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  return diff === 0 ? "Bugün" : diff === 1 ? "Dün" : day.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

/**
 * One-to-one chat with a connection, no event room needed. Once you are no longer connected the
 * history stays readable but the composer is replaced by a notice (the server refuses new messages too).
 */
export default function DirectChatScreen({ navigate, userId }: { navigate: NavigateFn; userId: string }) {
  const navInset = useBottomNavInset();
  // Keeps the composer above the keyboard even where the root does not shrink the screen for it.
  const screenRef = useRef<View>(null);
  const keyboardOverlap = useKeyboardOverlap(screenRef);
  const { data: store } = useStore();
  const meId = store.user.id;
  const screenActive = useScreenActive();
  const [conversation, setConversation] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [input, setInput] = useState("");
  useWalkthroughScreenBlocker(!!input.trim());
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const stickToEnd = useRef(true);
  const conversationId = conversation?.id;
  const upsert = (incoming: ChatLine[]) => setMessages(prev => [...new Map([...prev, ...incoming].map(row => [row.id, row])).values()]);

  useEffect(() => {
    if (!userId || !screenActive) return;
    let active = true;
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    let id: string | null = null;
    const markRead = (delay = 0) => { clearTimeout(readTimer); readTimer = setTimeout(() => { if (id) void markDirectRead(id).catch(() => {}); }, delay); };
    const load = async () => {
      try {
        const opened = await openDirectConversation(userId);
        if (!active) return;
        id = opened.id; setConversation(opened);
        const page = await getDirectMessages(opened.id);
        if (!active) return;
        upsert(page.items); setCursor(page.nextCursor); setOtherReadAt(page.otherReadAt); setError(null);
        markRead();
      } catch (cause) { if (active) setError(getApiErrorMessage(cause, "Sohbet açılamadı.")); }
    };
    // canSend follows the friendship: unfriending (either side) locks the composer at once.
    const refreshAccess = () => { void openDirectConversation(userId).then(next => { if (active) setConversation(next); }).catch(() => {}); };
    const listeners = [
      onSocket("dm:message", (payload: { conversationId: string; message: DirectMessage }) => {
        if (payload.conversationId !== id) return;
        // Our own message may arrive before the send response: drop its pending copy.
        if (payload.message.senderId === meId) setMessages(prev => { const index = prev.findIndex(row => row.pending && row.text === payload.message.text); return index < 0 ? prev : prev.filter((_, i) => i !== index); });
        upsert([payload.message]); stickToEnd.current = true;
        if (payload.message.senderId !== meId) markRead(800);
      }),
      onSocket("dm:read", (payload: { conversationId: string; at: string }) => { if (payload.conversationId === id) setOtherReadAt(payload.at); }),
      onSocket("friend:changed", (payload: { userId: string }) => { if (payload.userId === userId) refreshAccess(); }),
      onSocket("sync:required", () => { void load(); }),
    ];
    void load();
    return () => { active = false; listeners.forEach(stop => stop()); clearTimeout(readTimer); };
  }, [userId, screenActive, meId]);

  const sorted = useMemo(() => messages.slice().sort((a, b) => instant(a.createdAt) - instant(b.createdAt) || a.id.localeCompare(b.id)), [messages]);
  const lastMine = useMemo(() => [...sorted].reverse().find(row => row.senderId === meId && !row.pending && !row.failed), [sorted, meId]);
  const canSend = conversation?.canSend !== false;
  const name = conversation ? `${conversation.user.firstName} ${conversation.user.lastName}`.trim() : "Sohbet";

  // Sends are optimistic and chained so quick messages keep their order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const deliver = (line: ChatLine) => {
    if (!conversationId) return;
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        const saved = await sendDirectMessage(conversationId, line.text);
        setMessages(prev => [...prev.filter(row => row.id !== line.id && row.id !== saved.id), saved]);
        setError(null);
      } catch (cause) {
        // Refused because the connection ended: lock the composer and say why.
        if (cause instanceof Error && /^API 403:/.test(cause.message)) {
          setMessages(prev => prev.filter(row => row.id !== line.id));
          setConversation(current => current ? { ...current, canSend: false } : current);
          setInput(current => current || line.text);
        } else setMessages(prev => prev.map(row => row.id === line.id ? { ...row, pending: false, failed: true } : row));
      }
    });
  };
  const send = () => {
    const text = input.trim();
    if (!text || !conversationId || !canSend) return;
    const now = new Date().toISOString();
    const line: ChatLine = { id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`, conversationId, senderId: meId, text, createdAt: now, pending: true };
    stickToEnd.current = true; upsert([line]); setInput(""); deliver(line);
  };
  const retry = (line: ChatLine) => { setMessages(prev => prev.map(row => row.id === line.id ? { ...row, pending: true, failed: false } : row)); deliver(line); };
  const loadOlder = async () => {
    if (!conversationId || !cursor || loadingOlder) return;
    setLoadingOlder(true); stickToEnd.current = false;
    try { const page = await getDirectMessages(conversationId, cursor); upsert(page.items); setCursor(page.nextCursor); }
    catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setLoadingOlder(false); }
  };
  const seen = !!lastMine && !!otherReadAt && instant(otherReadAt) >= instant(lastMine.createdAt);

  return <View ref={screenRef} style={s.screen}>
    <AtmoBackground />
    <TopNavBar navigate={navigate} fallback="rooms" walkthroughId="direct-person" title={name} subtitle={conversation && !canSend ? "Artık bağlantın değil" : undefined}
      onTitlePress={conversation ? () => navigate("profile", { userId: conversation.user.id }) : undefined} titleHint="Profilini açar" />
    <Box style={s.body}>
      {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
      <Scroll ref={scrollRef} style={s.list} onScrollBeginDrag={() => { stickToEnd.current = false; }}
        onContentSizeChange={() => { if (stickToEnd.current) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false })); }}
        // The keyboard shrinks the list: keep the newest message in view.
        onLayout={() => { if (stickToEnd.current) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false })); }}>
        {cursor ? <Touch disabled={loadingOlder} onPress={() => void loadOlder()} style={s.older}><Label style={s.olderLabel}>{loadingOlder ? "Yükleniyor…" : "Önceki mesajları göster"}</Label></Touch> : null}
        {conversation && !sorted.length ? <Box style={s.empty}>
          <Label style={s.emptyTitle}>{canSend ? "Sohbeti başlat" : "Mesaj yok"}</Label>
          <Label style={s.emptyText}>{canSend ? `${conversation.user.firstName} ile ilk mesajı sen yaz.` : "Bu kişiyle artık mesajlaşamazsın."}</Label>
        </Box> : null}
        {sorted.map((line, index) => {
          const previous = sorted[index - 1];
          const mine = line.senderId === meId;
          const separator = !previous || dayKey(previous.createdAt) !== dayKey(line.createdAt) ? <Label key={`day-${line.id}`} style={s.day}>{dayLabel(line.createdAt)}</Label> : null;
          const grouped = !separator && previous?.senderId === line.senderId;
          return [separator, <Box key={line.id} style={[s.message, mine ? s.alignEnd : s.alignStart, grouped && s.grouped]}>
            <Box style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther, (line.pending || line.failed) && { opacity: 0.65 }]}>
              <Label style={mine ? s.textMine : s.textOther}>{line.text}</Label>
            </Box>
            {line.failed ? <Touch accessibilityLabel="Mesajı tekrar gönder" onPress={() => retry(line)} style={{ minHeight: 0 }}><Label style={[s.time, { color: palette.error }]}>Gönderilemedi · Tekrar dene</Label></Touch>
              : <Label style={s.time}>{timeOf(line.createdAt)}{line.pending ? " · Gönderiliyor…" : ""}</Label>}
            {lastMine && line.id === lastMine.id ? <Label style={s.seen}>{seen ? "Görüldü" : "Gönderildi"}</Label> : null}
          </Box>];
        })}
      </Scroll>
      {conversation && !canSend ? <Box accessibilityRole="alert" style={[s.lockedBar, { paddingBottom: 14 + navInset + keyboardOverlap }]}>
        <Label style={s.lockedTitle}>Yeni mesaj gönderemezsin</Label>
        <Label style={s.lockedText}>{conversation.user.firstName} artık bağlantın değil. Eski mesajlar burada kalır; yeniden bağlantı olursanız sohbete devam edebilirsiniz.</Label>
      </Box> : <Box style={[s.composerWrap, { paddingBottom: 12 + navInset + keyboardOverlap }]}>
        <Box walkthroughId="direct-composer" style={s.composer} glass>
          <Field value={input} onChangeText={setInput} editable={!!conversation} placeholder="Bir mesaj yaz..." placeholderTextColor="rgba(255,255,255,.35)" multiline maxLength={MAX_MESSAGE_LENGTH} style={s.input} />
          <Touch onPress={send} accessibilityLabel="Mesaj gönder" disabled={!input.trim() || !conversation} style={s.send} gradient={["#4d5bcb", "#6651c9"]}>
            <SendIcon size={20} style={{ color: palette.text }} />
          </Touch>
        </Box>
      </Box>}
    </Box>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background, overflow: "hidden" },
  body: { flex: 1, paddingTop: 68 },
  error: { color: palette.error, fontSize: 13, paddingHorizontal: 20, paddingTop: 8 },
  list: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  older: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.06)", marginBottom: 8 },
  olderLabel: { color: palette.accent, fontSize: 12, lineHeight: 16 },
  empty: { alignItems: "center", gap: 6, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 20, lineHeight: 26 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  day: { alignSelf: "center", color: "rgba(255,255,255,.45)", fontSize: 11, lineHeight: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,.05)", marginVertical: 12 },
  message: { marginTop: 10, gap: 3, maxWidth: "80%" },
  grouped: { marginTop: 3 },
  alignEnd: { alignSelf: "flex-end", alignItems: "flex-end" },
  alignStart: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { backgroundColor: "#4d5bcb", borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: "rgba(255,255,255,.07)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", borderBottomLeftRadius: 6 },
  textMine: { color: "#ffffff", fontSize: 15, lineHeight: 21 },
  textOther: { color: "rgba(255,255,255,.85)", fontSize: 15, lineHeight: 21 },
  time: { color: "rgba(255,255,255,.3)", fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  seen: { color: palette.accent, fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  lockedBar: { paddingHorizontal: 20, paddingTop: 14, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, backgroundColor: "rgba(243,155,175,.08)" },
  lockedTitle: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  lockedText: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 6 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 6, paddingLeft: 14, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  input: { flex: 1, minHeight: 40, maxHeight: 120, color: palette.text, fontSize: 15, paddingVertical: 9 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});

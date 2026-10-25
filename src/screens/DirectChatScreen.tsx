import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { showAlert } from "../components/AppDialog"
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View, type ViewInstance } from "react-native";
import { useKeyboardOverlap } from "../native/useKeyboardOverlap";
import { deleteDirectMessage, editDirectMessage, reportUser, getApiErrorMessage, getDirectMessages, markDirectRead, openDirectConversation, sendDirectMessage, type DirectConversation, type DirectMessage } from "../api/client";
import { useBottomNavInset } from "../components/BottomNav";
import { AtmoBackground, Avatar } from "../components/GlassUI";
import ActionSheet, { REPORT_REASONS, type SheetOption } from "../components/ActionSheet";
import * as Clipboard from "expo-clipboard";
import { SendIcon } from "../components/Icons";
import { ReplyBar, ReplyQuote, SwipeToReply } from "../components/ChatReply";
import TopNavBar from "../components/TopNavBar";
import { useStore } from "../native/Store";
import { useScreenActive } from "../native/useScreenActive";
import { Box, ChatList, Field, Label, Touch } from "../native/UI";
import { onSocket, socketAction, socketConnected } from "../services/socket";
import { cachedConversation, cachedMessages, hydrateChatCache, markDirectSynced, noteRead, rememberConversation, rememberMessages } from "../services/chat-cache";
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
  const screenRef = useRef<ViewInstance>(null);
  const { overlap: keyboardOverlap, onLayout: onScreenLayout } = useKeyboardOverlap(screenRef);
  const { data: store } = useStore();
  const meId = store.user.id;
  const screenActive = useScreenActive();
  // The chat shows at once from what the phone keeps (the list, earlier visits, also after a restart);
  // the network only catches up with what is new.
  const cachedChat = meId ? cachedConversation(meId, userId) : undefined;
  const cachedPage = meId && cachedChat ? cachedMessages(meId, cachedChat.id) : undefined;
  const [conversation, setConversation] = useState<DirectConversation | null>(cachedChat ?? null);
  const [messages, setMessages] = useState<ChatLine[]>(cachedPage?.items ?? []);
  const [cursor, setCursor] = useState<string | null>(cachedPage?.cursor ?? null);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(cachedPage?.otherReadAt ?? null);
  // "Sohbeti başlat" shows only once the messages are known (saved or loaded), never while they load.
  const [loaded, setLoaded] = useState(!!cachedPage);
  const [input, setInput] = useState("");
  useWalkthroughScreenBlocker(!!input.trim());
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const conversationId = conversation?.id;
  const messagesRef = useRef<ChatLine[]>(messages);
  messagesRef.current = messages;
  // Replies quoting an incoming (e.g. edited or deleted) message show its new text too.
  const upsert = (incoming: ChatLine[]) => setMessages(prev => {
    const byId = new Map(incoming.map(row => [row.id, row]));
    const quoted = (row: ChatLine) => { const source = row.replyTo ? byId.get(row.replyTo.id) : undefined; return source && row.replyTo ? { ...row, replyTo: { ...row.replyTo, text: source.deleted ? "" : source.text.slice(0, 300), deleted: !!source.deleted } } : row; };
    return [...new Map([...prev, ...incoming].map(row => [row.id, quoted(row)])).values()];
  });

  useEffect(() => {
    if (!userId || !screenActive || !meId) return;
    let active = true;
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    let id: string | null = cachedConversation(meId, userId)?.id ?? null;
    // Read marks are remembered on the device at once (the chat list drops its badge immediately)
    // and sent to the server; leaving the chat sends one more.
    const markRead = (delay = 0) => {
      if (id) noteRead(meId, id);
      clearTimeout(readTimer);
      readTimer = setTimeout(() => { if (id) void markDirectRead(id).catch(() => {}); }, delay);
    };
    const catchUp = async (chatId: string) => {
      // Only what came after the point the saved copy is known complete (messages that arrived live while
      // the chat was closed are already shown; any gap before them is filled here). Nothing saved: newest page.
      const after = cachedMessages(meId, chatId)?.syncedAt;
      let page = await getDirectMessages(chatId, undefined, after);
      // A very long gap: the newest page instead (earlier messages load on scroll).
      const full = !after || page.items.length >= 100;
      if (after && full) page = await getDirectMessages(chatId);
      if (!active) return;
      upsert(page.items); setOtherReadAt(page.otherReadAt); setError(null); setLoaded(true);
      if (full) setCursor(page.nextCursor);
      // Compare instants, not strings (REST sends "+03:00", the socket "Z").
      const newestShown = [...messagesRef.current, ...(page.items as ChatLine[])].filter(row => !row.pending && !row.failed).reduce<string | undefined>((at, row) => !at || instant(row.createdAt) > instant(at) ? row.createdAt : at, undefined);
      markDirectSynced(meId, chatId, newestShown);
      markRead();
    };
    const load = async () => {
      try {
        if (id) {
          // Known chat: messages catch up and the chat's details (canSend, online) refresh side by side.
          const chatId = id;
          markRead();
          void openDirectConversation(userId).then(opened => { if (active) { setConversation(opened); rememberConversation(meId, opened); } }).catch(() => {});
          await catchUp(chatId);
        } else {
          const opened = await openDirectConversation(userId);
          if (!active) return;
          id = opened.id; setConversation(opened); rememberConversation(meId, opened);
          await catchUp(opened.id);
        }
      } catch (cause) { if (active) { setError(getApiErrorMessage(cause, "Sohbet açılamadı.")); setLoaded(true); } }
    };
    // canSend follows the friendship: unfriending (either side) locks the composer at once.
    const refreshAccess = () => { void openDirectConversation(userId).then(next => { if (active) setConversation(next); }).catch(() => {}); };
    const listeners = [
      onSocket("dm:message", (payload: { conversationId: string; message: DirectMessage }) => {
        if (payload.conversationId !== id) return;
        // Our own message may arrive before the send response: drop its pending copy.
        if (payload.message.senderId === meId) setMessages(prev => { const index = prev.findIndex(row => row.pending && row.text === payload.message.text); return index < 0 ? prev : prev.filter((_, i) => i !== index); });
        upsert([payload.message]);
        if (payload.message.senderId !== meId) markRead(800);
      }),
      // Deleted by its sender (here or on another device): shows as "Bu mesaj silindi" at once.
      onSocket("dm:message_updated", (payload: { conversationId: string; message: DirectMessage }) => { if (payload.conversationId === id) upsert([payload.message]); }),
      onSocket("dm:read", (payload: { conversationId: string; at: string }) => { if (payload.conversationId === id) setOtherReadAt(payload.at); }),
      onSocket("friend:changed", (payload: { userId: string }) => { if (payload.userId === userId) refreshAccess(); }),
      onSocket("presence:changed", (payload: { userId: string; online: boolean }) => { if (payload.userId === userId) setConversation(current => current ? { ...current, online: payload.online } : current); }),
      onSocket("sync:required", () => { void load(); }),
    ];
    // Saved chats load from the phone first (a few ms on a cold start), then the network catches up.
    void hydrateChatCache(meId).then(() => {
      if (!active) return;
      const saved = cachedConversation(meId, userId);
      if (saved && !id) id = saved.id;
      if (saved) setConversation(current => current ?? saved);
      const page = saved ? cachedMessages(meId, saved.id) : undefined;
      if (page && !messagesRef.current.length) { setMessages(page.items); setCursor(page.cursor); setOtherReadAt(page.otherReadAt); setLoaded(true); messagesRef.current = page.items; }
      void load();
    });
    return () => {
      active = false; listeners.forEach(stop => stop()); clearTimeout(readTimer);
      if (id) { noteRead(meId, id); void markDirectRead(id).catch(() => {}); }
    };
  }, [userId, screenActive, meId]);

  // Remember the newest sent messages for the next time this chat opens.
  useEffect(() => {
    if (!meId || !conversationId || !loaded) return;
    rememberMessages(meId, conversationId, messages.filter(row => !row.pending && !row.failed).sort((a, b) => instant(a.createdAt) - instant(b.createdAt)), cursor, otherReadAt);
  }, [meId, conversationId, loaded, messages, cursor, otherReadAt]);
  const sorted = useMemo(() => messages.slice().sort((a, b) => instant(a.createdAt) - instant(b.createdAt) || a.id.localeCompare(b.id)), [messages]);
  // The list is drawn newest first and flipped (inverted): it starts at the bottom, stays there as messages
  // arrive or the keyboard opens, and only the rows on screen are rendered.
  const newestFirst = useMemo(() => sorted.slice().reverse(), [sorted]);
  const lastMine = useMemo(() => [...sorted].reverse().find(row => row.senderId === meId && !row.pending && !row.failed), [sorted, meId]);
  const canSend = conversation?.canSend !== false;
  const name = conversation ? `${conversation.user.firstName} ${conversation.user.lastName}`.trim() : "Sohbet";

  // Sends are optimistic and chained so quick messages keep their order.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const deliver = (line: ChatLine) => {
    if (!conversationId) return;
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        // Over the open connection when there is one (no new HTTP request per message); HTTP while it reconnects.
        // A timed-out socket send is not retried over HTTP, so a message is never sent twice.
        const replyToId = line.replyTo?.id;
        const saved = socketConnected() ? await socketAction<DirectMessage>("dm:message", { conversationId, text: line.text, ...(replyToId ? { replyToId } : {}) }) : await sendDirectMessage(conversationId, line.text, replyToId);
        setMessages(prev => [...prev.filter(row => row.id !== line.id && row.id !== saved.id), saved]);
        setError(null);
      } catch (cause) {
        // Refused because the connection ended: lock the composer and say why.
        if (cause instanceof Error && (/^API 403:/.test(cause.message) || cause.message.startsWith("FORBIDDEN"))) {
          setMessages(prev => prev.filter(row => row.id !== line.id));
          setConversation(current => current ? { ...current, canSend: false } : current);
          setInput(current => current || line.text);
        } else setMessages(prev => prev.map(row => row.id === line.id ? { ...row, pending: false, failed: true } : row));
      }
    });
  };
  const send = () => {
    if (editing) { void saveEdit(); return; }
    const text = input.trim();
    if (!text || !conversationId || !canSend) return;
    const now = new Date().toISOString();
    const line: ChatLine = { id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`, conversationId, senderId: meId, text, createdAt: now, pending: true,
      ...(replyTo ? { replyTo: { id: replyTo.id, senderId: replyTo.senderId, text: replyTo.text.slice(0, 300) } } : {}) };
    upsert([line]); setInput(""); setReplyTo(null); deliver(line);
  };
  // "Cevapla": pulling a message right (or the option under a long press) quotes it in the next message.
  const [replyTo, setReplyTo] = useState<ChatLine | null>(null);
  const canReply = (line: ChatLine) => canSend && !line.deleted && !line.pending && !line.failed && !line.id.startsWith("local-");
  const startReply = (line: ChatLine) => { if (!canReply(line)) return; setEditing(null); setReplyTo(line); };
  const authorOf = (senderId: string) => senderId === meId ? "Sen" : conversation?.user.firstName || "Mesaj";
  // Tapping a quote scrolls to the answered message (when it is loaded) and marks it for a moment.
  const listRef = useRef<FlatList<ChatLine>>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const showQuoted = (id: string) => {
    const index = newestFirst.findIndex(row => row.id === id);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    setHighlighted(id); setTimeout(() => setHighlighted(current => current === id ? null : current), 1400);
  };
  // Long press on a message opens the same options as in event rooms: copy; edit and delete your own;
  // report someone else's.
  const [sheet, setSheet] = useState<{ title?: string; options: SheetOption[] } | null>(null);
  const [editing, setEditing] = useState<ChatLine | null>(null);
  const [saving, setSaving] = useState(false);
  const report = (line: ChatLine) => setSheet({
    title: `${conversation?.user.firstName ?? "Bu kişiyi"} neden şikayet ediyorsun?`,
    options: REPORT_REASONS.map(reason => ({ label: reason, onPress: () => {
      if (!conversation) return;
      void reportUser(conversation.user.id, `Mesaj şikayeti (${reason}) · birebir sohbet: "${line.text.slice(0, 500)}"`)
        .then(() => showAlert("Şikayetin alındı", "Ekibimiz inceleyecek. Teşekkürler."))
        .catch(cause => showAlert("Şikayet gönderilemedi", getApiErrorMessage(cause)));
    } })),
  });
  const openActions = (line: ChatLine) => {
    if (line.deleted || line.pending || line.failed) return;
    const mine = line.senderId === meId;
    const options: SheetOption[] = [{ label: "Kopyala", onPress: () => { void Clipboard.setStringAsync(line.text).catch(() => {}); } }];
    if (canReply(line)) options.unshift({ label: "Cevapla", onPress: () => startReply(line) });
    if (mine && canSend) options.push({ label: "Düzenle", onPress: () => { setReplyTo(null); setEditing(line); setInput(line.text); } });
    if (mine) options.push({ label: "Sil", danger: true, onPress: () => removeMessage(line) });
    else options.push({ label: "Şikayet et", danger: true, onPress: () => report(line) });
    setSheet({ title: line.text.slice(0, 80), options });
  };
  const saveEdit = async () => {
    const text = input.trim();
    if (!editing || !conversationId || !text || saving) return;
    setSaving(true);
    try { upsert([await editDirectMessage(conversationId, editing.id, text)]); setEditing(null); setInput(""); }
    catch (cause) { showAlert("Mesaj düzenlenemedi", getApiErrorMessage(cause)); }
    finally { setSaving(false); }
  };
  // "Sil" in the options deletes at once (no second confirmation); a failure brings the message back.
  const removeMessage = (line: ChatLine) => {
    if (!conversationId || line.senderId !== meId || line.deleted || line.pending || line.failed) return;
    upsert([{ ...line, text: "", deleted: true }]);
    deleteDirectMessage(conversationId, line.id).then(saved => upsert([saved])).catch(cause => { upsert([line]); showAlert("Mesaj silinemedi", getApiErrorMessage(cause)); });
  };
  const retry = (line: ChatLine) => { setMessages(prev => prev.map(row => row.id === line.id ? { ...row, pending: true, failed: false } : row)); deliver(line); };
  const loadOlder = async () => {
    if (!conversationId || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    try { const page = await getDirectMessages(conversationId, cursor); upsert(page.items); setCursor(page.nextCursor); }
    catch (cause) { setError(getApiErrorMessage(cause)); }
    finally { setLoadingOlder(false); }
  };
  const seen = !!lastMine && !!otherReadAt && instant(otherReadAt) >= instant(lastMine.createdAt);

  return <View ref={screenRef} onLayout={onScreenLayout} style={s.screen}>
    <AtmoBackground />
    {/* The person's photo beside the name; the server sends it only to members with a photo of their own
        (otherwise the initial shows). */}
    <TopNavBar navigate={navigate} fallback="rooms" walkthroughId="direct-person" title={name}
      leading={conversation ? <Avatar uri={conversation.user.profilePhoto || ""} name={name} size="sm" /> : undefined} subtitle={conversation ? !canSend ? "Artık bağlantın değil" : conversation.online ? "● Çevrimiçi" : "Çevrimdışı" : undefined}
      onTitlePress={conversation ? () => navigate("profile", { userId: conversation.user.id }) : undefined} titleHint="Profilini açar" />
    <Box style={s.body}>
      {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
      {/* Empty and loading states sit outside the flipped list (an inverted list would turn them upside down). */}
      {/* No loader: until the messages arrive the area just stays empty (saved chats show at once). */}
      {!loaded && !sorted.length ? <Box style={{ flex: 1 }} />
        : conversation && loaded && !sorted.length ? <Box style={[s.empty, { flex: 1 }]}>
          <Label style={s.emptyTitle}>{canSend ? "Sohbeti başlat" : "Mesaj yok"}</Label>
          <Label style={s.emptyText}>{canSend ? `${conversation.user.firstName} ile sohbeti ilk mesajınla başlat.` : "Bu kişiyle artık mesajlaşamazsın."}</Label>
        </Box>
        : <ChatList
          listRef={listRef}
          data={newestFirst}
          // Scrolling to an answered message far up: jump near it first, then settle on it.
          onScrollToIndexFailed={({ index, averageItemLength }) => { listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true }); setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 250); }}
          keyExtractor={line => line.id}
          style={{ flex: 1 }}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          // Reaching the top (the end of a flipped list) loads earlier messages.
          onEndReached={() => { void loadOlder(); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={cursor ? <Touch disabled={loadingOlder} onPress={() => void loadOlder()} style={s.older}><Label style={s.olderLabel}>{loadingOlder ? "Yükleniyor…" : "Önceki mesajları göster"}</Label></Touch> : undefined}
          renderItem={({ item: line, index }) => {
            // In the flipped list the older neighbour is the next item and the newer one the previous.
            const previous = newestFirst[index + 1];
            const following = newestFirst[index - 1];
            const mine = line.senderId === meId;
            const separator = !previous || dayKey(previous.createdAt) !== dayKey(line.createdAt) ? <Label style={s.day}>{dayLabel(line.createdAt)}</Label> : null;
            const grouped = !separator && previous?.senderId === line.senderId;
            // Like the rooms: messages from the same person in the same minute share one time, under the last of them.
            const sharesTime = !!following && following.senderId === line.senderId && !following.pending && !following.failed && dayKey(following.createdAt) === dayKey(line.createdAt) && timeOf(following.createdAt) === timeOf(line.createdAt);
            return <View>
              {separator}
              <SwipeToReply enabled={canReply(line)} onReply={() => startReply(line)}>
              <Box style={[s.message, mine ? s.alignEnd : s.alignStart, grouped && s.grouped, highlighted === line.id && s.highlighted]}>
                <Touch accessibilityLabel={!line.deleted ? "Mesaj seçenekleri" : undefined} accessibilityHint={!line.deleted ? "Basılı tut; cevaplamak için sağa kaydır" : undefined} haptic={false} disabled={!!line.deleted} disabledOpacity={1}
                  onLongPress={() => openActions(line)} style={[s.bubble, line.deleted ? s.bubbleDeleted : mine ? s.bubbleMine : s.bubbleOther, (line.pending || line.failed) && { opacity: 0.65 }, { minHeight: 0 }]}>
                  {line.replyTo && !line.deleted ? <ReplyQuote author={authorOf(line.replyTo.senderId)} text={line.replyTo.text} deleted={line.replyTo.deleted} mine={mine} onPress={() => showQuoted(line.replyTo!.id)} /> : null}
                  <Label style={line.deleted ? s.deletedText : mine ? s.textMine : s.textOther}>{line.deleted ? "Bu mesaj silindi" : line.text}</Label>
                </Touch>
                {line.failed ? <Touch accessibilityLabel="Mesajı tekrar gönder" onPress={() => retry(line)} style={{ minHeight: 0 }}><Label style={[s.time, { color: palette.error }]}>Gönderilemedi · Tekrar dene</Label></Touch>
                  : (line.pending || line.editedAt || !sharesTime) ? <Label style={s.time}>{timeOf(line.createdAt)}{line.pending ? " · Gönderiliyor…" : ""}{line.editedAt && !line.deleted ? " · düzenlendi" : ""}</Label> : null}
                {lastMine && line.id === lastMine.id ? <Label style={s.seen}>{seen ? "Görüldü" : "Gönderildi"}</Label> : null}
              </Box>
              </SwipeToReply>
            </View>;
          }}
        />}
      {conversation && !canSend ? <Box accessibilityRole="alert" style={[s.lockedBar, { paddingBottom: 14 + navInset + keyboardOverlap }]}>
        <Label style={s.lockedTitle}>Yeni mesaj gönderemezsin</Label>
        <Label style={s.lockedText}>{conversation.user.firstName} artık bağlantın değil. Eski mesajlar burada kalır; yeniden bağlantı olursanız sohbete devam edebilirsiniz.</Label>
      </Box> : <Box style={[s.composerWrap, { paddingBottom: 12 + navInset + keyboardOverlap }]}>
        {editing ? <Box style={s.editBar}>
          <Label style={s.editLabel} numberOfLines={1}>✎ Mesajı düzenliyorsun</Label>
          <Touch accessibilityLabel="Düzenlemeyi iptal et" onPress={() => { setEditing(null); setInput(""); }} style={s.editCancel}><Label style={s.editCancelLabel}>Vazgeç</Label></Touch>
        </Box> : replyTo ? <ReplyBar author={authorOf(replyTo.senderId)} text={replyTo.text} onCancel={() => setReplyTo(null)} /> : null}
        <Box walkthroughId="direct-composer" style={s.composer} glass>
          <Field value={input} onChangeText={setInput} editable={!!conversation} placeholder={editing ? "Mesajı düzenle…" : "Bir mesaj yaz…"} placeholderTextColor="rgba(255,255,255,.35)" multiline maxLength={MAX_MESSAGE_LENGTH} style={s.input} />
          <Touch onPress={send} accessibilityLabel={editing ? "Düzenlemeyi kaydet" : "Mesaj gönder"} disabled={!input.trim() || !conversation || saving} style={s.send} gradient={["#4d5bcb", "#6651c9"]}>
            {editing ? <Label style={s.sendCheck}>✓</Label> : <SendIcon size={20} style={{ color: palette.text }} />}
          </Touch>
        </Box>
      </Box>}
    </Box>
    {sheet ? <ActionSheet title={sheet.title} options={sheet.options} onClose={() => setSheet(null)} /> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background, overflow: "hidden" },
  body: { flex: 1, paddingTop: 68 },
  error: { color: palette.error, fontSize: 13, paddingHorizontal: 20, paddingTop: 8 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  older: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.06)", marginBottom: 8 },
  olderLabel: { color: palette.accent, fontSize: 12, lineHeight: 16 },
  empty: { alignItems: "center", gap: 6, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 20, lineHeight: 26 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  day: { alignSelf: "center", color: "rgba(255,255,255,.45)", fontSize: 11, lineHeight: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,.05)", marginVertical: 12 },
  message: { marginTop: 10, gap: 3, maxWidth: "80%" },
  grouped: { marginTop: 3 },
  highlighted: { backgroundColor: "rgba(105,120,255,.16)", borderRadius: 20 },
  alignEnd: { alignSelf: "flex-end", alignItems: "flex-end" },
  alignStart: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { backgroundColor: "#4d5bcb", borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: "rgba(255,255,255,.07)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", borderBottomLeftRadius: 6 },
  textMine: { color: "#ffffff", fontSize: 15, lineHeight: 21 },
  textOther: { color: "rgba(255,255,255,.85)", fontSize: 15, lineHeight: 21 },
  bubbleDeleted: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderStyle: "dashed" },
  deletedText: { color: "rgba(255,255,255,.4)", fontSize: 14, lineHeight: 20, fontStyle: "italic" },
  time: { color: "rgba(255,255,255,.3)", fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  seen: { color: palette.accent, fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  lockedBar: { paddingHorizontal: 20, paddingTop: 14, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, backgroundColor: "rgba(243,155,175,.08)" },
  lockedTitle: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  lockedText: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 6, gap: 8 },
  editBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(105,120,255,.14)" },
  editLabel: { flex: 1, color: palette.accent, fontSize: 13, lineHeight: 17 },
  editCancel: { paddingHorizontal: 8, paddingVertical: 2 },
  editCancelLabel: { color: palette.text, fontSize: 13, lineHeight: 17 },
  sendCheck: { color: palette.text, fontSize: 20, lineHeight: 24 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 6, paddingLeft: 14, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  input: { flex: 1, minHeight: 40, maxHeight: 120, color: palette.text, fontSize: 15, paddingVertical: 9 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});

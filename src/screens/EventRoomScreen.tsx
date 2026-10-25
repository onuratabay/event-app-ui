import ContextualTip from "../walkthrough/ContextualTip"
import { showAlert } from "../components/AppDialog"
import { useWalkthroughScreenBlocker } from "../walkthrough/activity"
import { palette } from "../theme/palette";
import { useBottomNavInset } from "../components/BottomNav";
import { UsersIcon, LocationIcon, ClockIcon, StarIcon, SendIcon } from "../components/Icons";
import { useScreenActive } from '../native/useScreenActive';
import { onSocket, retainEvent, socketAction, socketConnected } from '../services/socket';
import TopNavBar from "../components/TopNavBar";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, ScrollView, Modal, Pressable, StyleSheet, Switch, View, useWindowDimensions, type ScrollViewInstance, type ViewInstance } from "react-native";
import { useKeyboardOverlap } from "../native/useKeyboardOverlap";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AtmoBackground, GlassFill } from "../components/GlassUI";
import ActionSheet, { REPORT_REASONS, type SheetOption } from "../components/ActionSheet";
import { deleteMessage, editMessage, getApiErrorMessage, getEvent, getEventActivity, getMessageReads, getMessages, markRoomRead, putPreference, renameRoom, reportUser, sendMessage, type ApiMessage } from "../api/client";
import { EMPTY_USER, defaultRoomTitle, mapApiEventPreservingCover, participantCount, roomTitle, setOpenRoom } from "../native/Store";
import { cachedRoom, hydrateChatCache, markRoomListRead, markRoomSynced, rememberRoom, type CachedRoomMessage, type RoomQuote } from "../services/chat-cache";
import { QUICK_REPLIES, ReplyBar, ReplyQuote, SwipeToReply } from "../components/ChatReply";
import { useStore } from "../native/Store";
import { Box, ChatList, Field, Label, Picture, Scroll, Touch } from "../native/UI";
import { ui } from "../theme/styles";
import type { ChatMessage, NavigateFn } from "../types";
interface Props {
  navigate: NavigateFn;
  eventId?: string;
}
// Same limit the backend enforces for chat messages and edits.
const MAX_MESSAGE_LENGTH = 2000;
// system: a WhatsApp-style info line (e.g. the organizer renamed the room), not a chat bubble.
type RoomMessage = ChatMessage & { system?: boolean; announcement?: boolean; deleted?: boolean; edited?: boolean; pending?: boolean; failed?: boolean; replyTo?: RoomQuote };
/** Saved room messages keep only the author's id and name; the rest of the user comes back empty. */
const fromCache = (row: CachedRoomMessage): RoomMessage => ({ ...row, user: { ...EMPTY_USER, ...row.user } });
const toCache = (row: RoomMessage): CachedRoomMessage => ({ id: row.id, createdAt: row.createdAt, text: row.text, time: row.time, user: { id: row.user.id, name: row.user.name }, system: row.system, announcement: row.announcement, deleted: row.deleted, edited: row.edited, ...(row.replyTo ? { replyTo: row.replyTo } : {}) });
// Times arrive as "+03:00" from REST but "Z" from the device (pending sends), so compare instants,
// never the strings: as text, "09:31Z" sorted before "12:30+03:00" and a new message jumped to the top.
const instant = (iso?: string) => Date.parse(iso || "") || 0;
const dayKey = (iso?: string) => { const date = new Date(instant(iso)); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };
// Consecutive messages from the same person (same day) are grouped: name/photo once, tighter spacing.
function sameSender(a: RoomMessage | undefined, b: RoomMessage | undefined) {
  return !!a && !!b && !a.announcement && !b.announcement && !a.system && !b.system && a.user.id === b.user.id && dayKey(a.createdAt) === dayKey(b.createdAt);
}
// Inside a group only messages sent in the same minute share one time (shown under the last of them);
// messages with different times each keep their own.
const sameMinute = (a: RoomMessage | undefined, b: RoomMessage | undefined) => sameSender(a, b) && a!.time === b!.time;
function dayLabel(iso?: string) {
  const date = new Date(iso || "");
  if (isNaN(date.getTime())) return "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}
export default function EventRoomScreen({
  navigate,
  eventId
}: Props) {
  const navInset = useBottomNavInset();
  // Keeps the composer above the keyboard even where the root does not shrink the screen for it.
  const screenRef = useRef<ViewInstance>(null);
  const { overlap: keyboardOverlap, onLayout: onScreenLayout } = useKeyboardOverlap(screenRef);
  const {
    data: store,
    setData: setStore
  } = useStore();
  const screenActive = useScreenActive();
  const ME = store.user;
  const event = store.events.find(e => e.id === eventId);
  // A room opened before (also before an app restart) shows its last messages at once; only newer
  // ones are then fetched. Saved per account: another account on this phone never sees them.
  const meId = store.user.id;
  const savedRoom = eventId && meId ? cachedRoom(meId, eventId) : undefined;
  const [messages, setMessages] = useState<RoomMessage[]>(() => savedRoom?.items.map(fromCache) ?? []);
  const messagesRef = useRef<RoomMessage[]>([]);
  messagesRef.current = messages;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // The backend decides whether the room is open (minimum participants, cancellation, membership).
  const [closedReason, setClosedReason] = useState<string | null>(null);
  // Messages arrive over the socket; while it reconnects the room says so instead of offering a refresh.
  const [live, setLive] = useState(socketConnected());
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingExpiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTyping = useRef(0);
  const [cursor, setCursor] = useState<string | null>(() => savedRoom?.cursor ?? null);
  // Remember what this room showed (sent messages only, newest 100) for the next time it opens.
  useEffect(() => {
    if (!eventId || !meId || !messages.length) return;
    const kept = messages.filter(m => !m.pending && !m.failed).sort((a, b) => instant(a.createdAt) - instant(b.createdAt)).slice(-100);
    rememberRoom(meId, eventId, kept.map(toCache), cursor);
  }, [eventId, meId, messages, cursor]);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoScrollRef = useRef<ScrollViewInstance>(null);
  const { height: windowHeight } = useWindowDimensions();
  // Online (green dot) = has this room's chat open now. Snapshot from the server, then live join/leave events.
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<RoomMessage | null>(null);
  const [sheet, setSheet] = useState<{ title?: string; options: SheetOption[] } | null>(null);
  const [reads, setReads] = useState<Record<string, string>>({});
  const [checkins, setCheckins] = useState<string[]>([]);
  const [waitlist, setWaitlist] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  // Room name: only the organizer edits it; the change shows at once and reaches every member over the socket.
  const [roomNameDraft, setRoomNameDraft] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const saveRoomName = async () => {
    if (!event || roomNameDraft === null || renaming) return;
    const name = roomNameDraft.replace(/\s+/g, " ").trim();
    const previous = event.roomName;
    const apply = (value?: string) => setStore(p => ({ ...p, events: p.events.map(e => e.id === event.id ? { ...e, roomName: value } : e) }));
    setRenaming(true); apply(name || undefined);
    try { const result = await renameRoom(event.id, name); apply(result.roomName || undefined); setRoomNameDraft(null); }
    catch (cause) { apply(previous); showAlert("Oda adı değiştirilemedi", getApiErrorMessage(cause)); }
    finally { setRenaming(false); }
  };
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useWalkthroughScreenBlocker(infoOpen || !!sheet || busy || renaming || sending || !!editing || !!input.trim());
  // The messages this device sent here with the message each one answered: a server that does not keep answers
  // yet (older backend) returns them without the quote, and the quote still shows from this record.
  const sentQuotes = useRef(new Map<string, RoomQuote>());
  const quotesKey = `event-app:room-quotes:${eventId}`;
  useEffect(() => {
    sentQuotes.current = new Map();
    if (!eventId) return;
    AsyncStorage.getItem(quotesKey).then(raw => {
      if (!raw) return;
      sentQuotes.current = new Map(JSON.parse(raw) as Array<[string, RoomQuote]>);
      setMessages(prev => prev.map(m => !m.replyTo && sentQuotes.current.has(m.id) ? { ...m, replyTo: sentQuotes.current.get(m.id) } : m));
    }).catch(() => {});
  }, [eventId]);
  const rememberQuote = (id: string, quote: RoomQuote) => {
    sentQuotes.current.set(id, quote);
    void AsyncStorage.setItem(quotesKey, JSON.stringify([...sentQuotes.current].slice(-200))).catch(() => {});
  };
  const mapMessage = (message: ApiMessage): RoomMessage => ({ id: message.id, createdAt: message.createdAt, announcement: message.kind === 'announcement', system: message.kind === 'system', deleted: message.deleted === true, edited: Boolean(message.editedAt), text: message.text, time: new Date(message.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), user: { ...EMPTY_USER, id: message.user.id, name: `${message.user.firstName} ${message.user.lastName}`.trim() },
    ...(message.replyTo ? { replyTo: { id: message.replyTo.id, text: message.replyTo.text, deleted: message.replyTo.deleted === true, userId: message.replyTo.user.id, name: `${message.replyTo.user.firstName} ${message.replyTo.user.lastName}`.trim() } }
      : sentQuotes.current.has(message.id) ? { replyTo: sentQuotes.current.get(message.id) } : {}) });
  // Replies quoting an incoming (e.g. edited or deleted) message show its new text too.
  const upsert = (incoming: RoomMessage[]) => setMessages(prev => {
    const byId = new Map(incoming.map(m => [m.id, m]));
    const quoted = (m: RoomMessage) => { const source = m.replyTo ? byId.get(m.replyTo.id) : undefined; return source && m.replyTo ? { ...m, replyTo: { ...m.replyTo, text: source.deleted ? "" : source.text.slice(0, 300), deleted: !!source.deleted } } : m; };
    return [...new Map([...prev, ...incoming].map(m => [m.id, quoted(m)])).values()];
  });
  // Listeners read the signed-in id through a ref, so the room loads without waiting for the account.
  const meIdRef = useRef(ME.id);
  meIdRef.current = ME.id;
  const markSeen = (userId: string, at?: string) => {
    if (!userId || userId === meIdRef.current || !at) return;
    setReads(prev => (Date.parse(prev[userId] || "") || 0) >= Date.parse(at) ? prev : { ...prev, [userId]: at });
  };
  useEffect(() => {
    if (!eventId || !screenActive) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    const load = async () => {
      // The three room requests start together; each fills its part of the screen when it arrives.
      // Seen-by and activity are secondary: their failures never block the chat.
      void getMessageReads(eventId).then(r => { if (active) setReads(Object.fromEntries(r.items.map(item => [item.userId, item.readAt]))); }).catch(() => {});
      void getEventActivity(eventId).then(r => { if (active) { setCheckins(r.checkins.map(c => c.userId)); setWaitlist(r.waitlist.map(w => w.userId)); } }).catch(() => {});
      try {
        // Saved messages on screen: only newer ones are fetched (a small catch-up); otherwise the newest page.
        if (meId) await hydrateChatCache(meId);
        if (!active) return;
        if (!messagesRef.current.length && meId) {
          const saved = cachedRoom(meId, eventId);
          if (saved?.items.length) { const restored = saved.items.map(fromCache); setMessages(restored); messagesRef.current = restored; setCursor(saved.cursor); }
        }
        // Only what came after the point the saved copy is known complete (messages that arrived live while
        // the room was closed are already shown; any gap before them is filled here). Nothing saved: newest page.
        const after = meId ? cachedRoom(meId, eventId)?.syncedAt : undefined;
        let result = await getMessages(eventId, controller.signal, undefined, after);
        // A very long gap: the newest page instead (earlier messages load on scroll).
        const full = !after || result.items.length >= 100;
        if (after && full) result = await getMessages(eventId, controller.signal);
        if (!active) return;
        upsert(result.items.map(mapMessage)); if (full) setCursor(result.nextCursor || null); setError(''); setClosedReason(null);
        const newestShown = [...messagesRef.current, ...result.items.map(mapMessage)].filter(m => !m.pending && !m.failed && m.createdAt).reduce<string | undefined>((at, m) => !at || instant(m.createdAt) > instant(at) ? m.createdAt : at, undefined);
        if (meId) markRoomSynced(meId, eventId, newestShown);
      }
      catch (cause) {
        if (!active) return;
        const message = getApiErrorMessage(cause, 'Mesajlar yüklenemedi.');
        if (cause instanceof Error && /^API 403:/.test(cause.message)) setClosedReason(message); else setError(message);
      }
      finally { if (active) setLoading(false); }
    };
    // The full event, also when the room list already had a summary of it: only it carries the members'
    // photos (shown beside messages and in the room info). Photos already loaded are kept meanwhile.
    void getEvent(eventId, { background: true }).then(value => {
      if (active) setStore(p => {
        const existing = p.events.find(e => e.id === value.id);
        const fresh = mapApiEventPreservingCover(value, existing);
        return { ...p, events: [{ ...fresh, unreadCount: existing?.unreadCount ?? fresh.unreadCount, lastMessageAt: fresh.lastMessageAt ?? existing?.lastMessageAt }, ...p.events.filter(e => e.id !== value.id)] };
      });
    }).catch(() => {});
    const release = retainEvent(eventId);
    const loadPresence = () => { void socketAction<string[]>('event:presence', { eventId }).then(ids => { if (active && Array.isArray(ids)) setPresent(new Set(ids)); }).catch(() => {}); };
    setTimeout(loadPresence, 300);
    // While the room is on screen everything counts as read; bursts are batched into one request.
    setOpenRoom(eventId);
    let readTimer: ReturnType<typeof setTimeout> | undefined;
    const markRead = (delay = 0) => {
      setStore(p => ({ ...p, events: p.events.map(e => e.id === eventId ? { ...e, unreadCount: 0 } : e) }));
      if (meIdRef.current) markRoomListRead(meIdRef.current, eventId);
      clearTimeout(readTimer);
      readTimer = setTimeout(() => { void markRoomRead(eventId).catch(() => {}); }, delay);
    };
    markRead();
    const listeners = [
      onSocket('chat:message_created', payload => {
        if (payload.eventId !== eventId) return;
        const incoming = mapMessage(payload.message);
        // Our own message can arrive over the socket before the send ack; replace its pending copy.
        if (incoming.user.id === meIdRef.current) setMessages(prev => {
          const index = prev.findIndex(m => m.pending && m.text === incoming.text);
          return index < 0 ? prev : prev.filter((_, i) => i !== index);
        });
        upsert([incoming]);
        void socketAction('chat:read', { eventId, messageId: payload.message.id }).catch(() => {});
        markRead(1000);
      }),
      onSocket('event:announcement', payload => { if (payload.eventId === eventId) upsert([mapMessage(payload.message)]); }),
      onSocket('chat:message_updated', payload => { if (payload.eventId === eventId) upsert([mapMessage(payload.message)]); }),
      onSocket('chat:message_deleted', payload => { if (payload.eventId === eventId) upsert([mapMessage(payload.message)]); }),
      // "Görüldü": REST reads carry a time, socket reads point at a message.
      onSocket('chat:read', payload => {
        if (payload.eventId !== eventId) return;
        markSeen(payload.userId, payload.at || messagesRef.current.find(m => m.id === payload.messageId)?.createdAt);
      }),
      onSocket('event:checkin', payload => { if (payload.eventId === eventId) setCheckins(prev => prev.includes(payload.userId) ? prev : [...prev, payload.userId]); }),
      onSocket('chat:typing', payload => {
        if (payload.eventId !== eventId || payload.userId === meIdRef.current) return;
        setTypingUserId(payload.typing === true ? payload.userId : null);
        if (typingExpiry.current) clearTimeout(typingExpiry.current);
        typingExpiry.current = setTimeout(() => setTypingUserId(null), 3000);
      }),
      onSocket('sync:required', () => { void load(); }),
      onSocket('connection:changed', payload => { if (active) setLive(payload.connected === true); if (payload.connected === true) loadPresence(); }),
      // Fallback: every member also gets "room:message" on their own channel, which is always joined.
      // If the chat event has not delivered that message shortly after, the newest page is fetched.
      onSocket('room:message', (delta: { eventId: string; at: string }) => {
        if (delta.eventId !== eventId) return;
        setTimeout(() => {
          if (!active || messagesRef.current.some(m => instant(m.createdAt) >= instant(delta.at))) return;
          void getMessages(eventId).then(result => { if (active) { upsert(result.items.map(mapMessage)); markRead(1000); } }).catch(() => {});
        }, 1500);
      }),
      onSocket('chat:user_joined', payload => { if (payload.eventId === eventId) setPresent(prev => new Set(prev).add(payload.userId)); }),
      onSocket('chat:user_left', payload => { if (payload.eventId === eventId) setPresent(prev => { const next = new Set(prev); next.delete(payload.userId); return next; }); }),
    ];
    setLive(socketConnected());
    void load();
    return () => { active = false; controller.abort(); release(); listeners.forEach(stop => stop()); if (typingExpiry.current) clearTimeout(typingExpiry.current); if (readTimer) { clearTimeout(readTimer); void markRoomRead(eventId).catch(() => {}); } setOpenRoom(null); };
  }, [eventId, screenActive]);
  const sorted = useMemo(() => messages.slice().sort((a, b) => instant(a.createdAt) - instant(b.createdAt) || a.id.localeCompare(b.id)), [messages]);
  const people = useMemo(() => new Map((event?.participants || []).concat(event ? [event.host] : []).map(person => [person.id, person])), [event]);
  const firstName = (userId: string) => people.get(userId)?.name.split(" ")[0] || "Bir katılımcı";
  const pinned = useMemo(() => [...sorted].reverse().find(m => m.announcement && !m.deleted), [sorted]);
  const lastMine = useMemo(() => [...sorted].reverse().find(m => m.user.id === ME.id && !m.announcement && !m.system && !m.deleted && !m.pending && !m.failed), [sorted, ME.id]);
  const muted = !!eventId && (store.mutedRooms || []).includes(eventId);
  // The list is drawn newest first and flipped (inverted): it opens at the newest message, stays there as
  // messages arrive or the keyboard opens, and only the rows on screen are rendered (long rooms stay smooth).
  const newestFirst = useMemo(() => sorted.slice().reverse(), [sorted]);
  const loadingOlder = useRef(false);
  // Reaching the top (the end of the flipped list) loads earlier messages; the button stays as a fallback.
  const loadOlder = async () => {
    if (!eventId || !cursor || loading || loadingOlder.current) return;
    loadingOlder.current = true;
    setLoading(true);
    try { const result = await getMessages(eventId, undefined, cursor); upsert(result.items.map(mapMessage)); setCursor(result.nextCursor || null); }
    catch (cause) { setError(getApiErrorMessage(cause)); } finally { loadingOlder.current = false; setLoading(false); }
  };
  // Sends are optimistic: the message shows at once and the request runs in the background.
  // Sends are chained so several quick messages keep their order on the server.
  const sendQueue = useRef<Promise<unknown>>(Promise.resolve());
  const deliver = (local: RoomMessage) => {
    if (!eventId) return;
    const text = local.text;
    const replyToId = local.replyTo?.id;
    sendQueue.current = sendQueue.current.catch(() => {}).then(async () => {
      try {
        // Socket first; REST only when the realtime connection is down (never after a timeout, to avoid duplicates).
        const saved = socketConnected() ? await socketAction<ApiMessage>('chat:message', { eventId, text, ...(replyToId ? { replyToId } : {}) }) : await sendMessage(eventId, text, replyToId);
        if (local.replyTo && !saved.replyTo) rememberQuote(saved.id, local.replyTo);
        setMessages(prev => [...prev.filter(m => m.id !== local.id && m.id !== saved.id), mapMessage(saved)]);
        setError('');
      } catch {
        setMessages(prev => prev.map(m => m.id === local.id ? { ...m, pending: false, failed: true } : m));
      }
    });
  };
  // Cancelled by the organizer (live via "event:cancelled"): the history stays readable, nothing can be sent.
  const cancelled = event?.status === "cancelled";
  const sendText = async (raw: string) => {
    if (cancelled) return;
    const text = raw.trim();
    if (!text || !eventId) return;
    if (editing) {
      if (sending) return;
      setSending(true);
      try { upsert([mapMessage(await editMessage(eventId, editing.id, text))]); setEditing(null); setInput(''); }
      catch (cause) { showAlert('Mesaj düzenlenemedi', getApiErrorMessage(cause)); }
      finally { setSending(false); }
      return;
    }
    const now = new Date().toISOString();
    const local: RoomMessage = { id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now, text, pending: true, time: new Date(now).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }), user: { ...ME },
      ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text.slice(0, 300), userId: replyTo.user.id, name: replyTo.user.name } } : {}) };
    upsert([local]); setInput(''); setReplyTo(null);
    void socketAction('chat:typing', { eventId, typing: false }).catch(() => {});
    deliver(local);
  };
  const retry = (msg: RoomMessage) => {
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending: true, failed: false } : m));
    deliver(msg);
  };
  const send = () => sendText(input);
  // "Cevapla": pulling a message right (or the option under a long press) quotes it in the next message.
  // System lines cannot be answered (the server refuses them too); members' and guests' messages can.
  const [replyTo, setReplyTo] = useState<RoomMessage | null>(null);
  const canReply = (msg: RoomMessage) => !cancelled && !msg.system && !msg.deleted && !msg.pending && !msg.failed && !msg.id.startsWith("local-");
  const startReply = (msg: RoomMessage) => { if (!canReply(msg)) return; setEditing(null); setReplyTo(msg); };
  const quoteAuthor = (userId: string, name: string) => userId === ME.id ? "Sen" : name.split(" ")[0] || "Bir katılımcı";
  // Tapping a quote scrolls to the answered message (when it is loaded) and marks it for a moment.
  const listRef = useRef<FlatList<RoomMessage>>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const showQuoted = (id: string) => {
    const index = newestFirst.findIndex(m => m.id === id);
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    setHighlighted(id); setTimeout(() => setHighlighted(current => current === id ? null : current), 1400);
  };
  // "Sil" in the options deletes at once (no second confirmation); a failure brings the message back.
  const removeMessage = (msg: RoomMessage) => {
    if (!eventId) return;
    upsert([{ ...msg, text: "", deleted: true }]);
    void deleteMessage(eventId, msg.id).then(saved => upsert([mapMessage(saved)])).catch(cause => { upsert([msg]); showAlert('Mesaj silinemedi', getApiErrorMessage(cause)); });
  };
  const report = (msg: RoomMessage) => setSheet({
    title: `${firstName(msg.user.id)} kullanıcısını neden şikayet ediyorsun?`,
    options: REPORT_REASONS.map(reason => ({ label: reason, onPress: () => {
      void reportUser(msg.user.id, `Sohbet şikayeti (${reason}) · ${event ? roomTitle(event) : ""}: "${msg.text.slice(0, 500)}"`)
        .then(() => showAlert("Şikayetin alındı", "Ekibimiz inceleyecek. Teşekkürler."))
        .catch(cause => showAlert("Şikayet gönderilemedi", getApiErrorMessage(cause)));
    } })),
  });
  const openActions = (msg: RoomMessage) => {
    if (cancelled) return;
    if (msg.deleted || !event) return;
    const mine = msg.user.id === ME.id;
    const isOwner = event.host.id === ME.id;
    const options: SheetOption[] = [{ label: "Kopyala", onPress: () => { void Clipboard.setStringAsync(msg.text).catch(() => {}); } }];
    if (canReply(msg)) options.unshift({ label: "Cevapla", onPress: () => startReply(msg) });
    if (mine && !msg.announcement) options.push({ label: "Düzenle", onPress: () => { setReplyTo(null); setEditing(msg); setInput(msg.text); } });
    if (mine || isOwner) options.push({ label: "Sil", danger: true, onPress: () => removeMessage(msg) });
    if (!mine) options.push({ label: "Şikayet et", danger: true, onPress: () => report(msg) });
    setSheet({ title: msg.text.slice(0, 80), options });
  };
  const toggleMute = async (value: boolean) => {
    if (!eventId) return;
    const previous = store.mutedRooms || [];
    const next = value ? [...new Set([...previous, eventId])] : previous.filter(id => id !== eventId);
    setStore(p => ({ ...p, mutedRooms: next }));
    try { await putPreference('mutedRooms', { ids: next }); }
    catch (cause) { setStore(p => ({ ...p, mutedRooms: previous })); showAlert('Ayar kaydedilemedi', getApiErrorMessage(cause)); }
  };
  const runOwnerAction = async (name: string, payload: Record<string, unknown>) => {
    if (!eventId || busy) return false;
    setBusy(true);
    try { await socketAction(name, { eventId, ...payload }); return true; }
    catch (cause) { showAlert('İşlem yapılamadı', getApiErrorMessage(cause, cause instanceof Error ? cause.message : undefined)); return false; }
    finally { setBusy(false); }
  };
  if (!event) return <Box style={[[ui.fixed, ui.inset0, ui.bg06060e]]}><TopNavBar navigate={navigate} fallback="rooms" title="Etkinlik Odası" /><Box style={{ paddingTop: 96, paddingHorizontal: 20 }}><Label>{error || 'Etkinlik yükleniyor…'}</Label></Box></Box>;
  const isOwner = event.host.id === ME.id;
  const typingName = typingUserId ? firstName(typingUserId) : null;
  const roster = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const seenBy = lastMine ? Object.entries(reads).filter(([userId, at]) => userId !== ME.id && Date.parse(at) >= Date.parse(lastMine.createdAt || "")).map(([userId]) => firstName(userId)) : [];
  const subtitle = `${muted ? "🔕 " : ""}${event.location ? `${event.time} · ${event.location}` : event.time}`;
  return <View ref={screenRef} onLayout={onScreenLayout} style={StyleSheet.absoluteFill}><Box style={[[ui.fixed, ui.inset0, ui.bg06060e, ui.flex, ui.flexCol, ui.overflowHidden]]}>
      <AtmoBackground />
      <TopNavBar navigate={navigate} fallback="rooms" onBack={() => navigate("event-detail", { eventId: event.id, back: true })} walkthroughId="room-info" title={roomTitle(event)} subtitle={subtitle}
        onTitlePress={() => setInfoOpen(true)} titleHint="Oda bilgisini, katılımcıları ve etkinliğe gitmeyi gösterir" />

      {/* Tapping the room name opens one sheet: event info, participants and room settings. */}
      {infoOpen && <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={() => setInfoOpen(false)}>
          {/* The window does not resize for the keyboard inside a modal: the sheet rises by the keyboard's height
              so the room name and announcement fields stay above it. */}
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Box style={s.sheetBackdrop}>
            <Pressable accessibilityLabel="Oda bilgisini kapat" onPress={() => setInfoOpen(false)} style={StyleSheet.absoluteFill} />
            {/* Safe area keeps the last rows above Android's system navigation bar. */}
            <SafeAreaView edges={["bottom"]} style={s.peopleSheet}><GlassFill kind="sheet" topRadius={24} />
              <Box style={s.peopleSheetHeader}>
                <Label style={s.peopleSheetTitle} numberOfLines={1}>{roomTitle(event)}</Label>
                <Touch accessibilityLabel="Oda bilgisini kapat" onPress={() => setInfoOpen(false)} style={s.peopleSheetClose}><Label style={s.peopleSheetCloseLabel}>Kapat</Label></Touch>
              </Box>
              <ScrollView ref={infoScrollRef} style={{ maxHeight: Math.round(windowHeight * 0.7) }} contentContainerStyle={s.info} keyboardShouldPersistTaps="handled">
          {isOwner ? <>
            <Label style={s.panelHeading}>Oda adı</Label>
            <Field accessibilityLabel="Oda adı" value={roomNameDraft ?? event.roomName ?? ""} onChangeText={setRoomNameDraft} placeholder={defaultRoomTitle(event)} placeholderTextColor="rgba(255,255,255,.35)" maxLength={60} returnKeyType="done" onSubmitEditing={() => void saveRoomName()} style={s.panelInput} />
            {roomNameDraft !== null && roomNameDraft.replace(/\s+/g, " ").trim() !== (event.roomName ?? "") ? <Touch disabled={renaming} onPress={() => void saveRoomName()} style={s.panelButton}><Label style={s.panelButtonLabel}>{renaming ? "Kaydediliyor…" : "Oda adını kaydet"}</Label></Touch> : null}
            <Label style={s.panelDetail}>Yeni adı odadaki herkes görür. Boş bırakırsan varsayılan ada döner.</Label>
          </> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            {[{ icon: <UsersIcon size={15} />, text: `${participantCount(event.currentParticipants, event.maxParticipants)} kişi` },
              ...(event.location ? [{ icon: <LocationIcon size={15} />, text: event.location }] : []),
              { icon: <ClockIcon size={15} />, text: `${event.date} · ${event.time}` },
              ...(event.level ? [{ icon: <StarIcon size={15} />, text: event.level }] : [])].map((item, i) => <Box key={i} style={s.chip}>
                <Box style={{ color: palette.muted }}>{item.icon}</Box>
                <Label style={s.chipLabel}>{item.text}</Label>
              </Box>)}
          </ScrollView>
          {/* The way to the event page, under its details (no icon in the header). */}
          <Touch accessibilityLabel="Etkinliğe git" onPress={() => { setInfoOpen(false); navigate("event-detail", { eventId: event.id }); }} style={s.panelButton}>
            <Label style={s.panelButtonLabel}>Etkinliğe git</Label>
          </Touch>

          <Label style={s.panelHeading}>Katılımcılar · {roster.length}</Label>
          <Box style={s.people}>
            {roster.map(person => {
              const checked = checkins.includes(person.id);
              const online = person.id === ME.id || present.has(person.id);
              return <Box key={person.id} style={s.person}>
                <Touch accessibilityLabel={`${person.name} profilini aç`} onPress={() => { setInfoOpen(false); navigate("profile", person.id === ME.id ? {} : { userId: person.id }); }} style={s.personLink}>
                  <Box style={s.avatarWrap}>
                    {/* Your own row uses your profile photo (the member list leaves the viewer's own out). */}
                    <Picture uri={person.id === ME.id ? ME.avatar : person.avatar} accessibilityLabel={person.name} style={s.personAvatar} />
                    {/* Presence shows only as the dot (no "Aktif/Pasif" text); screen readers still hear it. */}
                    <Box accessibilityLabel={online ? "Odada" : "Odada değil"} style={[s.statusDot, { backgroundColor: online ? palette.success : "rgba(255,255,255,.25)" }]} />
                  </Box>
                  <Label style={s.personName} numberOfLines={1}>{person.name}{person.id === event.host.id ? " · Organizatör" : ""}{checked ? " ✓" : ""}</Label>
                </Touch>
                {isOwner && event.isActive && !checked && person.id !== event.host.id ? <Touch accessibilityLabel={`${person.name} girişini onayla`} disabled={busy} onPress={async () => { if (await runOwnerAction('event:checkin', { participantId: person.id })) setCheckins(prev => [...prev, person.id]); }} style={s.smallButton}><Label style={s.smallButtonLabel}>Onayla</Label></Touch> : null}
              </Box>;
            })}
          </Box>

          <Box style={s.panelRow}>
            <Box style={s.panelCopy}><Label style={s.panelTitle}>Odayı sessize al</Label><Label style={s.panelDetail}>Bu odanın okunmamış mesaj rozeti ve mesaj bildirimleri kapatılır.</Label></Box>
            <Switch accessibilityLabel="Odayı sessize al" value={muted} onValueChange={value => void toggleMute(value)}
              trackColor={{ false: palette.elevated, true: palette.violet }} thumbColor="#ffffff" ios_backgroundColor={palette.elevated} />
          </Box>

          <Label style={s.panelHeading}>Giriş onayı</Label>
          {!event.isActive ? <Label style={s.panelDetail}>Giriş onayı etkinlik başladığında açılır.</Label>
            : !isOwner ? <Label style={s.panelDetail}>{checkins.includes(ME.id) ? "Girişin onaylandı ✓" : "Vardığında sohbete “Geldim” yazabilirsin. Girişini düzenleyen onaylar."}</Label>
            : null}
          {isOwner ? <>
            <Label style={s.panelHeading}>Duyuru gönder</Label>
            {/* The announcement sits near the end of the sheet: focusing it scrolls it into view above the keyboard. */}
            <Field value={announcement} onChangeText={setAnnouncement} onFocus={() => setTimeout(() => infoScrollRef.current?.scrollToEnd({ animated: true }), 250)} placeholder="Tüm katılımcılara duyuru…" placeholderTextColor="rgba(255,255,255,.35)" maxLength={MAX_MESSAGE_LENGTH} style={s.panelInput} />
            <Touch disabled={busy || !announcement.trim()} onPress={async () => { Keyboard.dismiss(); if (await runOwnerAction('event:announcement', { text: announcement.trim() })) setAnnouncement(''); }} style={s.panelButton}><Label style={s.panelButtonLabel}>📣 Duyuruyu sabitle ve gönder</Label></Touch>
            {waitlist.length ? <>
              <Label style={s.panelHeading}>Yedek liste</Label>
              {waitlist.map((userId, index) => <Box key={userId} style={s.panelRow}>
                <Label style={[s.panelTitle, { flex: 1 }]}>Yedek üye #{index + 1}</Label>
                <Touch disabled={busy} onPress={async () => { if (await runOwnerAction('event:waitlist_promote', { participantId: userId })) setWaitlist(rows => rows.filter(row => row !== userId)); }} style={s.smallButton}><Label style={s.smallButtonLabel}>Kabul et</Label></Touch>
              </Box>)}
            </> : null}
          </> : null}
              </ScrollView>
            </SafeAreaView>
          </Box>
          </KeyboardAvoidingView>
        </Modal>}
      <Box style={s.body}>

        {closedReason ? <Box style={s.closed}>
          <Label style={s.closedIcon}>✦</Label>
          <Label style={s.closedTitle}>{event.status === "cancelled" ? "Oda kapandı" : "Oda henüz açık değil"}</Label>
          <Label style={s.closedText}>{closedReason}</Label>
          {event.status !== "cancelled" && <Label style={s.closedText}>Onaylı katılımcı: {event.currentParticipants}/{event.minParticipants}</Label>}
          <Touch onPress={() => navigate("event-detail", { eventId: event.id })} style={s.closedButton}><Label style={s.closedButtonLabel}>Etkinlik detayına dön</Label></Touch>
        </Box> : <>
          <Box style={{ paddingHorizontal: 20 }}><ContextualTip id="checkin" when={!!event.isActive && !infoOpen} /></Box>
          {pinned ? <Touch accessibilityLabel="Sabitlenmiş duyuru" onPress={() => setPinnedOpen(open => !open)} style={s.pinned}>
            <Label style={s.pinnedTitle}>📌 Organizatör duyurusu · {pinned.time}</Label>
            <Label style={s.pinnedText} numberOfLines={pinnedOpen ? undefined : 2}>{pinned.text}</Label>
          </Touch> : null}
          {error ? <Label accessibilityRole="alert" style={s.error}>{error}</Label> : null}
          {!live && !error ? <Label accessibilityLiveRegion="polite" style={s.connection}>Bağlantı yeniden kuruluyor… Gönderilemeyen mesajları tekrar deneyebilirsin.</Label> : null}
          {/* Empty state sits outside the flipped list (an inverted list would turn it upside down). */}
          {!sorted.length && !loading ? <Box style={[s.empty, { flex: 1 }]}><Label style={s.emptyTitle}>Sohbet başladı</Label><Label style={s.emptyText}>İlk mesajı sen yaz; buluşma detaylarını burada konuşabilirsiniz.</Label></Box>
          : <ChatList
            listRef={listRef}
            data={newestFirst}
            // Scrolling to an answered message far up: jump near it first, then settle on it.
            onScrollToIndexFailed={({ index, averageItemLength }) => { listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true }); setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }), 250); }}
            keyExtractor={msg => msg.id}
            style={{ flex: 1 }}
            contentContainerStyle={s.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={11}
            onEndReached={() => { void loadOlder(); }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={cursor ? <Touch disabled={loading} onPress={() => void loadOlder()} style={s.older}><Label style={s.olderLabel}>{loading ? "Yükleniyor…" : "Önceki mesajları göster"}</Label></Touch> : undefined}
            renderItem={({ item: msg, index }) => {
              // In the flipped list the older neighbour is the next item and the newer one the previous.
              const previous = newestFirst[index + 1];
              const following = newestFirst[index - 1];
              const newDay = !previous || dayKey(previous.createdAt) !== dayKey(msg.createdAt);
              const separator = newDay ? <Label style={s.day}>{dayLabel(msg.createdAt)}</Label> : null;
              // "Burak oda adını “…” olarak değiştirdi" / "Sen …": centred, no bubble, no actions.
              if (msg.system) return <View>{separator}<Label accessibilityRole="text" style={s.systemLine}>
                {msg.user.id === ME.id ? "Sen" : msg.user.name.split(" ")[0]} {msg.text} · {msg.time}
              </Label></View>;
              if (msg.announcement) return <View>{separator}<Touch onLongPress={() => openActions(msg)} style={s.announcement}>
                <Label style={s.announcementTitle}>📣 Organizatör duyurusu</Label>
                <Label style={msg.deleted ? s.deletedText : s.announcementText}>{msg.deleted ? "Bu duyuru silindi" : msg.text}</Label>
                <Label style={s.time}>{msg.time}</Label>
              </Touch></View>;
              const isMe = msg.user.id === ME.id;
              const isHost = msg.user.id === event.host.id;
              // Same-person runs show name/photo once; a time shows under the last message of each minute.
              const grouped = !newDay && sameSender(previous, msg);
              const endsGroup = !sameMinute(msg, following);
              const person = people.get(msg.user.id);
              return <View>{separator}<SwipeToReply enabled={canReply(msg)} onReply={() => startReply(msg)}><Box style={[s.message, isMe && s.messageMine, grouped && s.messageGrouped, highlighted === msg.id && s.highlighted]}>
                {!isMe && (grouped ? <Box style={s.avatarSpacer} /> : <Picture uri={person?.avatar || ""} accessibilityLabel={msg.user.name} style={s.avatar} />)}
                <Box style={[s.bubbleColumn, isMe ? s.alignEnd : s.alignStart]}>
                  {!isMe && !grouped && <Box style={s.author}>
                    <Label style={s.authorName}>{msg.user.name.split(" ")[0]}</Label>
                    {isHost && <Label style={s.hostBadge}>Organizatör</Label>}
                  </Box>}
                  <Touch accessibilityLabel="Mesaj seçenekleri" accessibilityHint="Basılı tut; cevaplamak için sağa kaydır" haptic={false} onLongPress={() => { if (!msg.pending && !msg.failed) openActions(msg); }} style={[s.bubble, msg.deleted ? s.bubbleDeleted : isMe ? s.bubbleMine : s.bubbleOther, (msg.pending || msg.failed) && { opacity: 0.65 }]}>
                    {msg.replyTo && !msg.deleted ? <ReplyQuote author={quoteAuthor(msg.replyTo.userId, msg.replyTo.name)} text={msg.replyTo.text} deleted={msg.replyTo.deleted} mine={isMe} onPress={() => showQuoted(msg.replyTo!.id)} /> : null}
                    <Label style={msg.deleted ? s.deletedText : isMe ? s.textMine : s.textOther}>{msg.deleted ? "Bu mesaj silindi" : msg.text}</Label>
                  </Touch>
                  {msg.failed ? <Touch accessibilityLabel="Mesajı tekrar gönder" onPress={() => retry(msg)} style={{ minHeight: 0, alignSelf: "flex-end" }}><Label style={[s.time, { color: palette.error }]}>Gönderilemedi · Tekrar dene</Label></Touch>
                    : (endsGroup || msg.pending || msg.edited) ? <Label style={s.time}>{msg.time}{msg.pending ? " · Gönderiliyor…" : ""}{msg.edited && !msg.deleted ? " · düzenlendi" : ""}</Label> : null}
                  {lastMine && msg.id === lastMine.id ? <Label style={s.seen}>{seenBy.length ? `Görüldü · ${seenBy.slice(0, 2).join(", ")}${seenBy.length > 2 ? ` +${seenBy.length - 2}` : ""}` : "Gönderildi"}</Label> : null}
                </Box>
              </Box></SwipeToReply></View>;
            }}
          />}

          {cancelled ? <Box accessibilityRole="alert" style={[s.cancelledBar, { paddingBottom: 14 + navInset + keyboardOverlap }]}>
            <Label style={s.cancelledTitle}>Etkinlik iptal edildi</Label>
            <Label style={s.cancelledText}>Etkinlik sahibi etkinliği iptal etti; bu odada artık mesaj gönderilemez.</Label>
          </Box> : <>
          {typingName && <Label style={s.typing}>{typingName} yazıyor…</Label>}
          <Box style={[s.composerWrap, { paddingBottom: 12 + navInset + keyboardOverlap }]}>
            {editing ? <Box style={s.editBar}>
              <Label style={s.editLabel} numberOfLines={1}>✎ Mesajı düzenliyorsun</Label>
              <Touch accessibilityLabel="Düzenlemeyi iptal et" onPress={() => { setEditing(null); setInput(''); }} style={s.editCancel}><Label style={s.editCancelLabel}>Vazgeç</Label></Touch>
            </Box> : replyTo ? <ReplyBar author={quoteAuthor(replyTo.user.id, replyTo.user.name)} text={replyTo.text} onCancel={() => setReplyTo(null)} /> : <Scroll horizontal style={s.quickRow}>
              {QUICK_REPLIES.map(reply => <Touch key={reply} accessibilityLabel={`Hızlı mesaj: ${reply}`} onPress={() => void sendText(reply)} style={s.quick}><Label style={s.quickLabel}>{reply}</Label></Touch>)}
            </Scroll>}
            <Box walkthroughId="room-composer" style={s.composer} glass>
              <Field value={input} onChangeText={value => {
                setInput(value);
                if (eventId && !editing && Date.now() - lastTyping.current > 1000) { lastTyping.current = Date.now(); void socketAction('chat:typing', { eventId, typing: Boolean(value) }).catch(() => {}); }
              }} placeholder={editing ? "Mesajı düzenle…" : "Bir mesaj yaz…"} placeholderTextColor="rgba(255,255,255,.35)" multiline maxLength={MAX_MESSAGE_LENGTH} style={s.input} />
              <Touch onPress={send} accessibilityLabel={editing ? "Düzenlemeyi kaydet" : "Mesaj gönder"} disabled={(editing && sending) || !input.trim()} style={s.send} gradient={["#4d5bcb", "#6651c9"]}>
                {editing ? <Label style={s.sendCheck}>✓</Label> : <SendIcon size={20} style={{ color: palette.text }} />}
              </Touch>
            </Box>
            {input.length > MAX_MESSAGE_LENGTH - 200 && <Label style={s.counter}>{input.length}/{MAX_MESSAGE_LENGTH}</Label>}
          </Box>
          </>}
        </>}
      </Box>
      {sheet ? <ActionSheet title={sheet.title} options={sheet.options} onClose={() => setSheet(null)} /> : null}
    </Box></View>;
}
const s = StyleSheet.create({
  body: { flex: 1, paddingTop: 68 },
  cancelledBar: { paddingHorizontal: 20, paddingTop: 14, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border, backgroundColor: "rgba(243,155,175,.08)" },
  cancelledTitle: { color: palette.error, fontFamily: "Outfit-SemiBold", fontSize: 14, lineHeight: 18 },
  cancelledText: { color: palette.muted, fontFamily: "Outfit", fontSize: 13, lineHeight: 18 },
  info: { gap: 12, paddingBottom: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  chipLabel: { color: "rgba(255,255,255,.6)", fontSize: 12, lineHeight: 16 },
  panelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  panelCopy: { flex: 1, gap: 3 },
  panelTitle: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 14, lineHeight: 19 },
  panelDetail: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  panelHeading: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 12, lineHeight: 16, marginTop: 4 },
  panelInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.background, paddingHorizontal: 12, color: palette.text, fontSize: 14 },
  panelButton: { minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,120,255,.18)", borderWidth: 1, borderColor: "rgba(183,197,255,.35)" },
  panelButtonLabel: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 13 },
  people: { gap: 8 },
  person: { flexDirection: "row", alignItems: "center", gap: 8 },
  peopleSheet: { backgroundColor: palette.glassSheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  peopleSheetHeader: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  peopleSheetTitle: { fontFamily: "Outfit-SemiBold", fontSize: 16, lineHeight: 22, color: palette.text },
  peopleSheetClose: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  peopleSheetCloseLabel: { fontFamily: "Outfit", fontSize: 15, lineHeight: 20, color: palette.muted },
  personLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, justifyContent: "flex-start" },
  avatarWrap: { position: "relative" },
  personAvatar: { width: 34, height: 34, borderRadius: 17 },
  statusDot: { position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: palette.surface },
  // One line centred on the photo; Android's extra font padding would push it off centre.
  personName: { flex: 1, minWidth: 0, color: "rgba(255,255,255,.75)", fontSize: 14, lineHeight: 18, includeFontPadding: false, textAlignVertical: "center" },
  smallButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "rgba(111,208,182,.14)", borderWidth: 1, borderColor: "rgba(111,208,182,.35)" },
  smallButtonLabel: { color: palette.success, fontFamily: "Outfit-SemiBold", fontSize: 12, lineHeight: 16 },
  pinned: { marginHorizontal: 16, marginTop: 10, gap: 3, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(105,120,255,.14)", borderWidth: 1, borderColor: "rgba(183,197,255,.3)" },
  pinnedTitle: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 11, lineHeight: 15 },
  pinnedText: { color: palette.text, fontSize: 13, lineHeight: 18 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  older: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,.06)", marginBottom: 8 },
  olderLabel: { color: palette.accent, fontSize: 12, lineHeight: 16 },
  empty: { alignItems: "center", gap: 6, paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 20, lineHeight: 26 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  systemLine: { alignSelf: "center", maxWidth: "88%", textAlign: "center", color: "rgba(226,232,240,.72)", fontSize: 12, lineHeight: 17, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "rgba(105,120,255,.10)", borderWidth: 1, borderColor: "rgba(183,197,255,.14)", marginVertical: 8 },
  day: { alignSelf: "center", color: "rgba(255,255,255,.45)", fontSize: 11, lineHeight: 14, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,.05)", marginVertical: 12 },
  message: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 10 },
  messageMine: { flexDirection: "row-reverse" },
  messageGrouped: { marginTop: 3 },
  highlighted: { backgroundColor: "rgba(105,120,255,.16)", borderRadius: 20 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarSpacer: { width: 28 },
  bubbleColumn: { maxWidth: "78%", gap: 3 },
  alignEnd: { alignItems: "flex-end" }, alignStart: { alignItems: "flex-start" },
  author: { flexDirection: "row", alignItems: "center", gap: 6, marginLeft: 4 },
  authorName: { color: "rgba(255,255,255,.45)", fontSize: 12, lineHeight: 16 },
  hostBadge: { color: palette.accent, fontSize: 10, lineHeight: 14, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: "rgba(105,120,255,.14)" },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMine: { backgroundColor: "#4d5bcb", borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: "rgba(255,255,255,.07)", borderWidth: 1, borderColor: "rgba(255,255,255,.09)", borderBottomLeftRadius: 6 },
  bubbleDeleted: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderStyle: "dashed" },
  textMine: { color: "#ffffff", fontSize: 15, lineHeight: 21 },
  textOther: { color: "rgba(255,255,255,.85)", fontSize: 15, lineHeight: 21 },
  deletedText: { color: "rgba(255,255,255,.4)", fontSize: 14, lineHeight: 20, fontStyle: "italic" },
  time: { color: "rgba(255,255,255,.3)", fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  seen: { color: palette.accent, fontSize: 10, lineHeight: 13, marginHorizontal: 4 },
  announcement: { alignSelf: "stretch", gap: 4, marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: "rgba(105,120,255,.12)", borderWidth: 1, borderColor: "rgba(183,197,255,.3)" },
  announcementTitle: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 12, lineHeight: 16 },
  announcementText: { color: palette.text, fontSize: 15, lineHeight: 21 },
  typing: { color: palette.muted, fontSize: 12, lineHeight: 16, paddingHorizontal: 20, paddingBottom: 4 },
  composerWrap: { paddingHorizontal: 16, paddingTop: 6, gap: 8 },
  quickRow: { flexGrow: 0, gap: 8 },
  quick: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  quickLabel: { color: "rgba(255,255,255,.8)", fontSize: 13, lineHeight: 17 },
  editBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(105,120,255,.14)" },
  editLabel: { flex: 1, color: palette.accent, fontSize: 13, lineHeight: 17 },
  editCancel: { paddingHorizontal: 8, paddingVertical: 2 },
  editCancelLabel: { color: palette.text, fontSize: 13, lineHeight: 17 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingLeft: 14, paddingRight: 6, paddingVertical: 6, borderRadius: 22, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  input: { flex: 1, minHeight: 40, maxHeight: 120, paddingVertical: 9, color: palette.text, fontSize: 15, backgroundColor: "transparent" },
  send: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sendCheck: { color: palette.text, fontSize: 20, lineHeight: 24 },
  counter: { alignSelf: "flex-end", color: palette.muted, fontSize: 11, lineHeight: 14, marginRight: 8 },
  error: { color: palette.error, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, paddingTop: 8 },
  connection: { color: palette.muted, fontSize: 12, lineHeight: 17, paddingHorizontal: 20, paddingTop: 8, textAlign: "center" },
  danger: { color: palette.error },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.55)" },
  sheet: { gap: 4, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.glassSheet, borderTopWidth: 1, borderColor: palette.glassBorder },
  sheetTitle: { color: palette.muted, fontSize: 13, lineHeight: 18, textAlign: "center", paddingHorizontal: 12, paddingBottom: 8 },
  sheetOption: { minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.04)" },
  sheetCancel: { marginTop: 6, backgroundColor: "rgba(255,255,255,.08)" },
  sheetLabel: { color: palette.text, fontFamily: "Outfit-Medium", fontSize: 15, lineHeight: 20 },
  closed: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 32 },
  closedIcon: { color: "#f4d47d", fontFamily: "Fraunces", fontSize: 32, lineHeight: 40 },
  closedTitle: { color: palette.text, fontFamily: "Fraunces", fontSize: 22, lineHeight: 28, textAlign: "center" },
  closedText: { color: palette.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  closedButton: { marginTop: 8, minHeight: 46, paddingHorizontal: 20, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(105,120,255,.16)", borderWidth: 1, borderColor: "rgba(183,197,255,.35)" },
  closedButtonLabel: { color: palette.accent, fontFamily: "Outfit-SemiBold", fontSize: 14 },
})

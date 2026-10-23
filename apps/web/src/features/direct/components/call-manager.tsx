'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff, Video, VideoOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { showApiError } from '@/lib/api/errors';
import type { Call, Chat } from '@/lib/api/types';
import { useRealtimeEvent } from '@/lib/realtime';
import { createPeer, type Peer, type SignalKind } from '@/lib/webrtc';
import {
  useAcceptCallMutation,
  useDeclineCallMutation,
  useEndCallMutation,
  useLazyGetIceServersQuery,
  useStartCallMutation,
} from '../api';
import { ChatAvatar } from './chat-avatar';

type Session = {
  call: Call;
  isCaller: boolean;
  remoteName: string;
  localStream: MediaStream;
  remoteStream: MediaStream | null;
};

type CallContextValue = {
  startCall: (chat: Chat, meId: string, type: Call['type']) => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used inside CallManager');
  return value;
}

type Signal = { callId: string; fromUserId: string; kind: SignalKind; payload: unknown };

function VideoView({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  return (
    <video
      ref={(el) => {
        if (el && el.srcObject !== stream) el.srcObject = stream;
      }}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

// «0:42» — сколько идёт разговор.
function CallTimer({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (since === null) return null;
  const sec = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
    </span>
  );
}

// Окно входящего звонка и окно звонка (SCREENS §3.12). Монтируется один раз в AppShell: входящие звонки приходят на любой странице.
export function CallManager({ children }: { children: React.ReactNode }) {
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  // Свёрнутый звонок — маленькая панель в углу; разговор идёт, приложением можно пользоваться.
  const [minimized, setMinimized] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingSignals = useRef<Signal[]>([]);

  const [startCallMutation] = useStartCallMutation();
  const [acceptCall, { isLoading: isAccepting }] = useAcceptCallMutation();
  const [declineCall] = useDeclineCallMutation();
  const [endCall] = useEndCallMutation();
  const [loadIceServers] = useLazyGetIceServersQuery();

  const closeSession = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    callIdRef.current = null;
    pendingSignals.current = [];
    setSession(null);
    setIncoming(null);
    setMinimized(false);
    setConnectedAt(null);
  }, []);

  // Создаёт RTCPeerConnection и открывает окно звонка.
  const openSession = useCallback(
    async (call: Call, isCaller: boolean, remoteUserId: string, remoteName: string) => {
      const { iceServers } = await loadIceServers().unwrap();
      const peer = await createPeer({
        callId: call.id,
        remoteUserId,
        iceServers: iceServers as RTCIceServer[],
        video: call.type === 'VIDEO',
        onRemoteStream: (remoteStream) => {
          setConnectedAt((t) => t ?? Date.now());
          setSession((s) =>
            s ? { ...s, remoteStream: new MediaStream(remoteStream.getTracks()) } : s,
          );
        },
        onConnectionState: (state) => {
          if (state === 'failed') toast.error('Соединение потеряно');
        },
      });
      peerRef.current = peer;
      callIdRef.current = call.id;
      setMicOn(true);
      setCameraOn(call.type === 'VIDEO');
      setSession({ call, isCaller, remoteName, localStream: peer.localStream, remoteStream: null });
      // Сигналы, пришедшие раньше, чем создан peer.
      for (const signal of pendingSignals.current.splice(0)) {
        void peer.handleSignal(signal.kind, signal.payload);
      }
    },
    [loadIceServers],
  );

  const startCall = useCallback(
    async (chat: Chat, meId: string, type: Call['type']) => {
      const peerUser = chat.participants.find((p) => p.id !== meId);
      if (!peerUser) return;
      let call: Call;
      try {
        call = await startCallMutation({ chatId: chat.id, type }).unwrap();
      } catch (error) {
        showApiError(error);
        return;
      }
      try {
        await openSession(call, true, peerUser.id, peerUser.userName);
      } catch {
        // Нет доступа к камере/микрофону — звонок не должен «висеть» у собеседника.
        toast.error('Нет доступа к камере или микрофону');
        closeSession();
        void endCall({ callId: call.id, chatId: call.chatId });
      }
    },
    [closeSession, endCall, openSession, startCallMutation],
  );

  useRealtimeEvent<{ call: Call }>('call:incoming', ({ call }) => {
    if (callIdRef.current) return; // уже в звонке
    setIncoming(call);
  });

  // Собеседник принял — звонящий отправляет offer.
  useRealtimeEvent<{ callId: string; userId: string }>('call:accepted', ({ callId }) => {
    if (callIdRef.current === callId) void peerRef.current?.start();
  });

  useRealtimeEvent<{ callId: string; userId: string }>('call:declined', ({ callId }) => {
    if (callIdRef.current === callId) {
      toast('Звонок отклонён');
      closeSession();
    }
  });

  useRealtimeEvent<{ call: Call }>('call:ended', ({ call }) => {
    if (callIdRef.current === call.id || incoming?.id === call.id) closeSession();
  });

  useRealtimeEvent<Signal>('call:signal', (signal) => {
    if (callIdRef.current !== signal.callId) return;
    if (peerRef.current) void peerRef.current.handleSignal(signal.kind, signal.payload);
    else pendingSignals.current.push(signal);
  });

  async function handleAccept() {
    if (!incoming) return;
    const call = incoming;
    callIdRef.current = call.id; // чтобы принять сигналы до готовности peer
    try {
      const accepted = await acceptCall(call.id).unwrap();
      setIncoming(null);
      try {
        await openSession(accepted, false, call.initiator.id, call.initiator.userName);
      } catch {
        toast.error('Нет доступа к камере или микрофону');
        closeSession();
        void endCall({ callId: call.id, chatId: call.chatId });
      }
    } catch (error) {
      callIdRef.current = null;
      setIncoming(null);
      showApiError(error);
    }
  }

  async function handleDecline() {
    if (!incoming) return;
    const call = incoming;
    setIncoming(null);
    try {
      await declineCall(call.id).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  async function handleEnd() {
    if (!session) return;
    const { call } = session;
    closeSession();
    try {
      await endCall({ callId: call.id, chatId: call.chatId }).unwrap();
    } catch (error) {
      showApiError(error);
    }
  }

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}

      {incoming && (
        <div
          role="alertdialog"
          aria-label="Входящий звонок"
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
        >
          <div className="flex w-full max-w-[400px] flex-col items-center gap-3 rounded-2xl bg-background-elevated p-6 text-center">
            <ChatAvatar
              url={incoming.initiator.avatarUrl}
              name={incoming.initiator.userName}
              size={96}
            />
            <p className="text-18 font-semibold">{incoming.initiator.userName}</p>
            <p className="text-14 text-muted-foreground">
              {incoming.type === 'VIDEO' ? 'Видеозвонок' : 'Аудиозвонок'}
            </p>
            <div className="mt-2 flex w-full gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => void handleDecline()}>
                Отклонить
              </Button>
              <Button
                className="flex-1 bg-success text-primary-foreground hover:bg-success"
                disabled={isAccepting}
                onClick={() => void handleAccept()}
              >
                Принять
              </Button>
            </div>
          </div>
        </div>
      )}

      {session && (
        <CallWindow
          session={session}
          minimized={minimized}
          connectedAt={connectedAt}
          micOn={micOn}
          cameraOn={cameraOn}
          onToggleMic={() => {
            peerRef.current?.setMicEnabled(!micOn);
            setMicOn(!micOn);
          }}
          onToggleCamera={() => {
            peerRef.current?.setCameraEnabled(!cameraOn);
            setCameraOn(!cameraOn);
          }}
          onMinimize={setMinimized}
          onEnd={() => void handleEnd()}
        />
      )}
    </CallContext.Provider>
  );
}

const roundBtn =
  'flex size-12 items-center justify-center rounded-full bg-white/20 hover:bg-white/30';
const smallBtn =
  'flex size-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30';

// Окно звонка: на весь экран или свёрнутое в правый нижний угол (видео и связь не прерываются —
// меняется только разметка, RTCPeerConnection живёт в CallManager).
export function CallWindow({
  session,
  minimized,
  connectedAt,
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onMinimize,
  onEnd,
}: {
  session: Session;
  minimized: boolean;
  connectedAt: number | null;
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onMinimize: (minimized: boolean) => void;
  onEnd: () => void;
}) {
  const isVideo = session.call.type === 'VIDEO';
  const status = session.remoteStream ? (
    <CallTimer since={connectedAt} />
  ) : session.isCaller ? (
    'Вызов…'
  ) : (
    'Соединение…'
  );

  if (minimized) {
    return (
      <div
        role="dialog"
        aria-label="Звонок (свёрнут)"
        className="fixed right-4 bottom-20 z-50 w-[260px] overflow-hidden rounded-2xl bg-black text-white shadow-[var(--shadow-strong)] md:bottom-16"
      >
        {isVideo ? (
          <button
            type="button"
            aria-label="Развернуть звонок"
            onClick={() => onMinimize(false)}
            className="relative block aspect-video w-full"
          >
            <VideoView stream={session.remoteStream} className="size-full object-cover" />
          </button>
        ) : (
          // Аудио: звук идёт через скрытый <video>, чтобы он не пропал при сворачивании.
          <VideoView stream={session.remoteStream} className="hidden" />
        )}
        <div className="flex items-center gap-2 p-2">
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-14 font-semibold">{session.remoteName}</p>
            <p className="text-12 opacity-70">{status}</p>
          </div>
          <button
            type="button"
            aria-label={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
            onClick={onToggleMic}
            className={smallBtn}
          >
            {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </button>
          <button
            type="button"
            aria-label="Развернуть звонок"
            onClick={() => onMinimize(false)}
            className={smallBtn}
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Завершить звонок"
            onClick={onEnd}
            className="flex size-9 items-center justify-center rounded-full bg-destructive"
          >
            <PhoneOff className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Звонок"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <div className="relative flex-1">
        <VideoView stream={session.remoteStream} className="size-full object-contain" />
        {(!session.remoteStream || !isVideo) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-20 font-semibold">{session.remoteName}</p>
            <p className="text-14 opacity-70">{status}</p>
          </div>
        )}
        <button
          type="button"
          aria-label="Свернуть звонок"
          onClick={() => onMinimize(true)}
          className="absolute top-4 left-4 flex size-10 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
        >
          <Minimize2 className="size-5" />
        </button>
        {isVideo && (
          <VideoView
            stream={session.localStream}
            muted
            className="absolute right-4 bottom-4 h-40 w-28 rounded-xl border border-white/30 object-cover md:h-48 md:w-36"
          />
        )}
      </div>
      <div className="flex justify-center gap-4 p-5">
        <button
          type="button"
          aria-label={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
          onClick={onToggleMic}
          className={roundBtn}
        >
          {micOn ? <Mic /> : <MicOff />}
        </button>
        {isVideo && (
          <button
            type="button"
            aria-label={cameraOn ? 'Выключить камеру' : 'Включить камеру'}
            onClick={onToggleCamera}
            className={roundBtn}
          >
            {cameraOn ? <Video /> : <VideoOff />}
          </button>
        )}
        <button
          type="button"
          aria-label="Завершить звонок"
          onClick={onEnd}
          className="flex size-12 items-center justify-center rounded-full bg-destructive"
        >
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}

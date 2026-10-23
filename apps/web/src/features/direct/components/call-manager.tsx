'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';
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

// Окно входящего звонка и окно звонка (SCREENS §3.12). Монтируется один раз в AppShell: входящие звонки приходят на любой странице.
export function CallManager({ children }: { children: React.ReactNode }) {
  const [incoming, setIncoming] = useState<Call | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
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
        onRemoteStream: (remoteStream) =>
          setSession((s) =>
            s ? { ...s, remoteStream: new MediaStream(remoteStream.getTracks()) } : s,
          ),
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
      try {
        const call = await startCallMutation({ chatId: chat.id, type }).unwrap();
        await openSession(call, true, peerUser.id, peerUser.userName);
      } catch (error) {
        showApiError(error);
      }
    },
    [openSession, startCallMutation],
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
      await openSession(accepted, false, call.initiator.id, call.initiator.userName);
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
        <div
          role="dialog"
          aria-label="Звонок"
          className="fixed inset-0 z-50 flex flex-col bg-black text-white"
        >
          <div className="relative flex-1">
            <VideoView stream={session.remoteStream} className="size-full object-contain" />
            {!session.remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <p className="text-20 font-semibold">{session.remoteName}</p>
                <p className="text-14 opacity-70">{session.isCaller ? 'Вызов…' : 'Соединение…'}</p>
              </div>
            )}
            {session.call.type === 'VIDEO' && (
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
              onClick={() => {
                peerRef.current?.setMicEnabled(!micOn);
                setMicOn(!micOn);
              }}
              className="flex size-12 items-center justify-center rounded-full bg-white/20"
            >
              {micOn ? <Mic /> : <MicOff />}
            </button>
            {session.call.type === 'VIDEO' && (
              <button
                type="button"
                aria-label={cameraOn ? 'Выключить камеру' : 'Включить камеру'}
                onClick={() => {
                  peerRef.current?.setCameraEnabled(!cameraOn);
                  setCameraOn(!cameraOn);
                }}
                className="flex size-12 items-center justify-center rounded-full bg-white/20"
              >
                {cameraOn ? <Video /> : <VideoOff />}
              </button>
            )}
            <button
              type="button"
              aria-label="Завершить звонок"
              onClick={() => void handleEnd()}
              className="flex size-12 items-center justify-center rounded-full bg-destructive"
            >
              <PhoneOff />
            </button>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}

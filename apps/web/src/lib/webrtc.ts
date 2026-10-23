// WebRTC-звонок peer-to-peer (ADR 0015). Медиа идёт напрямую, сигнализация (offer/answer/ice) — через Socket.IO.
// Файл не знает про React: компонент создаёт Peer, передаёт ему входящие сигналы и колбэки.
import { getSocket } from '@/lib/realtime';

export type SignalKind = 'offer' | 'answer' | 'ice';

export type PeerOptions = {
  callId: string;
  /** Id собеседника — адресат сигналов. */
  remoteUserId: string;
  iceServers: RTCIceServer[];
  video: boolean;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
};

export type Peer = {
  localStream: MediaStream;
  /** Звонящий вызывает после call:accepted — создаёт offer. */
  start: () => Promise<void>;
  /** Входящий сигнал call:signal от собеседника. */
  handleSignal: (kind: SignalKind, payload: unknown) => Promise<void>;
  setMicEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  close: () => void;
};

type Ack = { ok: boolean; code?: string };

// Отправка сигнала с подтверждением (ack) — REALTIME.md.
function sendSignal(
  callId: string,
  toUserId: string,
  kind: SignalKind,
  payload: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = getSocket();
    if (!socket.connected) return reject(new Error('No realtime connection'));
    socket.emit('call:signal', { callId, toUserId, kind, payload }, (ack?: Ack) => {
      if (ack && !ack.ok) reject(new Error(ack.code ?? 'SIGNAL_REJECTED'));
      else resolve();
    });
  });
}

export async function createPeer(options: PeerOptions): Promise<Peer> {
  const { callId, remoteUserId, iceServers, video } = options;

  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  const pc = new RTCPeerConnection({ iceServers });
  const remoteStream = new MediaStream();
  const pendingIce: RTCIceCandidateInit[] = []; // кандидаты, пришедшие до remoteDescription

  for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

  pc.ontrack = (event) => {
    for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
      if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track);
    }
    options.onRemoteStream(remoteStream);
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void sendSignal(callId, remoteUserId, 'ice', event.candidate.toJSON()).catch(() => {});
    }
  };
  pc.onconnectionstatechange = () => options.onConnectionState?.(pc.connectionState);

  async function flushIce() {
    while (pendingIce.length > 0) await pc.addIceCandidate(pendingIce.shift());
  }

  return {
    localStream,

    async start() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(callId, remoteUserId, 'offer', offer);
    },

    async handleSignal(kind, payload) {
      if (kind === 'offer') {
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(callId, remoteUserId, 'answer', answer);
      } else if (kind === 'answer') {
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        await flushIce();
      } else if (pc.remoteDescription) {
        await pc.addIceCandidate(payload as RTCIceCandidateInit);
      } else {
        pendingIce.push(payload as RTCIceCandidateInit);
      }
    },

    setMicEnabled(enabled) {
      for (const track of localStream.getAudioTracks()) track.enabled = enabled;
    },
    setCameraEnabled(enabled) {
      for (const track of localStream.getVideoTracks()) track.enabled = enabled;
    },

    close() {
      for (const track of localStream.getTracks()) track.stop();
      pc.close();
    },
  };
}

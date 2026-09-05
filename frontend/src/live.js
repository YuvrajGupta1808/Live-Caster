import { getIdToken } from './firebase';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live';

// Thin wrapper around the /ws/live WebSocket. Sends {start, frame, stop}
// messages and surfaces every server event through onEvent({type, ...}).
export class LiveSession {
    constructor({ onEvent, quiet = false }) {
        this.onEvent = onEvent;
        this.quiet = quiet;
        this.ws = null;
    }

    connect() {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = async () => {
            const token = await getIdToken();
            this.ws.send(JSON.stringify({ type: 'start', quiet: this.quiet, token }));
        };

        this.ws.onmessage = (event) => {
            try {
                this.onEvent(JSON.parse(event.data));
            } catch (err) {
                console.error('Malformed live event:', event.data, err);
            }
        };

        this.ws.onerror = () => {
            this.onEvent({ type: 'error', content: 'WebSocket connection failed' });
        };

        this.ws.onclose = () => {
            this.onEvent({ type: 'closed' });
        };
    }

    get isOpen() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    sendFrame(dataUrl, nudge = true) {
        if (!this.isOpen) return false;
        this.ws.send(JSON.stringify({ type: 'frame', data: dataUrl, nudge }));
        return true;
    }

    sendAudio(base64Pcm) {
        if (!this.isOpen) return false;
        this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm }));
        return true;
    }

    sendInstruction(text) {
        if (!this.isOpen) return false;
        this.ws.send(JSON.stringify({ type: 'instruction', text }));
        return true;
    }

    stop() {
        if (this.isOpen) {
            this.ws.send(JSON.stringify({ type: 'stop' }));
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Plays the Live API's native audio output: 24kHz 16-bit signed PCM, mono.
// Chunks are scheduled back-to-back on an AudioContext timeline so they
// form one continuous voice.
export class PcmPlayer {
    constructor(sampleRate = 24000) {
        this.sampleRate = sampleRate;
        this.ctx = null;
        this.nextStartTime = 0;
        this.activeSources = new Set();
    }

    ensureContext() {
        if (!this.ctx) {
            this.ctx = new AudioContext({ sampleRate: this.sampleRate });
            this.nextStartTime = 0;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(base64Pcm) {
        this.ensureContext();

        const bytes = Uint8Array.from(atob(base64Pcm), (c) => c.charCodeAt(0));
        const samples = new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
        if (samples.length === 0) return;

        const buffer = this.ctx.createBuffer(1, samples.length, this.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
            channel[i] = samples[i] / 32768;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        this.activeSources.add(source);
        source.onended = () => this.activeSources.delete(source);

        const startAt = Math.max(this.nextStartTime, this.ctx.currentTime);
        source.start(startAt);
        this.nextStartTime = startAt + buffer.duration;
    }

    // Barge-in: the user spoke, so drop everything queued and go silent now.
    flush() {
        for (const source of this.activeSources) {
            try { source.stop(); } catch { /* already stopped */ }
        }
        this.activeSources.clear();
        this.nextStartTime = 0;
    }

    close() {
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}

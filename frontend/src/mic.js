// Microphone capture for the live session: 16kHz 16-bit PCM chunks,
// base64-encoded, delivered via onChunk. Also reports a rough speech
// level via onLevel so the app knows when the user is talking.

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 2048; // ~128ms at 16kHz per WebSocket message

const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor('pcm-capture', PcmCaptureProcessor);
`;

export class MicStreamer {
    constructor({ onChunk, onLevel }) {
        this.onChunk = onChunk;
        this.onLevel = onLevel;
        this.ctx = null;
        this.stream = null;
        this.workletNode = null;
        this.muted = false;
        this.pending = new Float32Array(0);
    }

    async start() {
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,   // keep the model's own voice out of the mic
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        this.ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        const workletUrl = URL.createObjectURL(
            new Blob([WORKLET_SOURCE], { type: 'application/javascript' })
        );
        await this.ctx.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        const source = this.ctx.createMediaStreamSource(this.stream);
        this.workletNode = new AudioWorkletNode(this.ctx, 'pcm-capture');
        this.workletNode.port.onmessage = (e) => this.handleSamples(e.data);
        source.connect(this.workletNode);
    }

    handleSamples(samples) {
        if (this.muted) return;

        const merged = new Float32Array(this.pending.length + samples.length);
        merged.set(this.pending);
        merged.set(samples, this.pending.length);
        this.pending = merged;

        while (this.pending.length >= CHUNK_SAMPLES) {
            const chunk = this.pending.subarray(0, CHUNK_SAMPLES);
            this.pending = this.pending.slice(CHUNK_SAMPLES);
            this.emitChunk(chunk);
        }
    }

    emitChunk(floatSamples) {
        let sumSquares = 0;
        const pcm = new Int16Array(floatSamples.length);
        for (let i = 0; i < floatSamples.length; i++) {
            const s = Math.max(-1, Math.min(1, floatSamples[i]));
            pcm[i] = s * 0x7fff;
            sumSquares += s * s;
        }
        if (this.onLevel) {
            this.onLevel(Math.sqrt(sumSquares / floatSamples.length));
        }

        const bytes = new Uint8Array(pcm.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        this.onChunk(btoa(binary));
    }

    setMuted(muted) {
        this.muted = muted;
    }

    stop() {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.workletNode?.disconnect();
        this.ctx?.close();
        this.stream = null;
        this.workletNode = null;
        this.ctx = null;
        this.pending = new Float32Array(0);
    }
}

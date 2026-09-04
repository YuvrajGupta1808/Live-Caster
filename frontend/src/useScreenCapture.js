import { useState, useRef, useEffect, useCallback } from 'react';

const CAPTURE_INTERVAL_MS = 2000;

// Frames are downscaled before sending — the model reads a ~1024px frame
// as well as a 4K one, at a fraction of the tokens.
const MAX_FRAME_WIDTH = 1024;

// Frame change detection: frames are downscaled to a tiny grayscale grid
// and compared against the previous one. Unchanged frames are dropped
// before they ever reach the backend, so a static screen costs nothing.
const DIFF_GRID_SIZE = 32;
const DIFF_THRESHOLD = 6; // mean per-pixel delta (0-255) required to count as change

// Demo mode (?demo=1): a synthetic animated "screen" from a canvas, so the
// app runs end to end without the browser's screen-share picker.
function createDemoStream() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const scenes = [
        { title: 'Inbox — 3 unread messages', body: 'Meeting notes from Sarah\nInvoice #2041 due Friday\nWelcome to the team!', accent: '#2563eb' },
        { title: 'Alert: Download complete', body: 'report-final.pdf has finished downloading.\nClick to open the file.', accent: '#dc2626' },
        { title: 'Calendar — Today', body: '10:00  Design review\n13:00  Lunch with Alex\n15:30  Sprint planning', accent: '#059669' },
    ];
    let sceneIndex = -1;
    const draw = () => {
        sceneIndex = (sceneIndex + 1) % scenes.length;
        const s = scenes[sceneIndex];
        ctx.fillStyle = '#f4f4f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = s.accent;
        ctx.fillRect(0, 0, canvas.width, 90);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(s.title, 40, 60);
        ctx.fillStyle = '#18181b';
        ctx.font = '32px sans-serif';
        s.body.split('\n').forEach((line, i) => ctx.fillText(line, 40, 180 + i * 60));
    };
    draw();
    const timer = setInterval(draw, 6000);
    const stream = canvas.captureStream(2);
    stream.getTracks()[0].addEventListener('ended', () => clearInterval(timer));
    return stream;
}

export const useScreenCapture = (onFrameCaptured, onFrameSkipped) => {
    const [stream, setStream] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const intervalRef = useRef(null);
    const diffCanvasRef = useRef(null);
    const prevSignatureRef = useRef(null);

    const startCapture = async () => {
        try {
            const isDemo = new URLSearchParams(window.location.search).has('demo');
            const mediaStream = isDemo
                ? createDemoStream()
                : await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: 'always', displaySurface: 'browser' },
                    audio: false,
                });

            setStream(mediaStream);
            setIsSharing(true);
            prevSignatureRef.current = null;

            // Stop sharing when user clicks "Stop sharing" in browser UI
            mediaStream.getTracks()[0].onended = () => {
                stopCapture();
            };

        } catch (err) {
            console.error("Error starting screen capture:", err);
        }
    };

    // Attach stream to video element when it becomes available
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(err => console.error("Error playing video:", err));
        }
    }, [stream, isSharing]);

    const stopCapture = useCallback(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsSharing(false);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
    }, [stream]);

    // Returns true when the frame differs enough from the previous one.
    const frameHasChanged = useCallback((video) => {
        if (!diffCanvasRef.current) {
            diffCanvasRef.current = document.createElement('canvas');
            diffCanvasRef.current.width = DIFF_GRID_SIZE;
            diffCanvasRef.current.height = DIFF_GRID_SIZE;
        }
        const ctx = diffCanvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, DIFF_GRID_SIZE, DIFF_GRID_SIZE);
        const { data } = ctx.getImageData(0, 0, DIFF_GRID_SIZE, DIFF_GRID_SIZE);

        const signature = new Uint8Array(DIFF_GRID_SIZE * DIFF_GRID_SIZE);
        for (let i = 0; i < signature.length; i++) {
            const o = i * 4;
            signature[i] = (data[o] + data[o + 1] + data[o + 2]) / 3;
        }

        const prev = prevSignatureRef.current;
        prevSignatureRef.current = signature;
        if (!prev) return true;

        let totalDelta = 0;
        for (let i = 0; i < signature.length; i++) {
            totalDelta += Math.abs(signature[i] - prev[i]);
        }
        return totalDelta / signature.length >= DIFF_THRESHOLD;
    }, []);

    const grabFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return null;

        const scale = Math.min(1, MAX_FRAME_WIDTH / (video.videoWidth || MAX_FRAME_WIDTH));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.7);
    }, []);

    // On-demand capture ("describe now"): bypasses the diff entirely.
    const captureNow = useCallback(() => grabFrame(), [grabFrame]);

    // Frame extraction loop
    useEffect(() => {
        if (isSharing && videoRef.current && canvasRef.current) {
            intervalRef.current = setInterval(() => {
                const video = videoRef.current;
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    if (!frameHasChanged(video)) {
                        if (onFrameSkipped) onFrameSkipped();
                        return;
                    }
                    const frame = grabFrame();
                    if (frame && onFrameCaptured) {
                        onFrameCaptured(frame);
                    }
                }
            }, CAPTURE_INTERVAL_MS);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isSharing, onFrameCaptured, onFrameSkipped, frameHasChanged, grabFrame]);

    return {
        stream,
        isSharing,
        startCapture,
        stopCapture,
        captureNow,
        videoRef,
        canvasRef
    };
};

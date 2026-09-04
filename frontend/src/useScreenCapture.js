import { useState, useRef, useEffect, useCallback } from 'react';

const CAPTURE_INTERVAL_MS = 2000;

// Frame change detection: frames are downscaled to a tiny grayscale grid
// and compared against the previous one. Unchanged frames are dropped
// before they ever reach the backend, so a static board costs nothing.
const DIFF_GRID_SIZE = 32;
const DIFF_THRESHOLD = 6; // mean per-pixel delta (0-255) required to count as change

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
            const mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always",
                    displaySurface: "browser"
                },
                audio: false
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

    // Frame extraction loop
    useEffect(() => {
        if (isSharing && videoRef.current && canvasRef.current) {
            intervalRef.current = setInterval(() => {
                const video = videoRef.current;
                const canvas = canvasRef.current;

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    if (!frameHasChanged(video)) {
                        if (onFrameSkipped) onFrameSkipped();
                        return;
                    }

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const frame = canvas.toDataURL('image/jpeg', 0.7);

                    if (onFrameCaptured) {
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
    }, [isSharing, onFrameCaptured, onFrameSkipped, frameHasChanged]);

    return {
        stream,
        isSharing,
        startCapture,
        stopCapture,
        videoRef,
        canvasRef
    };
};

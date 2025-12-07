import { useState, useRef, useEffect, useCallback } from 'react';

export const useScreenCapture = (onFrameCaptured) => {
    const [stream, setStream] = useState(null);
    const [isSharing, setIsSharing] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const intervalRef = useRef(null);

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
    }, [stream, isSharing]); // Re-run when sharing state changes and video element is mounted

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

    // Frame extraction loop
    useEffect(() => {
        if (isSharing && videoRef.current && canvasRef.current) {
            intervalRef.current = setInterval(() => {
                const video = videoRef.current;
                const canvas = canvasRef.current;

                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Convert to base64
                    const frame = canvas.toDataURL('image/jpeg', 0.7); // 0.7 quality

                    if (onFrameCaptured) {
                        onFrameCaptured(frame);
                    }
                }
            }, 5000); // Capture every 5 seconds
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isSharing, onFrameCaptured]);

    return {
        stream,
        isSharing,
        startCapture,
        stopCapture,
        videoRef,
        canvasRef
    };
};

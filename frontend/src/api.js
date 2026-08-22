const API_URL = 'http://localhost:8000';

export const analyzeFrame = async (base64Image, skipAudio = false) => {
    try {
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                skip_audio: skipAudio
            }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        return await response.json();
    } catch (error) {
        console.error('Error analyzing frame:', error);
        return null;
    }
};

// Streams SSE frames from /analyze-stream and invokes onEvent({type, content})
// for each parsed frame. Frame types: text | refined | audio | done | error.
export const streamAnalyzeFrame = async (base64Image, onEvent) => {
    try {
        const response = await fetch(`${API_URL}/analyze-stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                skip_audio: true
            }),
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE frames are separated by a blank line; keep any partial
            // frame in the buffer until its terminator arrives.
            const frames = buffer.split('\n\n');
            buffer = frames.pop();

            for (const frame of frames) {
                const line = frame.trim();
                if (!line.startsWith('data: ')) continue;
                try {
                    onEvent(JSON.parse(line.slice(6)));
                } catch (err) {
                    console.error('Malformed SSE frame:', line, err);
                }
            }
        }
    } catch (error) {
        console.error('Error streaming frame:', error);
        onEvent({ type: 'error', content: String(error) });
    }
};

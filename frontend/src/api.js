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

export const streamAnalyzeFrame = async (base64Image, onChunk) => {
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            onChunk(text);
        }
    } catch (error) {
        console.error('Error streaming frame:', error);
    }
};

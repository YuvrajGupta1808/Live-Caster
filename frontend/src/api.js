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

export const generateAudio = async (text) => {
    try {
        const response = await fetch(`${API_URL}/generate-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) throw new Error('Failed to generate audio');

        const data = await response.json();
        return data.audio;
    } catch (error) {
        console.error('Error generating audio:', error);
        return null;
    }
};

export const streamAnalyzeFrameWithAudio = async (base64Image, onText, onAudio) => {
    try {
        console.log('📡 Sending request to /analyze-stream-audio');
        
        const response = await fetch(`${API_URL}/analyze-stream-audio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                skip_audio: false
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
            const lines = buffer.split('\n');
            
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                    const data = JSON.parse(line);
                    console.log('📦 Received data type:', data.type);
                    
                    if (data.type === 'text') {
                        onText(data.data);
                    } else if (data.type === 'audio') {
                        console.log('🎵 Audio data received, length:', data.data?.length);
                        onAudio(data.data);
                    } else if (data.type === 'done') {
                        console.log('✅ Stream complete');
                        return;
                    } else if (data.type === 'error') {
                        console.error('❌ Stream error:', data.data);
                    }
                } catch (e) {
                    console.error('❌ Error parsing JSON line:', line.substring(0, 100), e);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error streaming frame with audio:', error);
    }
};

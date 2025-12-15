class TTSService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isSpeaking = false;
        
        this.onAudioChunk = null;
        this.onSpeechStarted = null;
        this.onSpeechEnded = null;
        this.onError = null;
    }
    

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `ws://localhost:8080?service=tts`;
                
                console.log('Connecting to Google TTS proxy:', wsUrl);
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ TTS WebSocket connected to proxy');
                    
                
                    this.send({ type: 'start' });
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data, resolve, reject);
                };
                
                this.ws.onerror = (error) => {
                    console.error('TTS WebSocket error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('TTS WebSocket closed');
                    this.isConnected = false;
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    

    handleMessage(data, resolvePromise, rejectPromise) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'ready':
                    console.log('✅ Google TTS ready');
                    this.isConnected = true;
                    
                    if (resolvePromise) {
                        resolvePromise();
                    }
                    break;
                    
                case 'audio':
                    
                    if (message.data && this.onAudioChunk) {
                        const audioData = this.base64ToArrayBuffer(message.data);
                        this.onAudioChunk(audioData);
                        
                        
                        if (!this.isSpeaking) {
                            this.isSpeaking = true;
                            if (this.onSpeechStarted) {
                                this.onSpeechStarted();
                            }
                        }
                    }
                    break;
                    
                case 'done':
                    console.log('✅ TTS audio stream completed');
                    this.isSpeaking = false;
                    if (this.onSpeechEnded) {
                        this.onSpeechEnded();
                    }
                    break;
                    
                case 'error':
                    console.error('❌ TTS error:', message.message);
                    const error = new Error(message.message);
                    
                    if (this.onError) {
                        this.onError(error);
                    }
                    
                    if (rejectPromise) {
                        rejectPromise(error);
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to parse TTS message:', error);
            if (rejectPromise) {
                rejectPromise(error);
            }
        }
    }
    

    speak(text) {
        if (!this.isConnected || !this.ws) {
            console.warn('Cannot speak: not connected');
            return;
        }
        
        console.log('🔊 Speaking:', text);
        
        this.send({
            type: 'speak',
            text: text
        });
    }
    

    send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send TTS message:', error);
        }
    }
    

    setCallbacks({ onAudioChunk, onSpeechStarted, onSpeechEnded, onError }) {
        this.onAudioChunk = onAudioChunk;
        this.onSpeechStarted = onSpeechStarted;
        this.onSpeechEnded = onSpeechEnded;
        this.onError = onError;
    }
    

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isSpeaking = false;
    }

    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    

    isActive() {
        return this.isConnected;
    }
    

    isSpeakingNow() {
        return this.isSpeaking;
    }
}

export default TTSService;
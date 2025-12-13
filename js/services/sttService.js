/**
 * Speech-to-Text Service
 * Uses Groq Whisper API via proxy
 */

class STTService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isTranscribing = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelayMs = 2000;
        
        // Callbacks
        this.onPartialTranscript = null;
        this.onFinalTranscript = null;
        this.onError = null;
        
        // Audio buffer
        this.audioBuffer = [];
        this.transcriptionTimeout = null;
    }
    
    /**
     * Connect to proxy server
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `ws://localhost:8080?service=stt`;

                console.log('Connecting to Groq STT proxy:', wsUrl);
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ STT WebSocket connected to proxy');
                    
                    // Send start message
                    this.send({ type: 'start' });
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data, resolve, reject);
                };
                
                this.ws.onerror = (error) => {
                    console.error('STT WebSocket error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
                    reject(error);
                };
                
                this.ws.onclose = () => {
                    console.log('STT WebSocket closed');
                    this.isConnected = false;
                    this.handleDisconnect();
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Handle incoming messages
     */
    handleMessage(data, resolvePromise, rejectPromise) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'ready':
                    console.log('✅ Groq STT ready');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    if (resolvePromise) {
                        resolvePromise();
                    }
                    break;
                    
                case 'transcript':
                    const transcript = message.text;
                    console.log('📝 Transcript:', transcript);
                    
                    if (this.onFinalTranscript) {
                        this.onFinalTranscript(transcript);
                    }
                    break;
                    
                case 'error':
                    console.error('❌ STT error:', message.message);
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
            console.error('Failed to parse STT message:', error);
            if (rejectPromise) {
                rejectPromise(error);
            }
        }
    }
    
    /**
     * Send audio data for transcription
     */
    sendAudio(audioData) {
        if (!this.isConnected || !this.ws) {
            console.warn('Cannot send audio: not connected');
            return;
        }
        
        // Convert to base64
        const int16Data = new Int16Array(audioData);
        const base64Audio = this.arrayBufferToBase64(int16Data.buffer);
        
        // Send audio chunk
        this.send({
            type: 'audio',
            audio: base64Audio
        });
        
        // Debounce transcription (trigger after 500ms of silence)
        if (this.transcriptionTimeout) {
            clearTimeout(this.transcriptionTimeout);
        }
        
        this.transcriptionTimeout = setTimeout(() => {
            this.commitAudio();
        }, 500);
    }
    
    /**
     * Commit audio buffer (trigger transcription)
     */
    commitAudio() {
        if (!this.isConnected || !this.ws) {
            return;
        }
        
        console.log('🎤 Triggering transcription...');
        this.send({ type: 'transcribe' });
    }
    
    /**
     * Send message via WebSocket
     */
    send(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }
    
    /**
     * Start transcription
     */
    startTranscription(onPartial, onFinal, onError) {
        this.onPartialTranscript = onPartial;
        this.onFinalTranscript = onFinal;
        this.onError = onError;
        this.isTranscribing = true;
    }
    
    /**
     * Stop transcription
     */
    stopTranscription() {
        this.isTranscribing = false;
        
        // Clear timeout
        if (this.transcriptionTimeout) {
            clearTimeout(this.transcriptionTimeout);
            this.transcriptionTimeout = null;
        }
        
        // Final transcription
        this.commitAudio();
    }
    
    /**
     * Handle disconnection
     */
    async handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            
            await new Promise(resolve => 
                setTimeout(resolve, this.reconnectDelayMs)
            );
            
            try {
                await this.connect();
            } catch (error) {
                console.error('Reconnection failed:', error);
            }
        }
    }
    
    /**
     * Disconnect from service
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isTranscribing = false;
        
        if (this.transcriptionTimeout) {
            clearTimeout(this.transcriptionTimeout);
            this.transcriptionTimeout = null;
        }
    }
    
    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Check if connected
     */
    isActive() {
        return this.isConnected;
    }
}

export default STTService;
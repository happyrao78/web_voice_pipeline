class STTService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isTranscribing = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelayMs = 2000;
        
        this.onPartialTranscript = null;
        this.onFinalTranscript = null;
        this.onError = null;
        
        this.audioStartTime = null;
        
        this.audioChunkBuffer = [];
        this.chunkBufferSize = 3; 
    }
    

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `ws://localhost:8080?service=stt`;

                console.log('Connecting to Groq STT proxy:', wsUrl);
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ STT WebSocket connected to proxy');
                    
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
                    console.log('📝 Transcript received:', transcript);
                    
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
    

    sendAudio(audioData) {
        if (!this.isConnected || !this.ws) {
            console.warn('Cannot send audio: not connected');
            return;
        }
        
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
        }
        
    
        this.audioChunkBuffer.push(audioData);
        
    
        if (this.audioChunkBuffer.length >= this.chunkBufferSize) {
            this.flushAudioBuffer();
        }
    }
    

    flushAudioBuffer() {
        if (this.audioChunkBuffer.length === 0) {
            return;
        }
        
        const totalLength = this.audioChunkBuffer.reduce((sum, chunk) => {
            return sum + new Int16Array(chunk).length;
        }, 0);
        
        const combinedBuffer = new Int16Array(totalLength);
        let offset = 0;
        
        for (const chunk of this.audioChunkBuffer) {
            const int16Data = new Int16Array(chunk);
            combinedBuffer.set(int16Data, offset);
            offset += int16Data.length;
        }
        
    
        const base64Audio = this.arrayBufferToBase64(combinedBuffer.buffer);
        

        this.send({
            type: 'audio',
            audio: base64Audio
        });
        
        this.audioChunkBuffer = [];
    }
    

    commitAudio() {
        if (!this.isConnected || !this.ws) {
            return;
        }
        

        this.flushAudioBuffer();
        
        console.log('🎤 Triggering immediate transcription...');
        this.send({ type: 'transcribe' });
    }
    
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
    

    startTranscription(onPartial, onFinal, onError) {
        this.onPartialTranscript = onPartial;
        this.onFinalTranscript = onFinal;
        this.onError = onError;
        this.isTranscribing = true;
        this.audioStartTime = null;
        this.audioChunkBuffer = [];
    }
    

    stopTranscription() {
        this.isTranscribing = false;
        
        
        this.commitAudio();
        
        this.audioStartTime = null;
        this.audioChunkBuffer = [];
    }
    

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

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isTranscribing = false;
        this.audioStartTime = null;
        this.audioChunkBuffer = [];
    }
    

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    isActive() {
        return this.isConnected;
    }
}

export default STTService;
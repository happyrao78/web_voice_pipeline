/**
 * Speech-to-Text Service
 * Handles WebSocket streaming to OpenAI Realtime API via proxy
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
        
        // Session state
        this.sessionId = null;
    }
    
    /**
     * Connect to OpenAI Realtime API via local proxy
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Connect to LOCAL proxy server (not directly to OpenAI)
                const wsUrl = `ws://localhost:8080?model=gpt-4o-mini-realtime-preview-2024-12-17`;

                console.log('Connecting to proxy server:', wsUrl);
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('STT WebSocket connected to proxy');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Send session configuration
                    this.sendSessionUpdate();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                
                this.ws.onerror = (error) => {
                    console.error('STT WebSocket error:', error);
                    if (this.onError) {
                        this.onError(error);
                    }
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
     * Send session configuration
     */
    sendSessionUpdate() {
        const sessionConfig = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: 'You are a voice transcription system. Transcribe speech accurately.',
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                }
            }
        };
        
        this.send(sessionConfig);
    }
    
    /**
     * Handle incoming messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'session.created':
                    this.sessionId = message.session.id;
                    console.log('Session created:', this.sessionId);
                    break;
                    
                case 'input_audio_buffer.speech_started':
                    console.log('Speech started');
                    break;
                    
                case 'input_audio_buffer.speech_stopped':
                    console.log('Speech stopped');
                    break;
                    
                case 'conversation.item.input_audio_transcription.completed':
                    // Partial transcript
                    if (this.onPartialTranscript && message.transcript) {
                        this.onPartialTranscript(message.transcript);
                    }
                    break;
                    
                case 'response.audio_transcript.delta':
                    // Partial transcript chunk
                    if (this.onPartialTranscript && message.delta) {
                        this.onPartialTranscript(message.delta);
                    }
                    break;
                    
                case 'response.audio_transcript.done':
                    // Final transcript
                    if (this.onFinalTranscript && message.transcript) {
                        this.onFinalTranscript(message.transcript);
                    }
                    break;
                    
                case 'response.done':
                    // Response completed
                    if (message.response?.output?.[0]?.content?.[0]?.transcript) {
                        const transcript = message.response.output[0].content[0].transcript;
                        if (this.onFinalTranscript) {
                            this.onFinalTranscript(transcript);
                        }
                    }
                    break;
                    
                case 'error':
                    console.error('STT error:', message.error);
                    if (this.onError) {
                        this.onError(new Error(message.error.message || 'Unknown error'));
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to parse STT message:', error);
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
        
        const message = {
            type: 'input_audio_buffer.append',
            audio: base64Audio
        };
        
        this.send(message);
    }
    
    /**
     * Commit audio buffer (trigger transcription)
     */
    commitAudio() {
        if (!this.isConnected || !this.ws) {
            return;
        }
        
        const message = {
            type: 'input_audio_buffer.commit'
        };
        
        this.send(message);
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
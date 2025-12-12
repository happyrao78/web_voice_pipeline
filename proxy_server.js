const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Read OpenAI API key from .env file
let OPENAI_API_KEY = '';

try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/OPENAI_API_KEY=(.+)/);
        if (match) {
            OPENAI_API_KEY = match[1].trim();
        }
    }
} catch (error) {
    console.error('Error reading .env file:', error);
}

if (!OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not found in .env file');
    console.error('Please create a .env file with: OPENAI_API_KEY=your_key_here');
    process.exit(1);
}

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket Proxy Server Running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs, req) => {
    console.log('Client connected');
    
    // Extract model from query params or use default
    const url = new URL(req.url, `http://${req.headers.host}`);
    const model = url.searchParams.get('model') || 'gpt-4o-mini-realtime-preview';
    
    // Connect to OpenAI Realtime API with proper authentication
    const openaiUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
    
    const openaiWs = new WebSocket(openaiUrl, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
        }
    });
    
    // Forward messages from client to OpenAI
    clientWs.on('message', (data) => {
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(data);
        }
    });
    
    // Forward messages from OpenAI to client
    openaiWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });
    
    // Handle client disconnect
    clientWs.on('close', () => {
        console.log('Client disconnected');
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
    });
    
    // Handle OpenAI disconnect
    openaiWs.on('close', () => {
        console.log('OpenAI connection closed');
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
        }
    });
    
    // Handle errors
    clientWs.on('error', (error) => {
        console.error('Client error:', error.message);
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
    });
    
    openaiWs.on('error', (error) => {
        console.error('OpenAI error:', error.message);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
        }
    });
});

server.listen(PORT, () => {
    console.log(`✓ WebSocket Proxy Server running on ws://localhost:${PORT}`);
    console.log(`✓ OpenAI API Key loaded: ${OPENAI_API_KEY.substring(0, 10)}...`);
    console.log(`Ready to proxy connections to OpenAI Realtime API`);
});
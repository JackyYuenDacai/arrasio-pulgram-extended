/**
 * WebSocket P2P Adapter
 * This creates a fake WebSocket that connects to our P2P system
 * instead of a real server
 */

// Store the original WebSocket constructor
const OriginalWebSocket = WebSocket;

// Create a P2P WebSocket adapter
class P2PWebSocket {    constructor(url) {
        console.log('P2PWebSocket: Intercepting WebSocket connection to:', url);
        
        // Set up event listeners
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        
        // Track connection state
        this.readyState = 0; // 0 = CONNECTING
        
        // Initialize the P2P system if not already done
        if (!window.arrasP2P) {
            console.log('P2PWebSocket: Creating P2P adapter');
            window.arrasP2P = new ArrasP2PAdapter().init();
        }
        
        // Create protocol adapter for processing game messages
        this.protocolAdapter = new ArrasProtocolAdapter();
        
        // Update protocol adapter host status when P2P host changes
        window.arrasP2P.on('onHostChanged', (hostId, isHost) => {
            this.protocolAdapter.setIsHost(isHost);
            
            // If we became host, send welcome and room setup messages
            if (isHost && this.onmessage) {
                // Send welcome message
                const welcome = this.protocolAdapter.createWelcomeMessage();
                if (welcome) {
                    this.onmessage({ data: welcome });
                }
                
                // Send room setup after a short delay
                setTimeout(() => {
                    const roomSetup = this.protocolAdapter.createRoomSetupMessage();
                    if (roomSetup && this.onmessage) {
                        this.onmessage({ data: roomSetup });
                    }
                }, 200);
            }
        });
        
        // Set up P2P message handlers
        window.arrasP2P.on('onGameStateUpdated', (gameState) => {
            if (this.onmessage) {
                // Process the game state update
                const message = {
                    type: 'update',
                    gameState: gameState
                };
                
                // Convert to game's protocol format
                const gameMessage = this.protocolAdapter.processIncomingMessage(message);
                if (gameMessage) {
                    this.onmessage({ data: gameMessage });
                }
            }
        });
        
        // Set up outgoing message interceptor
        this.send = (data) => {
            // Process the outgoing message
            try {
                const p2pMessage = this.protocolAdapter.processOutgoingMessage(data);
                if (p2pMessage) {
                    // If it's a player input message
                    if (p2pMessage.type === 'player_input') {
                        window.arrasP2P.sendPlayerInput(p2pMessage.input);
                    } 
                    // Handle other message types
                    else {
                        // For non-input messages, we need to broadcast to all players
                        const content = {
                            type: 'game_message',
                            gameMessage: p2pMessage
                        };
                        
                        // Use P2P system to send the message
                        if (window.arrasP2P.p2p && window.arrasP2P.p2p.sendGroupMessage) {
                            window.arrasP2P.p2p.sendGroupMessage(content);
                        }
                    }
                }
            } catch (error) {
                console.error('P2PWebSocket: Error processing outgoing message:', error);
            }
        };
        
        // Listen for P2P messages
        window.arrasP2P.p2p.on('onMessageReceived', (message) => {
            if (message && message.type === 'game_message' && this.onmessage) {
                // Process incoming game messages
                const gameMessage = this.protocolAdapter.processIncomingMessage(message.gameMessage);
                if (gameMessage) {
                    this.onmessage({ data: gameMessage });
                }
            }
        });
        
        // Simulate connection after a short delay
        setTimeout(() => {
            this.readyState = 1; // 1 = OPEN
            if (this.onopen) {
                this.onopen({});
            }
        }, 500);
    }
    
    // Close the connection
    close() {
        this.readyState = 3; // 3 = CLOSED
        if (this.onclose) {
            this.onclose({ code: 1000, reason: 'Connection closed by client' });
        }
    }
      // Convert P2P game state to a message expected by the game
    convertStateToMessage(gameState) {
        // Create a converter if we don't have one already
        if (!this.converter) {
            this.converter = new GameStateConverter();
        }
        
        // Convert the P2P game state to the format expected by the game
        const gameUpdate = this.converter.p2pStateToUpdate(gameState);
        
        return JSON.stringify(gameUpdate);
    }
    
    // Parse outgoing messages from the game to P2P input
    parseMessageToInput(data) {
        try {
            // Try to parse the data as JSON first
            const parsed = JSON.parse(data);
            
            // Detect if it's a movement/control message
            if (parsed && parsed.type === 'input') {
                return {
                    movement: parsed.movement || { x: 0, y: 0 },
                    direction: parsed.direction || 0,
                    shooting: parsed.shooting || false,
                    special: parsed.special || false
                };
            }
        } catch (error) {
            // If it's not JSON, it might be binary format
            // For binary data, we'd need a more sophisticated parser
            // This is a simplified example that assumes basic controls
            
            if (typeof data === 'string') {
                // Try to parse simple command strings
                if (data.includes('move')) {
                    // Simple movement command
                    return {
                        movement: { x: 1, y: 0 },
                        direction: 0
                    };
                } else if (data.includes('shoot')) {
                    // Simple shooting command
                    return {
                        shooting: true
                    };
                }
            }
        }
        
        return null;
    }
}

// Function to override the global WebSocket 
function enableP2PWebSocket() {
    console.log('Enabling P2P WebSocket mode');
    
    // Store the original WebSocket for possible restore later
    window._originalWebSocket = window.WebSocket;
    
    // Override the WebSocket constructor
    window.WebSocket = function(url, protocols) {
        return new P2PWebSocket(url, protocols);
    };
}

// Function to restore the original WebSocket
function disableP2PWebSocket() {
    if (window._originalWebSocket) {
        window.WebSocket = window._originalWebSocket;
        window._originalWebSocket = null;
    }
}

// Automatically enable P2P mode when pulgram is ready
document.addEventListener('pulgramready', function() {
    enableP2PWebSocket();
});

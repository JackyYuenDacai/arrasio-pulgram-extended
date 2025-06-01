/**
 * WebSocket P2P Adapter
 * This creates a fake WebSocket that connects to our P2P system
 * instead of a real server
 */

// Store the original WebSocket constructor
const OriginalWebSocket = window.WebSocket;

// Create a P2P WebSocket adapter
class P2PWebSocket {
    constructor(url) {
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
        this.protocolAdapter = new P2PProtocolAdapter();

        // Set up P2P message handlers
        window.arrasP2P.on('onGameStateUpdated', (gameState) => {
            if (this.onmessage) {
                const message = {
                    type: 'update',
                    gameState: gameState
                };
                const gameMessage = this.protocolAdapter.processIncomingMessage(message);
                if (gameMessage) {
                    this.onmessage({ data: gameMessage });
                }
            }
        });

        // Listen for P2P messages
        if (window.arrasP2P && window.arrasP2P.p2p) {
            window.arrasP2P.p2p.on('onMessageReceived', (message) => {
                if (message && message.type === 'game_message' && this.onmessage) {
                    const gameMessage = this.protocolAdapter.processIncomingMessage(message.gameMessage);
                    if (gameMessage) {
                        this.onmessage({ data: gameMessage });
                    }
                }
            });
        }

        // Set up outgoing message interceptor
        this.send = (data) => {
            try {
                const p2pMessage = this.protocolAdapter.processOutgoingMessage(data);
                
                if (p2pMessage && p2pMessage.type === 'key_verification') {
                    console.log('P2PWebSocket: Processing key verification');
                    // Show P2P mode indicator
                    const p2pIndicator = document.getElementById('p2pModeIndicator');
                    if (p2pIndicator) {
                        p2pIndicator.style.display = 'block';
                    }
                    // Initialize connection after key verification
                    this.initializeConnection();
                }
                else if (p2pMessage) {
                    if (p2pMessage.type === 'player_input') {
                        window.arrasP2P.sendPlayerInput(p2pMessage.input);
                    } else {
                        const content = {
                            type: 'game_message',
                            gameMessage: p2pMessage
                        };
                        if (window.arrasP2P.p2p && window.arrasP2P.p2p.sendGroupMessage) {
                            window.arrasP2P.p2p.sendGroupMessage(content);
                        }
                    }
                }
            } catch (error) {
                console.error('P2PWebSocket: Error processing outgoing message:', error);
            }
        };

        // Start connection process
        setTimeout(() => this.initializeConnection(), 100);
    }

    // Initialize the P2P connection
    initializeConnection() {
        if (this.readyState !== 0) return;
        
        this.readyState = 1; // OPEN
        console.log('P2PWebSocket: Connection opened');

        if (this.onopen) {
            this.onopen({ target: this });
        }

        // Send welcome sequence
        if (this.onmessage && window.arrasP2P && window.arrasP2P.p2pGame) {
            if (window.arrasP2P.p2pGame.isHost) {
                console.log('P2PWebSocket: Sending host welcome sequence');
                // Send welcome message
                const welcome = this.protocolAdapter.createWelcomeMessage();
                if (welcome) {
                    this.onmessage({ data: welcome });
                }
                // Send room setup
                setTimeout(() => {
                    const roomSetup = this.protocolAdapter.createRoomSetupMessage();
                    if (roomSetup) {
                        this.onmessage({ data: roomSetup });
                        // Initialize camera
                        setTimeout(() => {
                            const cameraUpdate = this.protocolAdapter.protocol.encode([
                                'c',     // camera command
                                0,       // x position
                                0,       // y position
                                1000     // view range
                            ]);
                            if (cameraUpdate) {
                                this.onmessage({ data: cameraUpdate });
                            }
                        }, 100);
                    }
                }, 100);
            } else {
                console.log('P2PWebSocket: Sending client welcome message');
                const welcome = this.protocolAdapter.createWelcomeMessage(true);
                if (welcome) {
                    this.onmessage({ data: welcome });
                }
            }
        }
    }

    // Close the connection
    close() {
        this.readyState = 3; // CLOSED
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
    
    // Helper to send the welcome sequence
    sendWelcomeSequence() {
        if (!this.onmessage) return;

        // First send welcome message
        const welcome = this.protocolAdapter.createWelcomeMessage();
        if (welcome) {
            this.onmessage({ data: welcome });
            console.log('P2PWebSocket: Welcome message sent');
        }

        // Then send room setup after a short delay
        setTimeout(() => {
            const roomSetup = this.protocolAdapter.createRoomSetupMessage();
            if (roomSetup) {
                this.onmessage({ data: roomSetup });
                console.log('P2PWebSocket: Room setup sent');
            }
        }, 100);
    }
}

// Function to override the global WebSocket 
function enableP2PWebSocket() {
    console.log('Enabling P2P WebSocket mode');
    
    // Always enable if pulgram is available
    if (!window.pulgram) {
        console.log('Pulgram not detected, skipping P2P WebSocket override');
        return;
    }
    
    console.log('Pulgram detected, enabling P2P WebSocket override');
    
    // Store the original WebSocket for possible restore later
    window._originalWebSocket = window.WebSocket;
    
    // Override the WebSocket constructor
    window.WebSocket = function(url, protocols) {
        console.log('Creating P2P WebSocket for URL:', url);
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

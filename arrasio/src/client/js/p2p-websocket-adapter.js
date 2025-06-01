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
        
        // Track if we've processed the initial handshake
        this._welcomeMessageSent = false;
        this._roomSetupMessageSent = false;
          // Initialize the P2P system if not already done
        if (!window.arrasP2P) {
            console.log('P2PWebSocket: Creating P2P adapter');
            window.arrasP2P = new ArrasP2PAdapter().init();
        }
        
        // Create protocol adapter for processing game messages
        this.protocolAdapter = new ArrasProtocolAdapter();
        
        // Set the connection callback on the P2P game system
        if (window.arrasP2P.p2pGame) {
            window.arrasP2P.p2pGame.onGameConnected = () => {
                console.log('P2P game system says we are connected!');
                this.setOpen();
                
                // If we're host, also send welcome message and room setup
                if (window.arrasP2P.p2pGame.isHost && this.onmessage) {
                    // Send welcome message
                    const welcome = this.protocolAdapter.createWelcomeMessage();
                    if (welcome) {
                        this.onmessage({ data: welcome });
                    }
                    
                    // Send room setup after a short delay
                    setTimeout(() => {
                        const roomSetup = this.protocolAdapter.createRoomSetupMessage();
                        if (roomSetup) {
                            this.onmessage({ data: roomSetup });
                        }
                    }, 500);
                }
            };
        }
        
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
                
                // Handle special cases that need immediate responses
                if (p2pMessage && p2pMessage.type === 'key_verification') {
                    console.log('P2PWebSocket: Processing key verification');
                    
                    // Show P2P mode indicator in the UI
                    const p2pIndicator = document.getElementById('p2pModeIndicator');
                    if (p2pIndicator) {
                        p2pIndicator.style.display = 'block';
                    }
                    
                    // Always handle welcome sequence proactively - crucial for "Connecting..." issue
                    console.log('P2PWebSocket: Key verification received. Starting welcome sequence...');
                    
                    // Force sending welcome message immediately
                    if (this.onmessage) {
                        // First, send a welcome message
                        const welcome = this.protocolAdapter.createWelcomeMessage();
                        if (welcome) {
                            this.onmessage({ data: welcome });
                            console.log('P2PWebSocket: Sent welcome message immediately after key verification');
                            this._welcomeMessageSent = true;
                        }
                        
                        // After a short delay, send the room setup
                        setTimeout(() => {
                            const roomSetup = this.protocolAdapter.createRoomSetupMessage();
                            if (roomSetup) {
                                this.onmessage({ data: roomSetup });
                                console.log('P2P WebSocket: Sent room setup message');
                                this._roomSetupMessageSent = true;
                                
                                // After room setup, send a camera update to initialize view
                                setTimeout(() => {
                                    // Send camera update
                                    const cameraUpdate = this.protocolAdapter.protocol.encode([
                                        'c',     // camera command
                                        0,       // x position
                                        0,       // y position
                                        1000     // view range
                                    ]);
                                    
                                    if (cameraUpdate) {
                                        this.onmessage({ data: cameraUpdate });
                                        console.log('P2P WebSocket: Sent camera update to initialize view');
                                    }
                                }, 100);
                            }
                        }, 100);
                    }
                }
                // Handle other message types
                else if (p2pMessage) {
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
        if (window.arrasP2P && window.arrasP2P.p2p) {
            window.arrasP2P.p2p.on('onMessageReceived', (message) => {
                if (message && message.type === 'game_message' && this.onmessage) {
                    // Process incoming game messages
                    const gameMessage = this.protocolAdapter.processIncomingMessage(message.gameMessage);
                    if (gameMessage) {
                        this.onmessage({ data: gameMessage });
                    }
                }
            });
        }
          // Create a method to set the connection to open
        this.setOpen = () => {
            // Only do this once
            if (this.readyState !== 0) return;
            
            // Set ready state
            this.readyState = 1; // 1 = OPEN
            console.log('P2PWebSocket: Connection opened');
            
            // Call onopen
            if (this.onopen) {
                this.onopen({ target: this });
                console.log('P2PWebSocket: onopen event fired');
            }
            
            // Send immediate welcome message - crucial for getting past the "Connecting..." state
            if (this.onmessage && window.arrasP2P && window.arrasP2P.p2pGame && window.arrasP2P.p2pGame.isHost) {
                console.log('P2PWebSocket: Sending welcome message as host');
                setTimeout(() => {
                    // Send welcome message
                    const welcome = this.protocolAdapter.createWelcomeMessage();
                    if (welcome) {
                        this.onmessage({ data: welcome });
                        console.log('P2PWebSocket: Welcome message sent');
                    }
                    
                    // Then room setup
                    setTimeout(() => {
                        const roomSetup = this.protocolAdapter.createRoomSetupMessage();
                        if (roomSetup) {
                            this.onmessage({ data: roomSetup });
                            console.log('P2PWebSocket: Room setup message sent');
                        }
                    }, 200);
                }, 200);
            }
        };
        
        // Simulate connection immediately - we don't need to wait too long
        setTimeout(() => {
            this.setOpen();
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

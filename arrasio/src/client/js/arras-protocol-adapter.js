/**
 * Protocol Adapter for Arras.io P2P Integration
 * This adapter helps convert between the game's binary protocol and our P2P system
 */

class ArrasProtocolAdapter {    constructor() {
        // Get the fasttalk protocol module from the global scope instead of using require
        this.protocol = window.fastTalk || window.protocol;
        
        // If protocol not found in global scope, log error
        if (!this.protocol) {
            console.error('Protocol module not found in global scope. Make sure fasttalk.js is loaded before this script.');
            
            // Try to load it one more time from the window object
            try {
                if (window.protocol) {
                    this.protocol = window.protocol;
                    console.log('Successfully loaded protocol from window.protocol');
                }
            } catch (e) {
                console.error('Failed to load protocol from window.protocol:', e);
            }
        }
        
        // Game state
        this.gameState = {
            players: {},
            entities: {},
            gameWidth: 8000,
            gameHeight: 8000,
            roomSpeed: 1,
            serverTime: Date.now()
        };
        
        // Track local player data
        this.localPlayer = {
            id: window.pulgram ? window.pulgram.getUserId() : 'player-' + Math.random().toString(36).substr(2, 9),
            name: '',
            tank: 'basic',
            x: 0,
            y: 0,
            view: 1000,
            health: 1,
            score: 0
        };
        
        // Message handlers for different message types
        this.handlers = {
            // Game state updates from P2P
            'update': this.handleUpdate.bind(this),
            // Player join events
            'player_join': this.handlePlayerJoin.bind(this),
            // Player leave events
            'player_leave': this.handlePlayerLeave.bind(this)
        };
        
        // Track all players in the game
        this.players = new Map();
        
        // Setup host-specific logic
        this.isHost = false;
        this.entityIdCounter = 1;
    }
      /**
     * Process an incoming message from the P2P system
     * @param {Object} message - Message from P2P system
     * @returns {String} Binary message in game's protocol format
     */
    processIncomingMessage(message) {
        try {
            // Parse the message if it's a string
            let data = message;
            if (typeof message === 'string') {
                data = JSON.parse(message);
            }
            
            // Debug log
            console.log('P2P Protocol: Processing incoming message', data);
            
            // Process based on message type
            if (data.type && this.handlers[data.type]) {
                const result = this.handlers[data.type](data);
                console.log('P2P Protocol: Processed message result', result);
                return result;
            } else {
                console.log('Unknown message type:', data.type);
                return null;
            }
        } catch (error) {
            console.error('Error processing message:', error);
            return null;
        }
    }
    
    /**
     * Handle game state update from P2P
     */
    handleUpdate(data) {
        // Update our game state
        this.gameState = data.gameState;
        
        // Generate a game update message in the format the client expects
        return this.createUpdateMessage();
    }
    
    /**
     * Handle player join event
     */
    handlePlayerJoin(data) {
        // Add player to our list
        this.players.set(data.playerId, {
            id: data.playerId,
            name: data.playerName || 'Player ' + data.playerId.substring(0, 4),
            tank: 'basic',
            x: 0, 
            y: 0,
            score: 0
        });
        
        // Return welcome message if we're the host
        if (this.isHost) {
            return this.createWelcomeMessage();
        }
        
        return null;
    }
    
    /**
     * Handle player leave event
     */
    handlePlayerLeave(data) {
        // Remove player from our list
        this.players.delete(data.playerId);
        
        return null;
    }
      /**
     * Process an outgoing message from the game
     * @param {ArrayBuffer} data - Binary message from game
     * @returns {Object} P2P message object
     */
    processOutgoingMessage(data) {
        try {
            // Decode the message using the game's protocol
            const message = this.protocol.decode(data);
            
            console.log('P2P Protocol: Processing outgoing message', message);
            
            // Process based on message type
            switch (message[0]) {
                case 'k': // Key verification (first message sent when socket opens)
                    return this.handleKeyVerification(message);
                case 's': // Spawn request
                    return this.handleSpawnRequest(message);
                case 'S': // Clock sync
                    return this.handleClockSync(message);
                case 'd': // Update request
                    return this.handleUpdateRequest(message);
                case 'C': // Command/input
                    return this.handleCommand(message);
                case 'p': // Ping
                    return this.handlePing(message);
                default:
                    console.log('Unknown outgoing message type:', message[0]);
                    return null;
            }
        } catch (error) {
            console.error('Error processing outgoing message:', error);
            return null;
        }
    }
    
    /**
     * Handle key verification message - this is the first message sent when connecting
     * It's critical for the game startup sequence
     */
    handleKeyVerification(message) {
        // Player key is in message[1]
        const playerKey = message[1];
        console.log('P2P: Received key verification request');
        
        // In P2P mode, we'll just accept any key
        // This triggers the welcome message to be sent automatically
        
        return {
            type: 'key_verification',
            playerKey: playerKey,
            success: true
        };
    }
      /**
     * Handle spawn request
     */
    handleSpawnRequest(message) {
        // Player name is in message[1]
        const playerName = message[1];
        
        // Update local player name
        this.localPlayer.name = playerName;
        
        // Send camera position update message to initialize player view
        // This is needed for the game to properly start rendering
        setTimeout(() => {
            if (window.arrasP2P && this.isHost) {
                // Create camera update message
                const cameraUpdate = this.protocol.encode([
                    'c',                   // camera command
                    0,                     // x position
                    0,                     // y position
                    1000                   // view range
                ]);
                
                // If we have a way to inject messages into the game
                if (window.arrasP2P.p2p && window.arrasP2P.p2p.socket && 
                    window.arrasP2P.p2p.socket.onmessage) {
                    window.arrasP2P.p2p.socket.onmessage({ data: cameraUpdate });
                    console.log('P2P: Sent camera update message');
                }
            }
        }, 500);
        
        // Send join message to P2P
        return {
            type: 'player_join',
            playerId: this.localPlayer.id,
            playerName: playerName
        };
    }
      /**
     * Handle clock sync request
     */
    handleClockSync(message) {
        // Client time is in message[1]
        const clientTime = message[1];
        
        // Create a simulated clock sync response
        // This is critical for the game to complete initialization
        const serverTime = Date.now();
        
        console.log('P2P: Handling clock sync request', clientTime);
        
        // Immediately send a clock sync response
        this.sendClockSyncResponse(clientTime, 0);
        
        // Send multiple clock sync responses with slight variations
        // to simulate a realistic network and help the game's sync algorithm
        for (let i = 1; i < 10; i++) {
            setTimeout(() => {
                this.sendClockSyncResponse(clientTime, i);
            }, i * 50);
        }
        
        // Return clock sync response that simulates low latency
        return {
            type: 'clock_sync',
            clientTime: clientTime,
            serverTime: serverTime
        };
    }
    
    /**
     * Send a clock sync response message
     */
    sendClockSyncResponse(clientTime, index) {
        // Generate the response with a slight latency variation
        const latencyVariation = Math.random() * 5;
        const syncResponse = this.protocol.encode([
            'S',
            clientTime,
            Date.now() + latencyVariation
        ]);
        
        // If we have a way to inject messages into the game
        if (window.arrasP2P && window.arrasP2P.p2p && window.arrasP2P.p2p.socket && 
            window.arrasP2P.p2p.socket.onmessage) {
            window.arrasP2P.p2p.socket.onmessage({ data: syncResponse });
            console.log('P2P: Sent clock sync response', index);
        }
    }
    
    /**
     * Handle update request
     */
    handleUpdateRequest(message) {
        // Request for update since time in message[1]
        return {
            type: 'update_request',
            lastUpdate: message[1]
        };
    }
    
    /**
     * Handle command/input from player
     */
    handleCommand(message) {
        // Parse input data from message
        // Format depends on the specific command
        
        // Basic movement example:
        // const direction = message[1];
        // const movement = { x: Math.cos(direction), y: Math.sin(direction) };
        
        return {
            type: 'player_input',
            playerId: this.localPlayer.id,
            input: {
                movement: { x: 0, y: 0 }, // Would be extracted from message
                direction: 0,            // Would be extracted from message
                shooting: false,         // Would be extracted from message
                special: false           // Would be extracted from message
            }
        };
    }
    
    /**
     * Handle ping message
     */
    handlePing(message) {
        return {
            type: 'ping',
            payload: message[1]
        };
    }
      /**
     * Create a welcome message in the game's protocol format
     */
    createWelcomeMessage() {
        console.log('Creating welcome message using protocol');
        
        try {
            if (!this.protocol || typeof this.protocol.encode !== 'function') {
                console.error('Protocol not available for welcome message');
                return null;
            }
            
            // The welcome message is crucial - it tells the client it's connected
            // Format: ['w', <accepted>]
            const welcomeMsg = this.protocol.encode(['w', true]);
            console.log('Welcome message created:', welcomeMsg);
            return welcomeMsg;
        } catch (error) {
            console.error('Error creating welcome message:', error);
            return null;
        }
    }
      /**
     * Create a room setup message
     */
    createRoomSetupMessage() {
        console.log('Creating room setup message using protocol');
        
        try {
            if (!this.protocol || typeof this.protocol.encode !== 'function') {
                console.error('Protocol not available for room setup message');
                return null;
            }
            
            const roomSetup = {
                mode: 'ffa',
                width: this.gameState.gameWidth,
                height: this.gameState.gameHeight
            };
            
            const serverStart = {
                time: Date.now(),
                version: 1
            };
            
            // Room setup message is also crucial - it tells the client how to set up the game world
            // Format: ['R', <width>, <height>, <room-setup-json>, <server-start-json>, <room-speed>]
            const roomMsg = this.protocol.encode([
                'R',
                this.gameState.gameWidth,
                this.gameState.gameHeight,
                JSON.stringify(roomSetup),
                JSON.stringify(serverStart),
                this.gameState.roomSpeed
            ]);
            
            console.log('Room setup message created:', roomMsg);
            return roomMsg;
        } catch (error) {
            console.error('Error creating room setup message:', error);
            return null;
        }
    }/**
     * Create an update message in the game's protocol format
     */
    createUpdateMessage() {
        // Get the game state
        const gameState = this.gameState;
        
        // Create entities array for the update
        const entities = [];
        
        console.log('P2P: Creating update message from game state', gameState);
        
        // Add players to entities list
        for (let playerId in gameState.players) {
            const player = gameState.players[playerId];
            
            // Make sure we have position data
            if (!player.position) {
                player.position = { x: 0, y: 0 };
            }
            
            // Generate a numeric ID (needed by game)
            const numericId = parseInt(playerId.replace(/\D/g, '')) || 
                              playerId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            
            entities.push({
                id: numericId,
                index: 0, // Tank type index
                x: player.position.x,
                y: player.position.y, 
                vx: 0, // Velocity X
                vy: 0, // Velocity Y
                size: 30, // Default tank size
                facing: player.direction || 0,
                vfacing: player.direction || 0,
                twiggle: 0,
                layer: 0,
                color: 0, // Team color
                health: player.health || 1,
                shield: 0,
                alpha: 1,
                name: player.name || `Player ${playerId.substring(0, 4)}`,
                score: player.score || 0,
                nameColor: "#FFFFFF"
            });
        }
        
        // Add other game entities
        for (let entityId in gameState.entities) {
            const entity = gameState.entities[entityId];
            
            // Make sure we have position data
            if (!entity.position) {
                entity.position = { x: 0, y: 0 };
            }
            
            // Generate a numeric ID (needed by game)
            const numericId = parseInt(entityId.replace(/\D/g, '')) || 
                              entityId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                              
            entities.push({
                id: numericId,
                index: entity.type === 'food' ? 6 : 1, // Different index for different types
                x: entity.position.x,
                y: entity.position.y,
                vx: 0,
                vy: 0,
                size: entity.size || 10,
                facing: entity.direction || 0,
                vfacing: entity.direction || 0,
                twiggle: 0,
                layer: 0,
                color: entity.type === 'food' ? 2 : 1, // Different colors
                health: entity.health || 1,
                shield: 0,
                alpha: 1
            });
        }
        
        console.log('P2P: Update message contains', entities.length, 'entities');
        
        // Create the update message with the encoded entities
        return this.protocol.encode(['u', Date.now(), entities]);
    }
    
    /**
     * Set host status
     */
    setIsHost(isHost) {
        this.isHost = isHost;
    }
}

// Export for use in other modules
window.ArrasProtocolAdapter = ArrasProtocolAdapter;

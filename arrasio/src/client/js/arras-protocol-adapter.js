/**
 * Protocol Adapter for Arras.io P2P Integration
 * This adapter helps convert between the game's binary protocol and our P2P system
 */

class ArrasProtocolAdapter {
    constructor() {
        // Load the fasttalk protocol module
        this.protocol = require('./lib/fasttalk');
        
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
            
            // Process based on message type
            if (data.type && this.handlers[data.type]) {
                return this.handlers[data.type](data);
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
            
            // Process based on message type
            switch (message[0]) {
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
     * Handle spawn request
     */
    handleSpawnRequest(message) {
        // Player name is in message[1]
        const playerName = message[1];
        
        // Update local player name
        this.localPlayer.name = playerName;
        
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
        
        // Return clock sync response that simulates low latency
        return {
            type: 'clock_sync',
            clientTime: clientTime,
            serverTime: Date.now()
        };
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
        return this.protocol.encode(['w', true]);
    }
    
    /**
     * Create a room setup message
     */
    createRoomSetupMessage() {
        const roomSetup = {
            mode: 'ffa',
            width: this.gameState.gameWidth,
            height: this.gameState.gameHeight
        };
        
        const serverStart = {
            time: Date.now(),
            version: 1
        };
        
        return this.protocol.encode([
            'R',
            this.gameState.gameWidth,
            this.gameState.gameHeight,
            JSON.stringify(roomSetup),
            JSON.stringify(serverStart),
            this.gameState.roomSpeed
        ]);
    }
      /**
     * Create an update message in the game's protocol format
     */
    createUpdateMessage() {
        // Get the game state
        const gameState = this.gameState;
        
        // Create entities array for the update
        const entities = [];
        
        // Add players to entities list
        for (let playerId in gameState.players) {
            const player = gameState.players[playerId];
            entities.push({
                id: parseInt(playerId) || Math.floor(Math.random() * 1000000),
                index: 0, // Tank type index
                x: player.position.x,
                y: player.position.y, 
                vx: 0, // Velocity X
                vy: 0, // Velocity Y
                size: 30, // Default tank size
                facing: player.direction,
                vfacing: player.direction,
                twiggle: 0,
                layer: 0,
                color: 0, // Team color
                health: player.health,
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
            entities.push({
                id: parseInt(entityId) || Math.floor(Math.random() * 1000000),
                index: 1, // Shape type index
                x: entity.position.x,
                y: entity.position.y,
                vx: 0,
                vy: 0,
                size: entity.size || 10,
                facing: entity.direction || 0,
                vfacing: entity.direction || 0,
                twiggle: 0,
                layer: 0,
                color: 1, // Default shape color
                health: entity.health || 1,
                shield: 0,
                alpha: 1
            });
        }
        
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

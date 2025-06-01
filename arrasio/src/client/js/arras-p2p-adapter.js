/**
 * Arras.io Game Adapter for Pulgram P2P
 * 
 * This adapter connects the Arras.io game logic with the P2P system
 * enabling multiplayer without a dedicated server.
 */

class ArrasP2PAdapter {
    constructor(config = {}) {
        // Create the P2P system
        this.p2p = new GameP2P();
        
        // Game state
        this.gameState = {
            players: {},
            entities: {},
            updates: []
        };
        
        // Player data
        this.localPlayer = {
            id: window.pulgram.getUserId(),
            tank: config.defaultTank || 'basic',
            position: { x: 0, y: 0 },
            direction: 0,
            health: 1,
            score: 0
        };
        
        // Register P2P callbacks
        this.p2p.on('onHostChanged', this.handleHostChanged.bind(this));
        this.p2p.on('onPlayerJoined', this.handlePlayerJoined.bind(this));
        this.p2p.on('onPlayerLeft', this.handlePlayerLeft.bind(this));
        this.p2p.on('onGameStateUpdated', this.handleGameStateUpdated.bind(this));
        this.p2p.on('onPlayerInput', this.handlePlayerInput.bind(this));
        
        // Game loop variables
        this.lastFrameTime = 0;
        this.gameLoopId = null;
        
        // Event callbacks
        this.callbacks = {
            onGameStateUpdated: null,
            onGameStarted: null,
            onGameEnded: null,
            onHostChanged: null
        };
        
        // Ping measurement
        this._pingStart = 0;
        this._lastPing = 0;
        this._pingInterval = setInterval(() => this.measurePing(), 5000);
    }
    
    /**
     * Initialize the game
     */
    init() {
        console.log('Initializing Arras.io P2P Adapter');
        
        // Start the game loop
        this.startGameLoop();
        
        return this;
    }
    
    /**
     * Start the game loop
     */
    startGameLoop() {
        const gameLoop = (timestamp) => {
            // Calculate delta time
            const deltaTime = this.lastFrameTime ? (timestamp - this.lastFrameTime) / 1000 : 0.016;
            this.lastFrameTime = timestamp;
            
            // Update game if we're the host
            if (this.p2p.isHost) {
                this.updateAsHost(deltaTime);
            }
            
            // Animation frame loop
            this.gameLoopId = requestAnimationFrame(gameLoop);
        };
        
        // Start the loop
        this.gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    /**
     * Update the game as the host
     */
    updateAsHost(deltaTime) {
        // Physics and game updates would go here
        // This is highly game-specific and would be integrated with your game's logic
        
        // Simple example: increment a counter in the game state
        if (!this.gameState.counter) this.gameState.counter = 0;
        this.gameState.counter += deltaTime;
        
        // Update player positions based on their inputs
        for (let playerId in this.gameState.players) {
            const player = this.gameState.players[playerId];
            if (player.input) {
                // Apply movement
                if (player.input.movement) {
                    player.position.x += player.input.movement.x * deltaTime * 100;
                    player.position.y += player.input.movement.y * deltaTime * 100;
                }
                
                // Apply rotation
                if (typeof player.input.direction === 'number') {
                    player.direction = player.input.direction;
                }
                
                // Reset one-time inputs
                player.input.shooting = false;
                player.input.special = false;
            }
        }
        
        // Broadcast updates at a reasonable rate (not every frame)
        if (!this._lastBroadcastTime || Date.now() - this._lastBroadcastTime > 50) {
            this.broadcastGameState();
            this._lastBroadcastTime = Date.now();
        }
    }
    
    /**
     * Broadcast the current game state to all players
     */
    broadcastGameState() {
        // Only the host should broadcast game state
        if (!this.p2p.isHost) return;
        
        // Send the full state
        this.p2p.updateGameState(this.gameState);
    }
    
    /**
     * Process player input and send to host
     */
    sendPlayerInput(inputData) {
        // Store locally
        this.localInput = inputData;
        
        // Send to host
        this.p2p.sendPlayerInput(inputData);
    }
      /**
     * Handle host changes
     */
    handleHostChanged(hostId, isHost) {
        console.log(`Host changed to ${hostId}. Am I host? ${isHost}`);
        
        if (isHost) {
            // We became the host, initialize game state
            this.initializeGameStateAsHost();
        }
        
        // Notify any callbacks
        if (typeof this.callbacks.onHostChanged === 'function') {
            this.callbacks.onHostChanged(hostId, isHost);
        }
    }
    
    /**
     * Initialize game state when becoming host
     */
    initializeGameStateAsHost() {
        // Reset game state
        this.gameState = {
            players: {},
            entities: {},
            gameTime: 0,
            lastUpdate: Date.now()
        };
        
        // Add all known players
        for (let [playerId, player] of this.p2p.players) {
            this.gameState.players[playerId] = {
                id: playerId,
                position: { x: Math.random() * 1000 - 500, y: Math.random() * 1000 - 500 },
                direction: 0,
                health: 1,
                score: 0,
                tank: 'basic'
            };
        }
        
        // Add ourselves if not already in the list
        const myId = window.pulgram.getUserId();
        if (!this.gameState.players[myId]) {
            this.gameState.players[myId] = {
                id: myId,
                position: { x: 0, y: 0 },
                direction: 0,
                health: 1,
                score: 0,
                tank: 'basic'
            };
        }
        
        // Broadcast initial state
        this.broadcastGameState();
    }
    
    /**
     * Handle player join
     */
    handlePlayerJoined(playerId) {
        console.log(`Player joined: ${playerId}`);
        
        // If we're host, add player to game state
        if (this.p2p.isHost && !this.gameState.players[playerId]) {
            this.gameState.players[playerId] = {
                id: playerId,
                position: { x: Math.random() * 1000 - 500, y: Math.random() * 1000 - 500 },
                direction: 0,
                health: 1,
                score: 0,
                tank: 'basic',
                input: {}
            };
            
            // Broadcast updated game state
            this.broadcastGameState();
        }
    }
    
    /**
     * Handle player leave
     */
    handlePlayerLeft(playerId) {
        console.log(`Player left: ${playerId}`);
        
        // If we're host, remove player from game state
        if (this.p2p.isHost && this.gameState.players[playerId]) {
            delete this.gameState.players[playerId];
            
            // Broadcast updated game state
            this.broadcastGameState();
        }
    }
    
    /**
     * Handle player input (host only)
     */
    handlePlayerInput(playerId, inputData) {
        // Only the host should process player input
        if (!this.p2p.isHost) return;
        
        // Store input for processing in the next update
        if (this.gameState.players[playerId]) {
            this.gameState.players[playerId].input = inputData;
        }
    }
    
    /**
     * Handle game state updates (clients only)
     */
    handleGameStateUpdated(gameState) {
        this.gameState = gameState;
        
        // Call any game update callbacks
        if (typeof this.callbacks.onGameStateUpdated === 'function') {
            this.callbacks.onGameStateUpdated(this.gameState);
        }
    }
    
    /**
     * Register event callbacks
     */
    on(event, callback) {
        if (typeof this.callbacks[event] !== 'undefined') {
            this.callbacks[event] = callback;
        }
        return this;
    }
      /**
     * Measure ping to host
     */
    measurePing() {
        // Only measure ping if we're not the host and have a host
        if (this.p2p.isHost || !this.p2p.hostId) return;
        
        // Create ping message
        const pingMessage = this.p2p.createGameMessage(
            'PING', 
            { timestamp: Date.now() }
        );
        
        // Record start time
        this._pingStart = Date.now();
        
        // Send to host
        this.p2p.sendDirectMessage(pingMessage, this.p2p.hostId);
        
        // Listen for response (one-time handler)
        const pingHandler = (message) => {
            if (message.subType === 'PONG') {
                // Calculate ping
                this._lastPing = Date.now() - this._pingStart;
                
                // Remove listener
                this.p2p.off('onMessageReceived', pingHandler);
            }
        };
        
        // Add listener
        this.p2p.on('onMessageReceived', pingHandler);
        
        // Timeout after 2 seconds
        setTimeout(() => {
            this.p2p.off('onMessageReceived', pingHandler);
        }, 2000);
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        if (this.gameLoopId) {
            cancelAnimationFrame(this.gameLoopId);
        }
        
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
        }
        
        if (this.p2p) {
            this.p2p.dispose();
        }
    }
}

// Export for use in other modules
window.ArrasP2PAdapter = ArrasP2PAdapter;

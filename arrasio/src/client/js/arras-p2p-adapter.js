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
        // Update game time
        this.gameState.gameTime += deltaTime;
        
        // Update player positions based on their inputs
        for (let playerId in this.gameState.players) {
            const player = this.gameState.players[playerId];
            if (player.input) {
                // Apply movement
                if (player.input.movement) {
                    // Calculate player speed (tanks move at constant speed)
                    const speed = 300; // pixels per second
                    
                    // Normalize diagonal movement
                    let dx = player.input.movement.x;
                    let dy = player.input.movement.y;
                    if (dx !== 0 && dy !== 0) {
                        const mag = Math.sqrt(dx * dx + dy * dy);
                        dx = dx / mag;
                        dy = dy / mag;
                    }
                    
                    // Apply movement
                    player.position.x += dx * deltaTime * speed;
                    player.position.y += dy * deltaTime * speed;
                    
                    // Keep players inside the game boundary
                    const margin = 50;
                    const halfWidth = this.gameState.gameWidth / 2;
                    const halfHeight = this.gameState.gameHeight / 2;
                    
                    player.position.x = Math.max(-halfWidth + margin, 
                                      Math.min(halfWidth - margin, player.position.x));
                    player.position.y = Math.max(-halfHeight + margin, 
                                      Math.min(halfHeight - margin, player.position.y));
                }
                
                // Apply rotation
                if (typeof player.input.direction === 'number') {
                    player.direction = player.input.direction;
                }
                
                // Player shooting - spawn bullets
                if (player.input.shooting && !player.lastShot || 
                   (player.lastShot && Date.now() - player.lastShot > 500)) {
                    this.spawnBullet(playerId);
                    player.lastShot = Date.now();
                }
                
                // Automatic score increase over time for active players
                if (!player.lastScoreTime || Date.now() - player.lastScoreTime > 5000) {
                    player.score = (player.score || 0) + 10;
                    player.lastScoreTime = Date.now();
                }
                
                // Reset one-time inputs
                player.input.shooting = false;
                player.input.special = false;
            }
        }
        
        // Update bullets and other moving entities
        this.updateEntities(deltaTime);
        
        // Check for collisions
        this.checkCollisions();
        
        // Respawn food if needed
        this.respawnEntities();
        
        // Broadcast updates at a reasonable rate (not every frame)
        if (!this._lastBroadcastTime || Date.now() - this._lastBroadcastTime > 50) {
            this.broadcastGameState();
            this._lastBroadcastTime = Date.now();
        }
    }
    
    /**
     * Spawn a bullet from a player
     */
    spawnBullet(playerId) {
        const player = this.gameState.players[playerId];
        if (!player) return;
        
        // Create unique bullet ID
        const bulletId = `bullet-${playerId}-${Date.now()}`;
        
        // Create bullet entity
        this.gameState.entities[bulletId] = {
            id: bulletId,
            type: 'bullet',
            ownerId: playerId,
            position: {
                x: player.position.x + Math.cos(player.direction) * 40, 
                y: player.position.y + Math.sin(player.direction) * 40
            },
            velocity: {
                x: Math.cos(player.direction) * 500,
                y: Math.sin(player.direction) * 500
            },
            direction: player.direction,
            size: 10,
            damage: 0.2,
            health: 1,
            createdAt: Date.now()
        };
    }
    
    /**
     * Update all moving entities (bullets, etc.)
     */
    updateEntities(deltaTime) {
        const now = Date.now();
        const entitiesToRemove = [];
        
        // Update each entity
        for (let entityId in this.gameState.entities) {
            const entity = this.gameState.entities[entityId];
            
            // Only process entities with velocity
            if (entity.velocity) {
                // Move the entity
                entity.position.x += entity.velocity.x * deltaTime;
                entity.position.y += entity.velocity.y * deltaTime;
                
                // Check if bullet is out of bounds
                if (entity.type === 'bullet') {
                    // Remove bullets that are too old (5 seconds max lifetime)
                    if (now - entity.createdAt > 5000) {
                        entitiesToRemove.push(entityId);
                        continue;
                    }
                    
                    // Remove bullets that are outside the map
                    const halfWidth = this.gameState.gameWidth / 2;
                    const halfHeight = this.gameState.gameHeight / 2;
                    if (entity.position.x < -halfWidth || entity.position.x > halfWidth ||
                        entity.position.y < -halfHeight || entity.position.y > halfHeight) {
                        entitiesToRemove.push(entityId);
                    }
                }
            }
        }
        
        // Remove entities marked for deletion
        for (let id of entitiesToRemove) {
            delete this.gameState.entities[id];
        }
    }
    
    /**
     * Check for collisions between entities
     */
    checkCollisions() {
        // Check bullet collisions
        for (let entityId in this.gameState.entities) {
            const entity = this.gameState.entities[entityId];
            
            // Only process bullets
            if (entity.type === 'bullet') {
                // Check for collision with obstacles
                for (let obstacleId in this.gameState.entities) {
                    const obstacle = this.gameState.entities[obstacleId];
                    if (obstacle.type === 'obstacle' || obstacle.type === 'food') {
                        if (this.checkCircleCollision(entity, obstacle)) {
                            // Food gets destroyed, obstacles don't
                            if (obstacle.type === 'food') {
                                delete this.gameState.entities[obstacleId];
                                
                                // Give points to player who shot it
                                const player = this.gameState.players[entity.ownerId];
                                if (player) {
                                    player.score = (player.score || 0) + 5;
                                }
                            }
                            
                            // Remove the bullet
                            delete this.gameState.entities[entityId];
                            break;
                        }
                    }
                }
                
                // Check for collision with players
                for (let playerId in this.gameState.players) {
                    // Don't hit the player who fired it
                    if (playerId === entity.ownerId) continue;
                    
                    const player = this.gameState.players[playerId];
                    if (this.checkCircleCollision(entity, {
                        position: player.position,
                        size: 30 // Player radius
                    })) {
                        // Damage player
                        player.health = Math.max(0, player.health - entity.damage);
                        
                        // Check if player is defeated
                        if (player.health <= 0) {
                            // Award points to killer
                            const shooter = this.gameState.players[entity.ownerId];
                            if (shooter) {
                                shooter.score = (shooter.score || 0) + 100;
                            }
                            
                            // Respawn player
                            player.health = 1;
                            player.position = {
                                x: Math.random() * 4000 - 2000,
                                y: Math.random() * 4000 - 2000
                            };
                        }
                        
                        // Remove the bullet
                        delete this.gameState.entities[entityId];
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * Check if two circular entities collide
     */
    checkCircleCollision(entity1, entity2) {
        const dx = entity1.position.x - entity2.position.x;
        const dy = entity1.position.y - entity2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (entity1.size + entity2.size);
    }
    
    /**
     * Respawn food entities if there aren't enough
     */
    respawnEntities() {
        // Count food entities
        let foodCount = 0;
        for (let entityId in this.gameState.entities) {
            if (this.gameState.entities[entityId].type === 'food') {
                foodCount++;
            }
        }
        
        // Respawn food if needed
        const desiredFoodCount = 100;
        if (foodCount < desiredFoodCount) {
            const foodToAdd = Math.min(5, desiredFoodCount - foodCount);
            
            for (let i = 0; i < foodToAdd; i++) {
                const id = 'food-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                this.gameState.entities[id] = {
                    id: id,
                    type: 'food',
                    position: {
                        x: Math.random() * 6000 - 3000,
                        y: Math.random() * 6000 - 3000
                    },
                    direction: Math.random() * Math.PI * 2,
                    size: 10 + Math.random() * 5,
                    health: 1
                };
            }
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
            gameWidth: 8000,
            gameHeight: 8000,
            lastUpdate: Date.now()
        };
        
        // Add all known players
        for (let [playerId, player] of this.p2p.players) {
            this.gameState.players[playerId] = {
                id: playerId,
                position: { x: Math.random() * 4000 - 2000, y: Math.random() * 4000 - 2000 },
                direction: 0,
                health: 1,
                score: 0,
                tank: 'basic',
                name: player.name || `Player ${playerId.substring(0, 4)}`
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
                tank: 'basic',
                name: 'You'
            };
        }
        
        // Add some food entities to the game world
        for (let i = 0; i < 100; i++) {
            const id = 'food-' + i;
            this.gameState.entities[id] = {
                id: id,
                type: 'food',
                position: {
                    x: Math.random() * 6000 - 3000,
                    y: Math.random() * 6000 - 3000
                },
                direction: Math.random() * Math.PI * 2,
                size: 10 + Math.random() * 5,
                health: 1
            };
        }
        
        // Add some obstacles
        for (let i = 0; i < 30; i++) {
            const id = 'obstacle-' + i;
            this.gameState.entities[id] = {
                id: id,
                type: 'obstacle',
                position: {
                    x: Math.random() * 7000 - 3500,
                    y: Math.random() * 7000 - 3500
                },
                direction: 0,
                size: 30 + Math.random() * 70,
                health: 1
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

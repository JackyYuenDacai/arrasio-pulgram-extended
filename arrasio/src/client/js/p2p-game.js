/**
 * P2P Game Host Management System
 * Uses Pulgram Bridge for communication with host election and migration
 */
class GameP2P {    constructor() {
        this.isHost = false;
        this.hostId = null;
        this.players = new Map();
        this.gameState = 'connecting'; // Start with connecting state
        this.lastHostHeartbeat = 0;
        this.lastStateUpdate = 0; // Track when we last received a state update
        this.hostCheckInterval = null;
        this.gameId = null;
        this.callbacks = {
            onHostChanged: null,
            onPlayerJoined: null, 
            onPlayerLeft: null,
            onGameStateUpdated: null,
            onPlayerInput: null
        };
        
        // Store our peer ID for later reference
        this.peerId = window.pulgram ? window.pulgram.getUserId() : null;
        
        // Connection callback - will be set by the websocket adapter
        this.onGameConnected = null;
        
        // Monitor if we're initialized
        this.initialized = false;

        // Auto-initialize when pulgram is ready
        document.addEventListener('pulgramready', () => {
            this.peerId = window.pulgram.getUserId();
            this.initialize();
        });
    }

    // Game-specific message subtypes for GAME_MOVE
    static MessageSubType = {
        HOST_ELECTION: 'HOST_ELECTION',
        HOST_HEARTBEAT: 'HOST_HEARTBEAT',
        HOST_ASSIGNMENT: 'HOST_ASSIGNMENT',
        PLAYER_JOIN: 'PLAYER_JOIN',
        PLAYER_LEAVE: 'PLAYER_LEAVE',
        GAME_STATE_UPDATE: 'GAME_STATE_UPDATE',
        PLAYER_INPUT: 'PLAYER_INPUT'
    };

    initialize() {
        if (this.initialized) return;
        
        console.log('Initializing P2P Game System');
          // Setup message listener for game messages
        // Listen for incoming messages using the proper Pulgram API method        
        try {
            // Use the proper method from Pulgram bridge without filtering by message type
            if (window.pulgram) {
                // Set up message listener
                window.pulgram.setOnMessageReceivedListener((message) => {
                    console.log('Pulgram message received:', message);
                    // Process all messages regardless of type
                    this.handleMessage(message);
                });
                
                console.log('Successfully set up Pulgram message listener');
            } else {
                console.error('Pulgram not available');
            }
        } catch (error) {
            console.error('Failed to set up message listener:', error);
        }
          // Start host checking interval (for migration)
        this.hostCheckInterval = setInterval(() => this.checkHostStatus(), 3000);
          // Initialize game ID if needed
        if (!this.gameId) {
            // Use localStorage directly instead of potentially unreliable Pulgram methods
            try {
                // Attempt to get from local storage first
                const storedGameId = localStorage.getItem('p2p-gameId');
                if (storedGameId) {
                    this.gameId = storedGameId;
                } else {
                    // Generate a new game ID
                    this.gameId = 'game-' + Date.now();
                    localStorage.setItem('p2p-gameId', this.gameId);
                }
            } catch (e) {
                // If localStorage fails, generate a new game ID
                this.gameId = 'game-' + Date.now();
                console.log('Generated new game ID:', this.gameId);
            }
        }

        // Mark as initialized
        this.initialized = true;

        // Announce ourselves to the group
        this.announcePresence();
        
        // Start host election if we don't have a host
        if (!this.hostId) {
            this.startHostElection();
        }
    }    /**
     * Handle incoming messages
     */    handleMessage(message) {
        // Log the message for debugging
        console.log('Received P2P message:', message);

        let gameMessage;
        try {
            // Handle message regardless of format - important for Pulgram bridge
            let parsedMessage;
            
            // Parse message if it's a string
            if (typeof message === 'string') {
                try {
                    parsedMessage = JSON.parse(message);
                } catch (e) {
                    console.error('Failed to parse message as JSON:', e);
                    return;
                }
            } else {
                parsedMessage = message;
            }
            
            // Extract content - this is where our game data will be
            // The content might already be a parsed object or might be a JSON string
            if (parsedMessage.content) {
                if (typeof parsedMessage.content === 'string') {
                    try {
                        gameMessage = JSON.parse(parsedMessage.content);
                    } catch (e) {
                        gameMessage = parsedMessage.content;
                    }
                } else {
                    gameMessage = parsedMessage.content;
                }
            } else {
                // If no content field, the message itself might be the game message
                gameMessage = parsedMessage;
            }
            
            // Log the parsed message for debugging
            console.log('Parsed message content:', gameMessage);
              // Make sure it has a subType
            if (!gameMessage) {
                console.log('Message is null or undefined');
                return;
            }
            
            // Log the message type to help debug
            console.log('Processing message with subType:', gameMessage.subType);
            
            // Special handling for GAME_STATE_UPDATE messages which might have a different format
            if (gameMessage.subType === 'GAME_STATE_UPDATE' || 
                (gameMessage.state && gameMessage.timestamp)) {
                // This is a valid game state update message, process it
                console.log('Valid game state update detected');
                this.handleGameStateUpdate(gameMessage, parsedMessage.senderId || 'unknown');
                return;
            }
            
            // For other message types, make sure it has a subType
            if (!gameMessage.subType) {
                console.log('Message missing subType:', gameMessage);
                return;
            }
            
            // Skip messages from other games if gameId is defined
            if (gameMessage.gameId && gameMessage.gameId !== this.gameId) {
                return;
            }
            
            // Extract sender ID from the message
            // Make sure we handle different message formats
            const senderId = parsedMessage.senderId || (parsedMessage.sender ? parsedMessage.sender.id : 'unknown-user');
              // Process based on sub-type
            switch (gameMessage.subType) {
                case GameP2P.MessageSubType.HOST_ELECTION:
                    this.handleHostElection(gameMessage, senderId);
                    break;
                case GameP2P.MessageSubType.HOST_HEARTBEAT:
                    this.handleHostHeartbeat(gameMessage, senderId);
                    break;
                case GameP2P.MessageSubType.HOST_ASSIGNMENT:
                    this.handleHostAssignment(gameMessage, senderId);
                    break;
                case GameP2P.MessageSubType.PLAYER_JOIN:
                    this.handlePlayerJoin(gameMessage, senderId);
                    break;
                case GameP2P.MessageSubType.PLAYER_LEAVE:
                    this.handlePlayerLeave(gameMessage, senderId);
                    break;
                case GameP2P.MessageSubType.GAME_STATE_UPDATE:
                    this.handleGameStateUpdate(gameMessage, senderId);
                    break;
                case GameP2P.MessageSubType.PLAYER_INPUT:
                    this.handlePlayerInput(gameMessage, senderId);
                    break;
            }
        } catch (error) {
            console.error('Error handling game message:', error);
        }
    }

    /**
     * Announce our presence to the group
     */
    announcePresence() {
        const message = this.createGameMessage(GameP2P.MessageSubType.PLAYER_JOIN, {
            playerId: window.pulgram.getUserId(),
            timestamp: Date.now()
        });
        
        this.sendGroupMessage(message);
    }

    /**
     * Create a game-specific message
     */
    createGameMessage(subType, data = {}) {
        return {
            subType: subType,
            gameId: this.gameId,
            timestamp: Date.now(),
            ...data
        };
    }    /**
     * Send a message to the group
     */
    sendGroupMessage(content) {
        try {
            // For Pulgram, all message data must be in the content field
            // and we need to use group messaging
            const message = {
                type: "APP_DATA",
                receiverType: "GROUP",
                content: {
                    ...content  // Include all our game data in the content
                }
            };
            
            window.pulgram.sendMessage(JSON.stringify(message));
            console.log('Sent group message:', content);
        } catch (error) {
            console.error('Error sending group message:', error);
        }
    }

    /**
     * Send a message to a specific user
     * Note: In Pulgram's group chat, we can't send to individual users directly
     * Instead, we send to the group and filter by receiverId
     */
    sendDirectMessage(content, userId) {
        try {
            // We'll send to group but include the intended recipient
            const message = {
                type: "APP_DATA",
                receiverType: "GROUP", // Must use GROUP for group chat
                content: {
                    ...content,
                    intendedRecipient: userId // Add this field to filter on receive
                }
            };
            
            window.pulgram.sendMessage(JSON.stringify(message));
            console.log('Sent directed group message to:', userId);
        } catch (error) {
            console.error('Error sending directed message:', error);
        }
    }

    /**
     * Start host election process
     */
    startHostElection() {
        const myId = window.pulgram.getUserId();
        console.log('Starting host election. My ID:', myId);
        
        // Send election message with our ID as candidate
        const message = this.createGameMessage(GameP2P.MessageSubType.HOST_ELECTION, {
            candidateId: myId,
            electionId: Date.now()
        });
        
        this.sendGroupMessage(message);
        
        // Wait for a short time to collect responses
        setTimeout(() => this.finalizeHostElection(), 2000);
    }    /**
     * Handle incoming host election message
     */
    handleHostElection(message, senderId) {
        const myId = window.pulgram.getUserId();
        
        console.log('Host election from:', senderId, 'candidate:', message.candidateId);
        
        // If we're already getting state updates from someone, consider them the host
        // This prevents multiple hosts when joining an existing game
        if (this.lastStateUpdate && Date.now() - this.lastStateUpdate < 10000) {
            console.log('Already receiving state updates, cancelling host election');
            // Keep existing host, don't try to become host
            this.isHost = false;
            return;
        }
        
        // Compare IDs to determine who should be host 
        // (using string comparison - higher ID wins)
        if (message.candidateId > myId) {
            // They have a higher ID, they should be host
            this.hostId = message.candidateId;
            this.isHost = false;
            console.log(`Setting ${message.candidateId} as host based on ID comparison`);
        }
    }    /**
     * Finalize host election and declare winner
     */    finalizeHostElection() {
        const myId = window.pulgram.getUserId();
        console.log('Finalizing host election. Current host:', this.hostId);
        
        // If we're getting state updates, we shouldn't become host
        if (this.lastStateUpdate && Date.now() - this.lastStateUpdate < 10000) {
            console.log('Received recent state updates, not becoming host');
            return;
        }
        
        // If there's no host or we won the election, become host
        if (!this.hostId) {
            console.log('No host detected. Self-appointing as host.');
            this.becomeHost();
        } else if (this.hostId === myId) {
            console.log('Confirming self as host.');
            this.becomeHost();
        } else {
            console.log('Another peer is host:', this.hostId);
            this.isHost = false;
        }
    }

    /**
     * Make this client the host
     */
    becomeHost() {
        const myId = window.pulgram.getUserId();
        this.hostId = myId;
        this.isHost = true;
        console.log('I am now the host:', myId);
        
        // Announce host assignment to all players
        const message = this.createGameMessage(GameP2P.MessageSubType.HOST_ASSIGNMENT, {
            hostId: myId
        });
        
        this.sendGroupMessage(message);
        
        // Start sending regular heartbeats
        this.startHostHeartbeat();
        
        // Trigger callback if defined
        if (typeof this.callbacks.onHostChanged === 'function') {
            this.callbacks.onHostChanged(myId, true);
        }
    }

    /**
     * Start sending host heartbeat messages
     */
    startHostHeartbeat() {
        if (!this.isHost) return;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
            const message = this.createGameMessage(GameP2P.MessageSubType.HOST_HEARTBEAT, {
                hostId: this.hostId
            });
            
            this.sendGroupMessage(message);
        }, 1000);
    }

    /**
     * Handle incoming host heartbeat messages
     */
    handleHostHeartbeat(message, senderId) {
        if (this.hostId !== senderId) {
            // Received heartbeat from someone who isn't our current host
            // This could happen during host transitions
            console.log('Host mismatch. Current:', this.hostId, 'Message:', senderId);
            return;
        }
        
        // Update last heartbeat time
        this.lastHostHeartbeat = Date.now();
    }

    /**
     * Handle host assignment messages
     */
    handleHostAssignment(message, senderId) {
        const oldHost = this.hostId;
        this.hostId = message.hostId;
        this.isHost = (this.hostId === window.pulgram.getUserId());
        
        console.log('Host assigned:', this.hostId, 'Am I host?', this.isHost);
        
        // Trigger callback if defined
        if (typeof this.callbacks.onHostChanged === 'function') {
            this.callbacks.onHostChanged(this.hostId, this.isHost);
        }
    }

    /**
     * Periodically check if the host is still alive
     */
    checkHostStatus() {
        if (this.isHost) return; // We're the host, no need to check
        
        // If no heartbeat received in 5 seconds, start new election
        if (this.hostId && Date.now() - this.lastHostHeartbeat > 5000) {
            console.log('Host appears to be down. Starting new election.');
            this.hostId = null;
            this.startHostElection();
        }
    }

    /**
     * Handle player join events
     */
    handlePlayerJoin(message, senderId) {
        // Add player to our local list
        this.players.set(senderId, {
            id: senderId,
            lastSeen: Date.now()
        });
        
        console.log('Player joined:', senderId);
        
        // If we're the host, send current game state to new player
        if (this.isHost && this.gameState) {
            const stateMessage = this.createGameMessage(GameP2P.MessageSubType.GAME_STATE_UPDATE, {
                state: this.gameState,
                fullState: true
            });
            
            this.sendDirectMessage(stateMessage, senderId);
        }
        
        // Trigger callback if defined
        if (typeof this.callbacks.onPlayerJoined === 'function') {
            this.callbacks.onPlayerJoined(senderId);
        }
    }

    /**
     * Handle player leave events
     */
    handlePlayerLeave(message, senderId) {
        // Remove from player list
        this.players.delete(senderId);
        
        console.log('Player left:', senderId);
        
        // Trigger callback if defined
        if (typeof this.callbacks.onPlayerLeft === 'function') {
            this.callbacks.onPlayerLeft(senderId);
        }
    }

    /**
     * Send player input to the host
     */
    sendPlayerInput(inputData) {
        // Only non-hosts should send player input
        if (this.isHost) return;
        
        const message = this.createGameMessage(GameP2P.MessageSubType.PLAYER_INPUT, {
            input: inputData
        });
        
        // Send directly to host if we know who it is
        if (this.hostId) {
            this.sendDirectMessage(message, this.hostId);
        } else {
            // Otherwise broadcast to group
            this.sendGroupMessage(message);
        }
    }

    /**
     * Handle incoming player input (only the host should process this)
     */
    handlePlayerInput(message, senderId) {
        if (!this.isHost) return;
        
        // Trigger callback if defined
        if (typeof this.callbacks.onPlayerInput === 'function') {
            this.callbacks.onPlayerInput(senderId, message.input);
        }
    }

    /**
     * Update and broadcast game state (host only)
     */
    updateGameState(state, delta = false) {
        if (!this.isHost) return false;
        
        this.gameState = state;
        
        const message = this.createGameMessage(GameP2P.MessageSubType.GAME_STATE_UPDATE, {
            state: delta ? state : this.gameState,
            isDelta: !!delta
        });
        
        this.sendGroupMessage(message);
        return true;
    }    /**
     * Handle incoming game state updates (clients only)
     */
    handleGameStateUpdate(message, senderId) {
        console.log('Handling game state update from:', senderId);
        
        // Accept messages from any host for now - important to get the game starting
        // We can add verification back later if needed
        // if (senderId !== this.hostId && this.hostId) {
        //    console.log('Ignoring game state from non-host:', senderId, 'Current host:', this.hostId);
        //    return;
        //}
        
        let stateToUse = null;
        
        // Figure out where the actual state data is
        if (message.state) {
            // Standard format
            stateToUse = message.state;
        } else if (message.gameState) {
            // Alternative format
            stateToUse = message.gameState;
        } else {
            // The message itself might be the state
            stateToUse = message;
        }
          // Update last state update time
        this.lastStateUpdate = Date.now();
        
        // If we're receiving state updates, this peer should be our host
        if (this.hostId !== senderId) {
            console.log('Updating host based on state update from:', senderId);
            this.hostId = senderId;
            this.isHost = false;
            
            // Trigger host changed callback
            if (typeof this.callbacks.onHostChanged === 'function') {
                this.callbacks.onHostChanged(senderId, false);
            }
        }
        
        if (message.isDelta) {
            // Apply delta update
            this.gameState = {...this.gameState, ...stateToUse};
        } else {
            // Full state update
            this.gameState = stateToUse;
        }
        
        // Always update connection state to connected when we receive game state
        if (this.gameState === 'connecting') {
            this.gameState = 'connected';
            console.log('Game state updated to connected after receiving game state');
            
            // If we have a connection callback, call it
            if (typeof this.onGameConnected === 'function') {
                console.log('Calling onGameConnected after receiving first game state');
                this.onGameConnected();
            }
        }
        
        // Trigger callback if defined
        if (typeof this.callbacks.onGameStateUpdated === 'function') {
            this.callbacks.onGameStateUpdated(this.gameState, message.isDelta);
        }
    }/**
     * Register event callbacks
     */
    on(event, callback) {
        if (typeof this.callbacks[event] !== 'undefined') {
            this.callbacks[event] = callback;
        }
    }
    
    /**
     * Remove event callbacks
     */
    off(event, callback) {
        if (typeof this.callbacks[event] !== 'undefined' && 
            this.callbacks[event] === callback) {
            this.callbacks[event] = null;
        }
    }/**
     * Handle ping messages and reply with pong
     */
    handlePing(message, senderId) {
        // Only host responds to pings
        if (!this.isHost) return;
        
        // Create pong message with same timestamp
        const pongMessage = this.createGameMessage('PONG', {
            timestamp: message.timestamp
        });
        
        // Send pong directly back to sender
        this.sendDirectMessage(pongMessage, senderId);
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        if (this.hostCheckInterval) {
            clearInterval(this.hostCheckInterval);
        }
    }
}

// Export for use in other modules
window.GameP2P = GameP2P;

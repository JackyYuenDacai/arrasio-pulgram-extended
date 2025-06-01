/**
 * P2P Game Welcome Message Extension for Arras.io
 * Handles specific functionality for initializing game state
 */

// Add welcome message functionality to the GameP2P class
GameP2P.prototype.sendMessage = function(content, receiverId = null) {
    if (receiverId) {
        this.sendDirectMessage(content, receiverId);
    } else {
        this.sendGroupMessage(content);
    }
};

// Send a welcome message to a new peer
GameP2P.prototype.sendWelcomeMessage = function(peerId) {
    console.log('Sending welcome message to peer:', peerId);
    this.sendMessage({
        subType: 'welcome',
        gameId: this.gameId,
        hostId: this.hostId,
        isHost: peerId === this.hostId
    }, peerId);
};

// Handle welcome message (initializes the game)
GameP2P.prototype.handleWelcomeMessage = function(message) {
    console.log('Received welcome message:', message);
    this.gameId = message.gameId;
    this.hostId = message.hostId;
    
    try {
        // Try to store our game ID in localStorage
        localStorage.setItem('p2p-gameId', this.gameId);
    } catch (e) {
        // Ignore localStorage errors
    }

    // Check if we are the host
    if (message.isHost || this.peerId === this.hostId) {
        this.isHost = true;
        console.log('I am the host!');
    } else {
        console.log('I am a client. Host is:', this.hostId);
    }
    
    // Update the game state to reflect connection
    this.gameState = 'connected';
    
    // Signal to the game that we're ready
    if (typeof this.onGameConnected === 'function') {
        console.log('Calling onGameConnected callback...');
        this.onGameConnected();
    } else {
        console.warn('onGameConnected callback not defined');
    }
};

// Update the handleMessage function to recognize welcome messages
const originalHandleMessage = GameP2P.prototype.handleMessage;
GameP2P.prototype.handleMessage = function(message) {
    let gameMessage;
    
    // Extract the message content the same way as the original method
    try {
        let parsedMessage;
        
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
            gameMessage = parsedMessage;
        }
        
        // Process welcome messages specifically
        if (gameMessage && gameMessage.subType === 'welcome') {
            console.log('Detected welcome message:', gameMessage);
            this.handleWelcomeMessage(gameMessage);
            return;
        }
    } catch (error) {
        console.error('Error processing welcome message:', error);
    }
    
    // For all other messages, use the original handler
    originalHandleMessage.call(this, message);
};

// Add ability for the host to send welcome messages to all peers
GameP2P.prototype.sendWelcomeToAllPeers = function() {
    if (!this.isHost) return;
    
    console.log('Host sending welcome to all peers');
    
    // Create welcome broadcast message
    const welcomeMessage = {
        subType: 'welcome',
        gameId: this.gameId,
        hostId: this.hostId,
        timestamp: Date.now()
    };
    
    this.sendGroupMessage(welcomeMessage);
};

// Initialize method extension to automatically send welcome messages when becoming host
const originalBecomeHost = GameP2P.prototype.becomeHost;
GameP2P.prototype.becomeHost = function() {
    // Call original method first
    originalBecomeHost.call(this);
    
    // Then send welcome messages to all peers
    setTimeout(() => {
        console.log('New host sending welcome messages to all peers');
        this.sendWelcomeToAllPeers();
    }, 500);
};

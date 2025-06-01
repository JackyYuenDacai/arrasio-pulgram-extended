/**
 * P2P Integration for Arras.io
 * This file acts as a bridge between the game and the P2P system
 */

// Wait for both the game and pulgram to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if pulgram is loaded
    if (window.pulgram) {
        initializeP2PGame();
    } else {
        // Wait for pulgram to be ready
        document.addEventListener('pulgramready', initializeP2PGame);
    }
});

/**
 * Initialize the P2P system and connect it to the game
 */
function initializeP2PGame() {
    console.log('Initializing P2P Game System');
    
    // Create the adapter
    const adapter = new ArrasP2PAdapter().init();
    
    // Store it globally
    window.arrasP2P = adapter;
    
    // Hook into game input system
    setupGameInputHandlers(adapter);
    
    // Connect game rendering to P2P state
    connectGameRendering(adapter);
}

/**
 * Setup input handlers to send player actions to the P2P network
 */
function setupGameInputHandlers(adapter) {
    // Listen to keyboard events and translate to game commands
    document.addEventListener('keydown', function(event) {
        handleKeyboardInput(event, adapter, true);
    });
    
    document.addEventListener('keyup', function(event) {
        handleKeyboardInput(event, adapter, false);
    });
    
    // Handle mouse movement for tank direction
    document.addEventListener('mousemove', function(event) {
        handleMouseMove(event, adapter);
    });
    
    // Handle mouse clicks for shooting
    document.addEventListener('mousedown', function(event) {
        handleMouseClick(event, adapter, true);
    });
    
    document.addEventListener('mouseup', function(event) {
        handleMouseClick(event, adapter, false);
    });
}

/**
 * Handle keyboard input events
 */
function handleKeyboardInput(event, adapter, isDown) {
    // Create an input object if needed
    const input = adapter.localInput || {};
    if (!input.movement) input.movement = { x: 0, y: 0 };
    
    // WASD or Arrow keys movement
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            input.movement.y = isDown ? -1 : 0;
            break;
        case 'KeyS':
        case 'ArrowDown':
            input.movement.y = isDown ? 1 : 0;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            input.movement.x = isDown ? -1 : 0;
            break;
        case 'KeyD':
        case 'ArrowRight':
            input.movement.x = isDown ? 1 : 0;
            break;
        case 'Space':
            input.special = isDown;
            break;
    }
    
    // Send input to adapter
    adapter.sendPlayerInput(input);
}

/**
 * Handle mouse movement for tank direction
 */
function handleMouseMove(event, adapter) {
    const input = adapter.localInput || {};
    
    // Calculate direction based on mouse position
    // This assumes the game's center is at the middle of the screen
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Calculate angle
    input.direction = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    
    // Send input to adapter
    adapter.sendPlayerInput(input);
}

/**
 * Handle mouse clicks for shooting
 */
function handleMouseClick(event, adapter, isDown) {
    if (event.button !== 0) return; // Only handle left click
    
    const input = adapter.localInput || {};
    input.shooting = isDown;
    
    // Send input to adapter
    adapter.sendPlayerInput(input);
}

/**
 * Connect the P2P game state to the game's rendering system
 */
function connectGameRendering(adapter) {
    // This function should be customized based on your game's rendering system
    // Here we assume there's a global game object with a updateEntities method
    
    // Listen for game state updates
    adapter.on('onGameStateUpdated', function(gameState) {
        if (window.game && typeof window.game.updateEntities === 'function') {
            // Update the game's entities with the P2P state
            window.game.updateEntities(convertP2PStateToGameEntities(gameState));
        }
    });
}

/**
 * Convert P2P game state to the format expected by the game's rendering system
 */
function convertP2PStateToGameEntities(gameState) {
    // This function should convert the P2P game state format
    // to whatever format your game's rendering system expects
    
    // Example conversion - this should be customized for your game
    const entities = [];
    
    // Convert players to entities
    for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        
        entities.push({
            id: playerId,
            x: player.position.x,
            y: player.position.y,
            angle: player.direction,
            size: 30, // Default tank size
            health: player.health,
            type: player.tank || 'basic',
            isPlayer: playerId === window.pulgram.getUserId(),
            score: player.score
        });
    }
    
    // Add any other entities from the game state
    if (gameState.entities) {
        for (let entityId in gameState.entities) {
            const entity = gameState.entities[entityId];
            entities.push({
                id: entityId,
                x: entity.position.x,
                y: entity.position.y,
                angle: entity.direction || 0,
                size: entity.size || 20,
                health: entity.health || 1,
                type: entity.type || 'shape',
                isPlayer: false
            });
        }
    }
    
    return entities;
}

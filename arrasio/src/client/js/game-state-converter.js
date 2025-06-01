/**
 * Game State Converter for Arras.io
 * This file handles the translation between arras.io's game format and our P2P system
 */

class GameStateConverter {
    constructor() {
        // Initialize with game-specific configuration
        this.config = {
            // Game-specific configuration
            tankDefinitions: {},
            mapSize: 8000,
            maxPlayers: 16
        };
    }
    
    /**
     * Convert arras.io game update format to P2P game state
     * @param {Object} update - Game update from arras.io
     * @returns {Object} P2P game state object
     */
    updateToP2PState(update) {
        // This is game-specific and would need to be implemented based on
        // the message format used by the game
        return {
            players: this.extractPlayers(update),
            entities: this.extractEntities(update),
            timestamp: Date.now()
        };
    }
    
    /**
     * Extract player information from the game update
     */
    extractPlayers(update) {
        const players = {};
        
        // This is a placeholder for the actual extraction logic
        // which will depend on the format of the game's update messages
        if (update.players) {
            for (const player of update.players) {
                players[player.id] = {
                    id: player.id,
                    position: { x: player.x, y: player.y },
                    direction: player.angle || 0,
                    health: player.health || 1,
                    score: player.score || 0,
                    tank: player.tank || 'basic'
                };
            }
        }
        
        return players;
    }
    
    /**
     * Extract entity information from the game update
     */
    extractEntities(update) {
        const entities = {};
        
        // This is a placeholder for the actual extraction logic
        // which will depend on the format of the game's update messages
        if (update.entities) {
            for (const entity of update.entities) {
                entities[entity.id] = {
                    id: entity.id,
                    position: { x: entity.x, y: entity.y },
                    direction: entity.angle || 0,
                    health: entity.health || 1,
                    type: entity.type || 'shape',
                    size: entity.size || 10
                };
            }
        }
        
        return entities;
    }
    
    /**
     * Convert P2P game state to arras.io update format
     * @param {Object} state - P2P game state
     * @returns {Object} Arras.io game update
     */
    p2pStateToUpdate(state) {
        // This is game-specific and would need to be implemented based on
        // the message format expected by the game
        return {
            players: this.buildPlayerList(state),
            entities: this.buildEntityList(state),
            leaderboard: this.buildLeaderboard(state)
        };
    }
    
    /**
     * Build player list for arras.io update
     */
    buildPlayerList(state) {
        const players = [];
        
        // Convert P2P player format to game's expected format
        for (const playerId in state.players) {
            const player = state.players[playerId];
            players.push({
                id: player.id,
                x: player.position.x,
                y: player.position.y,
                angle: player.direction,
                health: player.health,
                score: player.score,
                tank: player.tank,
                name: player.name || 'Player ' + player.id.substring(0, 4)
            });
        }
        
        return players;
    }
    
    /**
     * Build entity list for arras.io update
     */
    buildEntityList(state) {
        const entities = [];
        
        // Convert P2P entity format to game's expected format
        for (const entityId in state.entities) {
            const entity = state.entities[entityId];
            entities.push({
                id: entity.id,
                x: entity.position.x,
                y: entity.position.y,
                angle: entity.direction,
                health: entity.health,
                size: entity.size,
                type: entity.type
            });
        }
        
        return entities;
    }
    
    /**
     * Build leaderboard for arras.io update
     */
    buildLeaderboard(state) {
        const leaderboard = [];
        
        // Convert player scores to leaderboard format
        const players = Object.values(state.players);
        players.sort((a, b) => b.score - a.score);
        
        // Take top 10 players
        for (let i = 0; i < Math.min(players.length, 10); i++) {
            const player = players[i];
            leaderboard.push({
                id: player.id,
                score: player.score,
                name: player.name || 'Player ' + player.id.substring(0, 4),
                tank: player.tank
            });
        }
        
        return leaderboard;
    }
}

// Export for use in other modules
window.GameStateConverter = GameStateConverter;

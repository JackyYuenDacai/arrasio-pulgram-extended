# Arras.io P2P Extension

## Overview
This extension converts Arras.io to use a peer-to-peer (P2P) networking model instead of a client-server model. It uses the Pulgram Bridge for communication between players, with automatic host election and migration.

## How It Works

### P2P System
The P2P system uses the Pulgram Bridge to establish connections between players. One player is elected as the host based on their ID (highest ID wins), and this player is responsible for:

1. Running the game simulation
2. Processing player inputs
3. Broadcasting game state updates
4. Sending heartbeat messages

If the host disconnects or becomes unresponsive, a new host is automatically elected from the remaining players.

### Components

#### 1. Pulgram Bridge (pulgram-bridge.js)
The communication layer provided by the platform. This handles the actual sending and receiving of messages between devices.

#### 2. P2P Game System (p2p-game.js)
Core P2P functionality:
- Host election and migration
- Player tracking
- Message routing
- Game state synchronization

#### 3. Arras P2P Adapter (arras-p2p-adapter.js)
Connects the P2P system to the game:
- Game state management
- Player input processing
- Game loop

#### 4. WebSocket Adapter (p2p-websocket-adapter.js)
Intercepts WebSocket calls from the game and redirects them to the P2P system:
- Creates a fake WebSocket interface
- Translates between game protocol and P2P messages

#### 5. Protocol Adapter (arras-protocol-adapter.js)
Handles binary protocol conversion:
- Converts binary game messages to P2P format
- Converts P2P messages to binary game format

#### 6. Game State Converter (game-state-converter.js)
Handles game-specific state conversion:
- Converts P2P state to game state format
- Converts game state to P2P format

#### 7. Status UI (p2p-status-ui.js)
Shows P2P connection status:
- Current host
- Player count
- Connection quality

### Messages
The system defines several message types for P2P communication:
- HOST_ELECTION: Used during host election process
- HOST_HEARTBEAT: Regular messages from host to verify connection
- HOST_ASSIGNMENT: Notification of new host
- PLAYER_JOIN: Player joining the game
- PLAYER_LEAVE: Player leaving the game
- GAME_STATE_UPDATE: Game state updates from host
- PLAYER_INPUT: Input from players to host

## Configuring the System

The P2P system is automatically initialized when the game loads. No manual configuration is required for basic functionality.

## Technical Notes

### Host Election
Host election is based on player ID comparison. When a host is needed, all players submit their IDs, and the player with the highest ID becomes the host.

### Host Migration
If the host doesn't send heartbeat messages for 5 seconds, it's considered offline, and a new host election starts automatically.

### Performance Considerations
- The host runs the entire game simulation, which may be resource-intensive
- Game state updates are sent at regular intervals to minimize bandwidth usage
- Full state updates are used for new players, with delta updates for ongoing gameplay

/**
 * P2P UI Elements for Arras.io
 * This adds UI elements to show P2P connection status
 */

class P2PStatusUI {
    constructor() {
        this.statusContainer = null;
        this.hostDisplay = null;
        this.playersDisplay = null;
        this.pingDisplay = null;
        
        // Create UI when document is ready
        if (document.readyState === 'complete') {
            this.createUI();
        } else {
            window.addEventListener('load', () => this.createUI());
        }
    }
    
    /**
     * Create the status UI
     */
    createUI() {
        // Create status container
        this.statusContainer = document.createElement('div');
        this.statusContainer.id = 'p2pStatus';
        this.statusContainer.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: rgba(0, 0, 0, 0.5);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
        `;
        
        // Create status elements
        this.hostDisplay = document.createElement('div');
        this.hostDisplay.textContent = 'Host: Connecting...';
        
        this.playersDisplay = document.createElement('div');
        this.playersDisplay.textContent = 'Players: 0';
        
        this.pingDisplay = document.createElement('div');
        this.pingDisplay.textContent = 'Ping: --';
        
        // Add elements to container
        this.statusContainer.appendChild(this.hostDisplay);
        this.statusContainer.appendChild(this.playersDisplay);
        this.statusContainer.appendChild(this.pingDisplay);
        
        // Add to document
        document.body.appendChild(this.statusContainer);
        
        // Start update loop
        this.startUpdateLoop();
    }
    
    /**
     * Start the UI update loop
     */
    startUpdateLoop() {
        setInterval(() => this.updateUI(), 1000);
    }
    
    /**
     * Update the UI with current P2P status
     */
    updateUI() {
        if (!window.arrasP2P || !window.arrasP2P.p2p) return;
        
        // Update host status
        const hostId = window.arrasP2P.p2p.hostId || 'None';
        const isHost = window.arrasP2P.p2p.isHost;
        this.hostDisplay.textContent = `Host: ${hostId.substring(0, 8)}... ${isHost ? '(You)' : ''}`;
        
        // Update player count
        const playerCount = window.arrasP2P.p2p.players ? window.arrasP2P.p2p.players.size : 0;
        this.playersDisplay.textContent = `Players: ${playerCount}`;
        
        // Update ping - this would require actual ping measurements
        const ping = window.arrasP2P._lastPing || '--';
        this.pingDisplay.textContent = `Ping: ${ping}ms`;
        
        // Update color based on connection status
        if (window.arrasP2P.p2p.initialized) {
            this.statusContainer.style.backgroundColor = isHost ? 
                'rgba(0, 100, 0, 0.5)' : 'rgba(0, 0, 100, 0.5)';
        } else {
            this.statusContainer.style.backgroundColor = 'rgba(100, 0, 0, 0.5)';
        }
    }
}

// Create status UI when pulgram is ready
document.addEventListener('pulgramready', () => {
    window.p2pStatusUI = new P2PStatusUI();
});

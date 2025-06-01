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
        this.notificationArea = null;
        
        // Keep track of notifications
        this.notifications = [];
        
        // Create UI when document is ready
        if (document.readyState === 'complete') {
            this.createUI();
        } else {
            window.addEventListener('load', () => this.createUI());
        }
    }    /**
     * Create the status UI
     */
    createUI() {
        // Create status container
        this.statusContainer = document.createElement('div');
        this.statusContainer.id = 'p2pStatus';
        
        // Add minimize button
        const minimizeBtn = document.createElement('div');
        minimizeBtn.className = 'minimize-btn';
        minimizeBtn.innerHTML = '&ndash;';
        minimizeBtn.addEventListener('click', this.toggleMinimize.bind(this));
        
        // Create mode indicator
        this.modeDisplay = document.createElement('div');
        this.modeDisplay.className = 'mode';
        this.modeDisplay.textContent = 'P2P MODE';
        
        // Create host status with indicator
        this.hostDisplay = document.createElement('div');
        this.hostDisplay.className = 'status-row host-status';
        
        const hostIndicator = document.createElement('span');
        hostIndicator.className = 'host-indicator';
        
        const hostLabel = document.createElement('span');
        hostLabel.className = 'status-label';
        hostLabel.textContent = 'Host:';
        
        const hostValue = document.createElement('span');
        hostValue.className = 'status-value';
        hostValue.textContent = 'Connecting...';
        
        this.hostDisplay.appendChild(hostIndicator);
        this.hostDisplay.appendChild(hostLabel);
        this.hostDisplay.appendChild(hostValue);
        this.hostValue = hostValue;
        
        // Create player count row
        this.playersDisplay = document.createElement('div');
        this.playersDisplay.className = 'status-row';
        
        const playersLabel = document.createElement('span');
        playersLabel.className = 'status-label';
        playersLabel.textContent = 'Players:';
        
        const playersValue = document.createElement('span');
        playersValue.className = 'status-value';
        playersValue.textContent = '0';
        
        this.playersDisplay.appendChild(playersLabel);
        this.playersDisplay.appendChild(playersValue);
        this.playersValue = playersValue;
        
        // Create ping row
        this.pingDisplay = document.createElement('div');
        this.pingDisplay.className = 'status-row';
        
        const pingLabel = document.createElement('span');
        pingLabel.className = 'status-label';
        pingLabel.textContent = 'Ping:';
        
        const pingValue = document.createElement('span');
        pingValue.className = 'status-value';
        pingValue.textContent = '--';
        
        this.pingDisplay.appendChild(pingLabel);
        this.pingDisplay.appendChild(pingValue);
        this.pingValue = pingValue;
        
        // Create notification area
        this.notificationArea = document.createElement('div');
        this.notificationArea.className = 'notification-area';
        
        // Add elements to container
        this.statusContainer.appendChild(minimizeBtn);
        this.statusContainer.appendChild(this.modeDisplay);
        this.statusContainer.appendChild(this.hostDisplay);
        this.statusContainer.appendChild(this.playersDisplay);
        this.statusContainer.appendChild(this.pingDisplay);
        this.statusContainer.appendChild(this.notificationArea);
        
        // Add to document
        document.body.appendChild(this.statusContainer);
        
        // Add some initial notifications
        this.showNotification('P2P mode enabled', 5000);
        this.showNotification('Connecting to peers...', 3000);
        
        // Listen to P2P events
        if (window.arrasP2P && window.arrasP2P.p2p) {
            window.arrasP2P.p2p.on('onHostChanged', (hostId, isHost) => {
                if (isHost) {
                    this.showNotification('You are now the host!', 3000);
                } else {
                    this.showNotification(`New host assigned: ${hostId.substring(0, 8)}...`, 3000);
                }
            });
            
            window.arrasP2P.p2p.on('onPlayerJoined', (playerId) => {
                this.showNotification(`Player joined: ${playerId.substring(0, 8)}...`, 3000);
            });
            
            window.arrasP2P.p2p.on('onPlayerLeft', (playerId) => {
                this.showNotification(`Player left: ${playerId.substring(0, 8)}...`, 3000);
            });
        }
        
        // Start update loop
        this.startUpdateLoop();
    }
      /**
     * Toggle minimized state of the status UI
     */
    toggleMinimize() {
        if (this.statusContainer.classList.contains('minimized')) {
            this.statusContainer.classList.remove('minimized');
        } else {
            this.statusContainer.classList.add('minimized');
        }
    }
    
    /**
     * Show a notification in the status UI
     */
    showNotification(message, duration = 3000) {
        // Unminimize when showing important notifications
        if (this.statusContainer.classList.contains('minimized')) {
            this.statusContainer.classList.remove('minimized');
            
            // Re-minimize after a short time
            setTimeout(() => {
                this.statusContainer.classList.add('minimized');
            }, duration + 500);
        }
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Add to notification area
        this.notificationArea.appendChild(notification);
        
        // Add to notifications list
        this.notifications.push({
            element: notification,
            expire: Date.now() + duration
        });
        
        // Remove after duration
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.5s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, duration);
    }
    
    /**
     * Show a game event notification (center of screen)
     */
    showGameEvent(message) {
        const event = document.createElement('div');
        event.className = 'game-event';
        event.textContent = message;
        
        document.body.appendChild(event);
        
        // Remove after animation completes
        setTimeout(() => {
            if (event.parentNode) {
                event.parentNode.removeChild(event);
            }
        }, 3000);
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
        this.hostValue.textContent = `${hostId.substring(0, 8)}... ${isHost ? '(You)' : ''}`;
        
        // Update player count
        const playerCount = window.arrasP2P.p2p.players ? window.arrasP2P.p2p.players.size : 0;
        this.playersValue.textContent = `${playerCount}`;
        
        // Update ping
        const ping = window.arrasP2P._lastPing || '--';
        this.pingValue.textContent = `${ping}ms`;
        
        // Set ping color based on value
        if (typeof ping === 'number') {
            if (ping < 100) {
                this.pingValue.className = 'status-value ping-good';
            } else if (ping < 200) {
                this.pingValue.className = 'status-value ping-medium';
            } else {
                this.pingValue.className = 'status-value ping-bad';
            }
        } else {
            this.pingValue.className = 'status-value';
        }
        
        // Update container class based on connection status
        this.statusContainer.classList.remove('host', 'client', 'disconnected');
        
        if (window.arrasP2P.p2p.initialized) {
            if (isHost) {
                this.statusContainer.classList.add('host');
            } else {
                this.statusContainer.classList.add('client');
            }
        } else {
            this.statusContainer.classList.add('disconnected');
        }
    }
}

// Create status UI when pulgram is ready
document.addEventListener('pulgramready', () => {
    window.p2pStatusUI = new P2PStatusUI();
});

/**
 * Debugging utilities for P2P mode
 * This helps troubleshoot connection issues in P2P mode
 */

// Create a debug UI to show connection state and messages
function createDebugUI() {
    // Create debug container
    const debugContainer = document.createElement('div');
    debugContainer.id = 'p2p-debug-ui';
    debugContainer.style.cssText = `
        position: absolute;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        max-width: 500px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 9999;
    `;
    
    // Add header
    const header = document.createElement('div');
    header.textContent = '🔄 P2P DEBUG';
    header.style.fontWeight = 'bold';
    header.style.marginBottom = '5px';
    header.style.borderBottom = '1px solid #444';
    debugContainer.appendChild(header);
    
    // Add log container
    const logContainer = document.createElement('div');
    logContainer.id = 'p2p-debug-log';
    debugContainer.appendChild(logContainer);
    
    // Add to DOM
    document.body.appendChild(debugContainer);
    
    // Return the log container reference for adding log entries
    return logContainer;
}

// Initialize the debug UI when the DOM is loaded
let debugLogContainer;
document.addEventListener('DOMContentLoaded', () => {
    debugLogContainer = createDebugUI();
    logDebugMessage('P2P Debug initialized', 'info');
});

// Add a log message to the debug UI
function logDebugMessage(message, type = 'log') {
    // Create the log entry
    const logEntry = document.createElement('div');
    logEntry.style.marginBottom = '2px';
    logEntry.style.borderLeft = '3px solid ' + getColorForType(type);
    logEntry.style.paddingLeft = '5px';
    
    // Add timestamp
    const timestamp = document.createElement('span');
    timestamp.textContent = new Date().toLocaleTimeString() + ': ';
    timestamp.style.color = '#aaa';
    logEntry.appendChild(timestamp);
    
    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    messageSpan.style.color = getColorForType(type);
    logEntry.appendChild(messageSpan);
    
    // Add to log container if it exists
    if (debugLogContainer) {
        debugLogContainer.appendChild(logEntry);
        // Limit entries to 50
        if (debugLogContainer.children.length > 50) {
            debugLogContainer.removeChild(debugLogContainer.children[0]);
        }
        // Auto-scroll
        debugLogContainer.parentElement.scrollTop = debugLogContainer.parentElement.scrollHeight;
    } else {
        // Fall back to console
        console[type](message);
    }
}

// Get color for log type
function getColorForType(type) {
    switch(type) {
        case 'error': return '#ff5252';
        case 'warn': return '#ffd740';
        case 'info': return '#40c4ff';
        case 'success': return '#69f0ae';
        default: return '#ffffff';
    }
}

// Override console methods for P2P
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

// Only intercept console.logs that are related to P2P
const interceptConsole = () => {
    console.log = function(...args) {
        const message = args.join(' ');
        originalConsole.log.apply(console, args);
        
        if (message.includes('P2P') || message.includes('pulgram') || 
            message.includes('host') || message.includes('message')) {
            logDebugMessage(message, 'log');
        }
    };
    
    console.warn = function(...args) {
        const message = args.join(' ');
        originalConsole.warn.apply(console, args);
        
        if (message.includes('P2P') || message.includes('pulgram') || 
            message.includes('host') || message.includes('message')) {
            logDebugMessage(message, 'warn');
        }
    };
    
    console.error = function(...args) {
        const message = args.join(' ');
        originalConsole.error.apply(console, args);
        
        if (message.includes('P2P') || message.includes('pulgram') || 
            message.includes('host') || message.includes('message')) {
            logDebugMessage(message, 'error');
        }
    };
    
    console.info = function(...args) {
        const message = args.join(' ');
        originalConsole.info.apply(console, args);
        
        if (message.includes('P2P') || message.includes('pulgram') || 
            message.includes('host') || message.includes('message')) {
            logDebugMessage(message, 'info');
        }
    };
};

// Initialize when pulgram is ready
document.addEventListener('pulgramready', () => {
    interceptConsole();
    logDebugMessage('P2P Debug initialized and console intercepted', 'success');
    
    // Add entry for pulgram initialization
    logDebugMessage('Pulgram detected: ' + (!!window.pulgram), 'info');
    
    // Check if P2P is operational
    if (window.pulgram) {
        try {
            // Get user ID
            const userId = window.pulgram.getUserId();
            logDebugMessage('Pulgram User ID: ' + userId, 'info');
        } catch (err) {
            logDebugMessage('Error getting Pulgram user ID: ' + err.message, 'error');
        }
    }
});

// Export debug functions for global use
window.p2pDebug = {
    log: logDebugMessage
};

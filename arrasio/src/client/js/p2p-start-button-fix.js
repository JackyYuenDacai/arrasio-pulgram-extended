// P2P Start Button Fix
document.addEventListener('pulgramready', function() {
    // Ensure start button is visible and properly positioned
    const startBtn = document.getElementById('startButton');
    if (startBtn) {
        // Position the button in the center of the screen
        startBtn.style.position = 'fixed';
        startBtn.style.left = '50%';
        startBtn.style.top = '50%';
        startBtn.style.transform = 'translate(-50%, -50%)';
        startBtn.style.zIndex = '1000';
        startBtn.style.display = 'block';
        startBtn.style.width = '200px';
        startBtn.textContent = 'Start P2P Game';
        
        // Make sure the start button's parent is visible
        const startMenuWrapper = document.getElementById('startMenuWrapper');
        if (startMenuWrapper) {
            startMenuWrapper.style.maxHeight = 'none';
            startMenuWrapper.style.overflow = 'visible';
            startMenuWrapper.style.opacity = '1';
        }
    }
    
    // Add a message indicating P2P mode is ready
    const gameMessage = document.createElement('div');
    gameMessage.style.position = 'fixed';
    gameMessage.style.left = '50%';
    gameMessage.style.top = '40%';
    gameMessage.style.transform = 'translate(-50%, -50%)';
    gameMessage.style.color = '#fff';
    gameMessage.style.textAlign = 'center';
    gameMessage.style.fontSize = '24px';
    gameMessage.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    gameMessage.style.zIndex = '1000';
    gameMessage.innerHTML = 'P2P Mode Ready<br>Click Start to Begin';
    document.body.appendChild(gameMessage);
});

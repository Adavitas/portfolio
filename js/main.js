// main.js

document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Time Display
    const timeElement = document.getElementById('local-time');
    
    function updateTime() {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString();
    }
    
    // Initial call and set interval
    updateTime();
    setInterval(updateTime, 1000);
});

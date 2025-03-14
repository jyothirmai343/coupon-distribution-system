document.addEventListener('DOMContentLoaded', function() {
    const claimButton = document.getElementById('claim-button');
    const couponResult = document.getElementById('coupon-result');
    const loadingElement = document.getElementById('loading');
    const countdownElement = document.getElementById('countdown');
    const timeLeftElement = document.getElementById('time-left');
    
    let countdownInterval = null;
    
    // Check user status on page load
    checkUserStatus();
    
    // Claim button event listener
    claimButton.addEventListener('click', async function() {
        // Disable button and show loading
        claimButton.disabled = true;
        loadingElement.classList.remove('hidden');
        
        try {
            const response = await fetch('/api/coupon');
            const data = await response.json();
            
            loadingElement.classList.add('hidden');
            
            if (data.error) {
                // Show error message
                couponResult.innerHTML = `<div class="error-message">${data.message}</div>`;
            } else {
                // Show success message with coupon code
                couponResult.innerHTML = `
                    <div class="success-message">
                        <p>${data.message}</p>
                        <div class="coupon-code">${data.coupon.code}</div>
                        <p><strong>Discount:</strong> ${data.coupon.discount}</p>
                    </div>
                    <p>Copy this code and use it at checkout!</p>
                `;
                
                // Start countdown
                startCountdown();
            }
        } catch (error) {
            loadingElement.classList.add('hidden');
            couponResult.innerHTML = `<div class="error-message">An error occurred. Please try again later.</div>`;
            claimButton.disabled = false;
        }
    });
    
    // Function to check user status and update UI accordingly
    async function checkUserStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            if (!data.canClaim) {
                claimButton.disabled = true;
                
                // Get the most restrictive time
                const timeLeft = Math.max(
                    data.ipRestriction || 0,
                    data.sessionRestriction || 0
                );
                
                if (timeLeft > 0) {
                    // Show countdown
                    countdownElement.classList.remove('hidden');
                    updateCountdown(timeLeft);
                    
                    // Start countdown
                    startCountdownTimer(timeLeft);
                }
            }
        } catch (error) {
            console.error('Error checking user status:', error);
        }
    }
    
    // Start countdown timer
    function startCountdown() {
        // Check status again to get the current restriction time
        checkUserStatus();
    }
    
    // Update countdown display
    function updateCountdown(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        timeLeftElement.textContent = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    // Start countdown timer with initial minutes
    function startCountdownTimer(initialMinutes) {
        // Clear any existing interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        let minutes = initialMinutes;
        
        countdownInterval = setInterval(() => {
            minutes--;
            
            if (minutes <= 0) {
                // Stop countdown and reset UI
                clearInterval(countdownInterval);
                countdownElement.classList.add('hidden');
                claimButton.disabled = false;
            } else {
                updateCountdown(minutes);
            }
        }, 60000); // Update every minute
    }
});
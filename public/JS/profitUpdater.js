/**
 * Profit Manager - Handles all monthly profit update operations
 * This file consolidates all profit updating functionality
 */

// Initialize immediately when this script loads
(function() {
    console.log('🚀 Profit Manager initialized');
    setupProfitUpdateListeners();
})();

/**
 * Set up listeners for all events that should trigger a profit update
 */
function setupProfitUpdateListeners() {
    // Override fetch to intercept API calls related to sales
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        // Call the original fetch
        const response = await originalFetch(url, options);
        const responseClone = response.clone();
        
        try {
            // Check if this is a relevant API call that should trigger a profit update
            const shouldUpdateProfit = 
                // New sale created
                (options && options.method === 'POST' && url.includes('/api/vendas')) ||
                // Sale deleted
                (options && options.method === 'DELETE' && url.includes('/api/vendas/'));
                
            if (shouldUpdateProfit) {
                console.log('💰 Sales operation detected - scheduling profit update');
                scheduleUpdateMonthlyProfit();
            }
        } catch (e) {
            console.error('Error in fetch interceptor:', e);
        }
        
        // Return the original response
        return response;
    };

    // Override XMLHttpRequest to catch installment payment requests
    const originalXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function() {
        const method = arguments[0];
        const url = arguments[1];
        
        // Check if this is an installment payment request
        if (method === 'PATCH' && url.includes('/api/installments') && url.includes('/pay')) {
            this.addEventListener('load', function() {
                if (this.status >= 200 && this.status < 300) {
                    console.log('💵 Installment payment successful - scheduling profit update');
                    scheduleUpdateMonthlyProfit();
                }
            });
        }
        
        return originalXHROpen.apply(this, arguments);
    };
}

/**
 * Schedule an update to the monthly profit with a delay
 * to ensure server operations are complete
 */
function scheduleUpdateMonthlyProfit(delay = 500) {
    console.log(`⏱️ Scheduling profit update in ${delay}ms`);
    
    setTimeout(() => {
        updateMonthlyProfit();
    }, delay);
}

/**
 * Update the monthly profit value by fetching from the server
 */
function updateMonthlyProfit() {
    console.log('🔄 Updating monthly profit...');
    
    // Add cache busting parameter
    const timestamp = new Date().getTime();
    
    fetch(`/api/monthly-profit?t=${timestamp}`, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch updated monthly profit');
        }
        return response.json();
    })
    .then(data => {
        console.log('✅ Monthly profit data received:', data);
        
        const profitDisplay = document.getElementById('monthlyProfitValue');
        if (profitDisplay) {
            // Store the old value for animation purposes
            const oldValue = profitDisplay.textContent;
            const newValue = data.formattedProfit;
            
            // Update the value
            profitDisplay.textContent = newValue;
            
            // Add animation effect
            animateProfitChange(profitDisplay, oldValue !== newValue);
            
            console.log('💰 Monthly profit display updated to:', data.formattedProfit);
        } else {
            console.error('❌ Monthly profit element not found in DOM');
        }
    })
    .catch(error => {
        console.error('❌ Error updating monthly profit:', error);
    });
}

/**
 * Animate the profit change
 */
function animateProfitChange(element, hasChanged) {
    if (!hasChanged) {
        console.log('💤 No profit change detected');
        return;
    }
    
    // Remove any existing animations
    element.style.transition = '';
    element.style.transform = '';
    element.style.color = '';
    element.style.textShadow = '';
    
    // Force a reflow
    void element.offsetWidth;
    
    // Apply animation
    element.style.transition = 'all 0.8s ease-out';
    element.style.color = '#4caf50';
    element.style.transform = 'scale(1.1)';
    element.style.textShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
    
    // Reset after animation completes
    setTimeout(() => {
        element.style.color = '';
        element.style.transform = '';
        element.style.textShadow = '';
    }, 1500);
}

// Add these functions to the global window object
window.updateMonthlyProfit = updateMonthlyProfit;
window.scheduleUpdateMonthlyProfit = scheduleUpdateMonthlyProfit;

// Add profit update animation styles
const styleElement = document.createElement('style');
styleElement.textContent = `
@keyframes profit-highlight {
    0% { color: #ffffff; transform: scale(1); }
    50% { color: #4caf50; transform: scale(1.1); text-shadow: 0 0 10px rgba(76, 175, 80, 0.5); }
    100% { color: #ffffff; transform: scale(1); }
}

#monthlyProfitValue {
    transition: all 0.5s ease-in-out;
}

#monthlyProfitValue.highlight {
    animation: profit-highlight 2s ease-in-out;
}
`;
document.head.appendChild(styleElement);
// Load notification when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadNotification();
});

async function loadNotification() {
    try {
        const response = await fetch('/api/notifications');
        
        if (!response.ok) {
            throw new Error('Failed to fetch notification');
        }
        
        const notification = await response.json();
        updateNotificationBar(notification);
        
    } catch (error) {
        console.error('Error loading notification:', error);
        // Show default notification on error
        const defaultNotification = {
            type: 'light',
            icon: 'bi-bell',
            message: 'Bem-vindo ao sistema de vendas!',
            priority: 0
        };
        updateNotificationBar(defaultNotification);
    }
}

// Function to update the notification bar
function updateNotificationBar(notification) {
    const notificationBar = document.querySelector('.notification-bar');
    const notificationText = document.getElementById('notificationText');
    const notificationIcon = document.querySelector('.notification-bar i');
    
    if (!notificationBar || !notificationText || !notificationIcon) {
        console.error('Notification elements not found');
        return;
    }
    
    // Update text
    notificationText.textContent = notification.message;
    
    // Update icon
    notificationIcon.className = `${notification.icon} me-2`;
    
    // Update notification bar style based on type
    const typeClasses = {
        'danger': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info',
        'success': 'alert-success',
        'light': 'alert-light'
    };
    
    // Remove existing alert classes
    notificationBar.classList.remove('alert-danger', 'alert-warning', 'alert-info', 'alert-success', 'alert-light');
    
    // Add new alert class
    if (typeClasses[notification.type]) {
        notificationBar.classList.add(typeClasses[notification.type]);
    }
    
    // Add animation for important notifications
    if (notification.priority >= 2) {
        notificationBar.classList.add('notification-urgent');
        setTimeout(() => {
            notificationBar.classList.remove('notification-urgent');
        }, 3000);
    }
}

// Function to dismiss notification
function dismissNotification() {
    const notificationBar = document.querySelector('.notification-bar');
    if (notificationBar) {
        notificationBar.style.display = 'none';
        
        // Store dismissal in localStorage to prevent showing again for a while
        localStorage.setItem('notificationDismissed', new Date().getTime());
    }
}

// Function to check if notification was recently dismissed
function wasRecentlyDismissed() {
    const dismissedTime = localStorage.getItem('notificationDismissed');
    if (!dismissedTime) return false;
    
    const now = new Date().getTime();
    const dismissedTimestamp = parseInt(dismissedTime);
    
    // Show notification again after 1 hour
    const oneHour = 60 * 60 * 1000;
    return (now - dismissedTimestamp) < oneHour;
}

// Function to refresh notification (can be called periodically)
function refreshNotification() {
    if (!wasRecentlyDismissed()) {
        loadNotification();
    }
}

// Optional: Auto-refresh notification every 5 minutes
setInterval(refreshNotification, 5 * 60 * 1000);
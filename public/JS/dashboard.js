// Enhanced Dashboard JavaScript with improved responsive functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const hamburger = document.querySelector('.hamburger');
    const nav = document.querySelector('.nav');
    
    if (hamburger && nav) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            nav.classList.toggle('active');
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!hamburger.contains(e.target) && !nav.contains(e.target)) {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
            }
        });
        
        // Close mobile menu when window is resized to desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768) {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
            }
        });
    }
    
    // Global variable to store dashboard data
    let dashboardData = null;
    
    // Currency formatting function
    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    // Date formatting function
    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('pt-BR');
    }
    
    // Fetch dashboard data from API
    async function fetchDashboardData() {
        try {
            const response = await fetch('/api/dashboard-data');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            dashboardData = await response.json();
            return dashboardData;
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Return minimal fallback data structure
            return {
                stats: {
                    totalClients: 0,
                    totalProducts: 0,
                    totalSales: 0,
                    pendingInstallments: { count: 0, amount: 0 },
                    overdueInstallments: { count: 0, amount: 0 },
                    lowStockProducts: 0,
                },
                recentSales: [],
                topProducts: []
            };
        }
    }

    // Populate dashboard statistics
    function populateStats() {
        if (!dashboardData) return;
        
        const stats = dashboardData.stats;
        const elements = {
            totalClients: document.getElementById('totalClients'),
            totalProducts: document.getElementById('totalProducts'),
            totalSales: document.getElementById('totalSales'),
            pendingInstallments: document.getElementById('pendingInstallments'),
            pendingAmount: document.getElementById('pendingAmount'),
            overdueInstallments: document.getElementById('overdueInstallments'),
            overdueAmount: document.getElementById('overdueAmount'),
            lowStockProducts: document.getElementById('lowStockProducts')
        };
        
        // Update stats with animation
        Object.keys(elements).forEach(key => {
            if (elements[key]) {
                if (key.includes('Amount')) {
                    const amount = key === 'pendingAmount' ? stats.pendingInstallments.amount : stats.overdueInstallments.amount;
                    animateValue(elements[key], 0, amount, 1000, formatCurrency);
                } else {
                    const value = key === 'pendingInstallments' ? stats.pendingInstallments.count :
                                 key === 'overdueInstallments' ? stats.overdueInstallments.count :
                                 stats[key];
                    animateValue(elements[key], 0, value, 1000);
                }
            }
        });
    }
    
    // Animate counter values
    function animateValue(element, start, end, duration, formatter = null) {
        const startTime = Date.now();
        const update = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = start + (end - start) * easeOutQuart(progress);
            
            element.textContent = formatter ? formatter(current) : Math.floor(current);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = formatter ? formatter(end) : end;
            }
        };
        update();
    }
    
    // Easing function for smooth animations
    function easeOutQuart(t) {
        return 1 - (--t) * t * t * t;
    }
    
    // Populate recent sales table
    function populateRecentSales() {
        if (!dashboardData) return;
        
        const sales = dashboardData.recentSales;
        const tableBody = document.getElementById('recentSalesBody');
        
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        sales.forEach((sale, index) => {
            const row = document.createElement('tr');
            row.style.opacity = '0';
            row.style.transform = 'translateY(20px)';
            
            row.innerHTML = `
                <td class="font-medium text-gray-900">${sale.client}</td>
                <td class="text-gray-600">${sale.product}</td>
                <td class="currency">${formatCurrency(sale.value)}</td>
                <td class="text-gray-600">${formatDate(sale.date)}</td>
            `;
            
            tableBody.appendChild(row);
            
            // Animate row appearance
            setTimeout(() => {
                row.style.transition = 'all 0.3s ease';
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }
    
    // Render top products chart with responsive design
    function renderTopProductsChart() {
        const canvas = document.getElementById('topProductsChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!dashboardData) return;
        
        const products = dashboardData.topProducts.slice().reverse();
        
        // Destroy existing chart if it exists
        if (window.topProductsChartInstance) {
            window.topProductsChartInstance.destroy();
        }
        
        // Set canvas minimum width for horizontal scrolling
        const minWidth = 400;
        const containerWidth = canvas.parentElement.clientWidth;
        canvas.style.minWidth = Math.max(minWidth, containerWidth) + 'px';
        
        // Responsive configuration based on screen size
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        const isDesktop = window.innerWidth >= 1024;
        
        window.topProductsChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: products.map(p => p.name),
                datasets: [{
                    label: 'Receita (R$)',
                    data: products.map(p => p.revenue),
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1,
                    borderRadius: isMobile ? 4 : 6,
                    borderSkipped: false,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                layout: {
                    padding: isMobile ? 5 : 10
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(79, 70, 229, 1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        titleFont: {
                            size: isMobile ? 12 : 14
                        },
                        bodyFont: {
                            size: isMobile ? 11 : 13
                        },
                        callbacks: {
                            label: function(context) {
                                return `Receita: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            lineWidth: 0.5
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: isMobile ? 9 : isTablet ? 10 : 12
                            },
                            maxTicksLimit: isMobile ? 4 : 6,
                            callback: function(value) {
                                if (isMobile && value > 1000) {
                                    return 'R$ ' + (value / 1000).toFixed(0) + 'k';
                                }
                                return formatCurrency(value);
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6b7280',
                            font: {
                                size: isMobile ? 9 : isTablet ? 10 : 12
                            },
                            callback: function(value, index) {
                                const label = this.getLabelForValue(value);
                                if (isMobile) {
                                    return label.length > 15 ? label.substring(0, 15) + '...' : label;
                                }
                                if (isTablet) {
                                    return label.length > 20 ? label.substring(0, 20) + '...' : label;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Render installments chart with responsive design
    function renderInstallmentsChart() {
        const canvas = document.getElementById('installmentsChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!dashboardData) return;
        
        const data = dashboardData.stats;
        
        // Destroy existing chart if it exists
        if (window.installmentsChartInstance) {
            window.installmentsChartInstance.destroy();
        }
        
        // Set canvas minimum width for horizontal scrolling
        const minWidth = 300;
        const containerWidth = canvas.parentElement.clientWidth;
        canvas.style.minWidth = Math.max(minWidth, containerWidth) + 'px';
        
        // Responsive configuration based on screen size
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
        const isDesktop = window.innerWidth >= 1024;
        
        window.installmentsChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pendentes', 'Atrasadas'],
                datasets: [{
                    label: 'Valor Total',
                    data: [data.pendingInstallments.amount, data.overdueInstallments.amount],
                    backgroundColor: [
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgba(245, 158, 11, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: isMobile ? 1 : 2,
                    hoverOffset: isMobile ? 2 : 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: isMobile ? '50%' : '60%',
                layout: {
                    padding: isMobile ? 10 : 20
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'top' : 'bottom',
                        labels: {
                            padding: isMobile ? 10 : 20,
                            usePointStyle: true,
                            font: {
                                size: isMobile ? 11 : isTablet ? 12 : 14
                            },
                            boxWidth: isMobile ? 8 : 12,
                            boxHeight: isMobile ? 8 : 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(79, 70, 229, 1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        titleFont: {
                            size: isMobile ? 12 : 14
                        },
                        bodyFont: {
                            size: isMobile ? 11 : 13
                        },
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += formatCurrency(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Handle window resize for responsive charts
    function handleResize() {
        setTimeout(() => {
            // Re-render charts on resize to ensure proper scrolling
            renderTopProductsChart();
            renderInstallmentsChart();
        }, 100);
    }
    
    // Initialize dashboard
    async function initDashboard() {
        // Show loading state
        const loadingElements = document.querySelectorAll('.loading');
        loadingElements.forEach(el => el.style.display = 'block');
        
        try {
            // Fetch dashboard data from API
            await fetchDashboardData();
            
            // Update UI with fetched data
            populateStats();
            populateRecentSales();
            
            // Wait for Chart.js to load
            if (typeof Chart !== 'undefined') {
                renderTopProductsChart();
                renderInstallmentsChart();
            } else {
                console.warn('Chart.js not loaded');
            }
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
        } finally {
            // Hide loading state
            loadingElements.forEach(el => el.style.display = 'none');
        }
    }
    
    // Event listeners
    window.addEventListener('resize', handleResize);
    
    // Initialize dashboard
    initDashboard();
    
    // Refresh functionality
    window.refreshDashboard = async function() {
        await initDashboard();
    };
});

document.addEventListener('DOMContentLoaded', () => {
    // ========== STATE VARIABLES ==========
    let productsData = [];
    let clientsData = [];
    let paymentMethodsData = [];
    let salesData = [];
    let currentCart = [];
    let currentFilters = {};
    let currentSort = { field: 'sale_date', order: 'DESC' };
    let currentPage = 1;
    let filterOptions = { clients: [], products: [], paymentMethods: [] };
    let totalSales = 0;
    let appliedFilters = {};
    let totalPages = 1;
    let currentPagination = {
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false
    };

    // ========== CONSTANTS ==========
    const CONFIG = {
        NOTIFICATION_DURATION: 5000,
        MAX_RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        PAGINATION_SIZE: 15
    };

    // ========== UTILITY FUNCTIONS ==========
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), delay);
        };
    };

    const filterManager = {
        init() {
            this.setupEventListeners();
            this.populateFilterOptions();
        },

        setupEventListeners() {
            // Basic filters
            const searchInput = document.getElementById('salesSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', debounce((e) => {
                    this.updateFilter('search', e.target.value.trim());
                }, 500));
            }

            const dateRangeFilter = document.getElementById('dateRangeFilter');
            if (dateRangeFilter) {
                dateRangeFilter.addEventListener('change', (e) => {
                    this.handleDateRangeChange(e.target.value);
                });
            }

            const statusFilter = document.getElementById('statusFilter');
            if (statusFilter) {
                statusFilter.addEventListener('change', (e) => {
                    this.updateFilter('status', e.target.value);
                });
            }
        },

        handleDateRangeChange(range) {
            const customDateRange = document.getElementById('customDateRange');
            
            if (range === 'custom') {
                customDateRange?.classList.remove('d-none');
                return;
            } else {
                customDateRange?.classList.add('d-none');
            }

            let startDate = '';
            let endDate = '';
            const today = new Date();

            switch (range) {
                case 'today':
                    startDate = today.toISOString().split('T')[0];
                    endDate = startDate;
                    break;
                case 'week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    startDate = weekStart.toISOString().split('T')[0];
                    endDate = today.toISOString().split('T')[0];
                    break;
                case 'month':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                    endDate = today.toISOString().split('T')[0];
                    break;
            }

            if (startDate && endDate) {
                this.updateFilter('startDate', startDate);
                this.updateFilter('endDate', endDate);
            } else {
                this.removeFilter('startDate');
                this.removeFilter('endDate');
            }
        },

        updateFilter(key, value) {
            if (value && value !== '') {
                appliedFilters[key] = value;
            } else {
                delete appliedFilters[key];
            }
            
            currentPage = 1;
            this.updateDisplay();
            loadSalesData();
        },

        removeFilter(key) {
            delete appliedFilters[key];
            this.updateDisplay();
            loadSalesData();
        },

        updateDisplay() {
            const container = document.getElementById('currentFiltersDisplay');
            if (!container) return;

            const filterKeys = Object.keys(appliedFilters);
            
            if (filterKeys.length === 0) {
                container.innerHTML = '<span class="text-muted">Nenhum filtro aplicado</span>';
                return;
            }

            const filterTags = filterKeys.map(key => {
                const value = appliedFilters[key];
                let displayText = '';

                switch (key) {
                    case 'search':
                        displayText = `Busca: "${value}"`;
                        break;
                    case 'status':
                        displayText = `Status: ${this.getStatusDisplayName(value)}`;
                        break;
                    case 'startDate':
                        displayText = `A partir de: ${new Date(value).toLocaleDateString('pt-BR')}`;
                        break;
                    case 'endDate':
                        displayText = `Até: ${new Date(value).toLocaleDateString('pt-BR')}`;
                        break;
                    case 'clientId':
                        const client = clientsData.find(c => c.id == value);
                        displayText = `Cliente: ${client ? client.name : value}`;
                        break;
                    case 'paymentMethod':
                        const method = paymentMethodsData.find(p => p.id == value);
                        displayText = `Pagamento: ${method ? method.method : value}`;
                        break;
                    case 'minValue':
                        displayText = `Valor mín: ${formatCurrency(value)}`;
                        break;
                    case 'maxValue':
                        displayText = `Valor máx: ${formatCurrency(value)}`;
                        break;
                    default:
                        displayText = `${key}: ${value}`;
                }

                return `
                    <span class="badge bg-primary me-1 mb-1" style="font-size: 0.875rem;">
                        ${displayText}
                        <button type="button" class="btn-close btn-close-white ms-1" style="font-size: 0.75rem;" onclick="filterManager.removeFilter('${key}')"></button>
                    </span>
                `;
            }).join('');

            container.innerHTML = filterTags + `
                <button class="btn btn-sm btn-outline-secondary ms-2 mb-1" onclick="clearAllFilters()">
                    <i class="bi bi-x-circle me-1"></i>Limpar todos
                </button>
            `;
        },

        getStatusDisplayName(status) {
            const statusMap = {
                'paid': 'Pago',
                'pending': 'Pendente',
                'partial': 'Parcial'
            };
            return statusMap[status] || status;
        },

        async populateFilterOptions() {
            const clientFilter = document.getElementById('advancedClientFilter');
            if (clientFilter && clientsData.length > 0) {
                clientFilter.innerHTML = '<option value="">Todos os clientes</option>' +
                    clientsData.map(client => `<option value="${client.id}">${client.name}</option>`).join('');
            }

            const paymentFilter = document.getElementById('advancedPaymentFilter');
            if (paymentFilter && paymentMethodsData.length > 0) {
                paymentFilter.innerHTML = '<option value="">Todos os métodos</option>' +
                    paymentMethodsData.map(method => `<option value="${method.id}">${method.method}</option>`).join('');
            }

            const productFilter = document.getElementById('advancedProductFilter');
            if (productFilter && productsData.length > 0) {
                productFilter.innerHTML = '<option value="">Todos os produtos</option>' +
                    productsData.map(product => `<option value="${product.id}">${product.name}</option>`).join('');
            }
        }
    };

    const formatCurrency = (value) => {
        const num = Number(value);
        if (isNaN(num)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const parseCurrencyInput = (value) => {
        if (!value || value === '') return 0;
        if (typeof value === 'number') return value;
        
        let cleaned = String(value).replace(/[^\d,.-]/g, '');
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        }
        
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    };

    const formatInputValue = (value) => {
        const num = Number(value);
        if (isNaN(num)) return '0.00';
        return num.toFixed(2);
    };

    // ========== API LAYER ==========
    const api = {
        async request(url, options = {}) {
            for (let attempt = 1; attempt <= CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
                try {
                    const response = await fetch(url, {
                        headers: { 'Content-Type': 'application/json' },
                        ...options
                    });

                    if (response.url.includes('/login') && !url.includes('/login')) {
                        showNotification('Session expired. Please login again.', 'warning');
                        setTimeout(() => window.location.href = '/login', 1500);
                        return null;
                    }

                    if (!response.ok) {
                        if (response.status === 401) {
                            showNotification('Session expired. Please login again.', 'warning');
                            setTimeout(() => window.location.href = '/login', 1500);
                            return null;
                        }
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    return response;
                } catch (error) {
                    if (attempt === CONFIG.MAX_RETRY_ATTEMPTS) throw error;
                    await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
                }
            }
        },

        async get(url) {
            const response = await this.request(url);
            return response ? response.json() : null;
        },

        async post(url, data) {
            const response = await this.request(url, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            return response ? response.json() : null;
        },

        async patch(url, data) {
            const response = await this.request(url, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
            return response ? response.json() : null;
        },

        async delete(url) {
            const response = await this.request(url, { method: 'DELETE' });
            return response ? response.json() : null;
        }
    };

    // ========== NOTIFICATION SYSTEM ==========
    const showNotification = (message, type = 'info', duration = CONFIG.NOTIFICATION_DURATION) => {
        document.querySelectorAll(`.notification.alert-${type}`).forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            <span>${message}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '1100',
            minWidth: '300px',
            maxWidth: '90vw'
        });
        
        document.body.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => notification.remove(), duration);
        }
    };

    // ========== LOADING FUNCTIONS ==========
    const loadData = async () => {
        try {
            const [products, clients, sales, paymentMethods] = await Promise.all([
                api.get('/api/produtos'),
                api.get('/api/clientes'),
                api.get('/api/vendas'),
                api.get('/api/payment-methods')
            ]);

            if (products) productsData = products;
            if (clients) clientsData = clients;
            if (sales) salesData = sales.sales || sales;
            if (paymentMethods) paymentMethodsData = paymentMethods;

            console.log('Data loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load data:', error);
            showNotification('Failed to load data', 'danger');
            return false;
        }
    };

    // ========== CART MANAGEMENT ==========
    const cart = {
        add(productId, quantity = 1) {
            const product = productsData.find(p => p.id === parseInt(productId));
            if (!product) return;

            const existingItem = currentCart.find(item => item.id === productId);
            if (existingItem) {
                existingItem.quantity = Math.min(existingItem.quantity + quantity, product.stock);
            } else {
                const price = product.promo_price || product.current_price || product.original_price || product.price;
                currentCart.push({
                    id: productId,
                    name: product.name,
                    price: price,
                    quantity: Math.min(quantity, product.stock),
                    stock: product.stock
                });
            }

            this.update();
        },

        remove(productId) {
            currentCart = currentCart.filter(item => item.id !== productId);
            this.update();
        },

        updateQuantity(productId, newQuantity) {
            const item = currentCart.find(item => item.id === productId);
            if (item) {
                if (newQuantity <= 0) {
                    this.remove(productId);
                } else {
                    item.quantity = Math.min(newQuantity, item.stock);
                    this.update();
                }
            }
        },

        clear() {
            currentCart = [];
            this.update();
        },

        update() {
            this.render();
            this.calculateTotals();
        },

        render() {
            const cartSummary = document.getElementById('cartSummary');
            if (!cartSummary) return;

            if (currentCart.length === 0) {
                cartSummary.innerHTML = '<p class="text-muted">Carrinho vazio</p>';
                return;
            }

            const cartHtml = currentCart.map(item => `
                <div class="cart-item d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <div class="fw-bold">${item.name}</div>
                        <div class="text-muted">${formatCurrency(item.price)} x 
                            <input type="number" class="form-control d-inline-block" style="width: 60px;" 
                                value="${item.quantity}" min="1" max="${item.stock}"
                                onchange="cart.updateQuantity(${item.id}, this.value)">
                        </div>
                    </div>
                    <div>
                        <div class="fw-bold">${formatCurrency(item.price * item.quantity)}</div>
                        <button class="btn btn-sm btn-outline-danger" onclick="cart.remove(${item.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            cartSummary.innerHTML = cartHtml;
        },

        calculateTotals() {
            const subtotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            const subtotalElement = document.getElementById('subtotalAmount');
            if (subtotalElement) {
                subtotalElement.textContent = formatCurrency(subtotal);
            }
            
            let totalInterest = 0;
            let totalPaid = 0;

            document.querySelectorAll('.payment-method').forEach(select => {
                // Only consider visible payment methods with values
                if (select.value && !select.closest('.d-none')) {
                    const paymentIndex = select.dataset.payment;
                    const amountInput = document.querySelector(`.payment-amount[data-payment="${paymentIndex}"]`);
                    const interestInput = document.querySelector(`.payment-interest[data-payment="${paymentIndex}"]`);
                    
                    if (amountInput && amountInput.value) {
                        // Get base amount from input
                        const baseAmount = parseCurrencyInput(amountInput.value);
                        const interestRate = parseFloat(interestInput?.value || 0);
                        
                        // Determine if this payment method applies interest
                        const method = window.paymentMethodsData?.find(m => m.id === parseInt(select.value)) || 
                                      paymentMethodsData.find(m => m.id === parseInt(select.value));
                                      
                        const isCreditMethod = method && (
                            method.method.toLowerCase().includes('crédito') || 
                            method.method.toLowerCase().includes('credito') ||
                            (method.requires_installments === true)
                        );
                        
                        // Calculate interest if applicable
                        let interest = 0;
                        if (isCreditMethod && interestRate > 0) {
                            interest = baseAmount * (interestRate / 100);
                        }
                        
                        // Add to totals
                        totalPaid += baseAmount;
                        totalInterest += interest;
                    }
                }
            });

            // Calculate final total and remaining amount
            const total = subtotal + totalInterest;
            const remaining = Math.max(0, total - totalPaid);

            // Update displays
            const interestElement = document.getElementById('interestAmount');
            const totalElement = document.getElementById('totalAmount');
            const paidElement = document.getElementById('paidAmount');
            const remainingElement = document.getElementById('remainingAmount');
            const remainingRow = document.getElementById('remainingRow');

            if (interestElement) interestElement.textContent = formatCurrency(totalInterest);
            if (totalElement) totalElement.textContent = formatCurrency(total);
            if (paidElement) paidElement.textContent = formatCurrency(totalPaid);
            if (remainingElement) remainingElement.textContent = formatCurrency(remaining);
            if (remainingRow) remainingRow.style.display = remaining > 0 ? 'flex' : 'none';

            // Auto-fill payment methods based on new total
            this.autoFillPayments(total);
        },

        autoFillPayments(total) {
            const payment1Amount = document.querySelector('.payment-amount[data-payment="1"]');
            const payment2Amount = document.querySelector('.payment-amount[data-payment="2"]');
            const payment2Container = document.getElementById('payment2');
            
            if (!payment1Amount) return;
            
            // Check if payment method 2 is active (visible)
            const payment2Active = payment2Container && !payment2Container.classList.contains('d-none');
            
            if (!payment2Active) {
                // If there's only one payment method, it should get the full amount
                if (!payment1Amount.value || parseCurrencyInput(payment1Amount.value) === 0) {
                    payment1Amount.value = formatInputValue(total);
                }
            } else if (payment2Amount) {
                // Get current values of both payment methods
                const payment1Value = parseCurrencyInput(payment1Amount.value);
                const payment2Value = parseCurrencyInput(payment2Amount.value);
                
                if (payment1Value === 0 && payment2Value === 0) {
                    // If both are empty, split evenly
                    const half = total / 2;
                    payment1Amount.value = formatInputValue(half);
                    payment2Amount.value = formatInputValue(half);
                } else if (payment1Value > 0 && payment2Value === 0) {
                    // If payment 1 has a value but payment 2 doesn't, fill payment 2
                    const remaining = total - payment1Value;
                    if (remaining > 0) {
                        payment2Amount.value = formatInputValue(remaining);
                    }
                } else if (payment2Value > 0 && payment1Value === 0) {
                    // If payment 2 has a value but payment 1 doesn't, fill payment 1
                    const remaining = total - payment2Value;
                    if (remaining > 0) {
                        payment1Amount.value = formatInputValue(remaining);
                    }
                }
            }
        }
    };

    // ========== PAYMENT METHODS ==========
    const payments = {
        setup() {
            document.querySelectorAll('.payment-method').forEach(select => {
                select.innerHTML = '<option value="">Selecione...</option>';
                paymentMethodsData.forEach(method => {
                    const option = document.createElement('option');
                    option.value = method.id;
                    option.textContent = method.method;
                    select.appendChild(option);
                });
            });

            this.attachListeners();
        },

        attachListeners() {
            document.querySelectorAll('.payment-method').forEach(select => {
                // Remove existing listeners first to avoid duplicates
                const newSelect = select.cloneNode(true);
                select.parentNode.replaceChild(newSelect, select);
                newSelect.addEventListener('change', e => this.handleMethodChange(e));
            });

            document.querySelectorAll('.payment-amount').forEach(input => {
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                
                newInput.addEventListener('input', debounce(() => cart.calculateTotals(), 300));
                newInput.addEventListener('blur', () => {
                    const value = parseCurrencyInput(newInput.value);
                    newInput.value = formatInputValue(value);
                    cart.calculateTotals();
                });
            });

            document.querySelectorAll('.payment-interest').forEach(input => {
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                newInput.addEventListener('input', debounce(() => cart.calculateTotals(), 300));
            });
        },

        handleMethodChange(event) {
            const select = event.target;
            const paymentIndex = select.dataset.payment;
            const installmentsSection = document.getElementById(`installments${paymentIndex}`);
            
            if (!installmentsSection) return;

            const method = window.paymentMethodsData?.find(m => m.id === parseInt(select.value)) || 
                          paymentMethodsData.find(m => m.id === parseInt(select.value));
                          
            const isCreditMethod = method && (
                method.method.toLowerCase().includes('crédito') || 
                method.method.toLowerCase().includes('credito') ||
                (method.requires_installments === true)
            );

            if (select.value && isCreditMethod) {
                installmentsSection.classList.remove('d-none');
                installmentsSection.style.display = 'block';
                
                const interestInput = installmentsSection.querySelector('.payment-interest');
                const installmentsSelect = installmentsSection.querySelector('.payment-installments');
                
                if (interestInput) {
                    interestInput.required = true;
                    if (!interestInput.value) interestInput.value = '0';
                }
                if (installmentsSelect) {
                    installmentsSelect.required = true;
                    if (!installmentsSelect.value) installmentsSelect.value = '1';
                }
            } else {
                installmentsSection.classList.add('d-none');
                installmentsSection.style.display = 'none';
                
                // Reset interest to 0 if not a credit method
                const interestInput = installmentsSection.querySelector('.payment-interest');
                if (interestInput) interestInput.value = '0';
            }

            // Trigger totals calculation after a brief delay to allow DOM updates
            setTimeout(() => cart.calculateTotals(), 100);
        },

        add() {
            const payment2 = document.getElementById('payment2');
            if (payment2) {
                payment2.classList.remove('d-none');
                // Auto-calculate totals after showing second payment method
                setTimeout(() => cart.calculateTotals(), 100);
            }
        },

        remove(paymentIndex) {
            const payment = document.getElementById(`payment${paymentIndex}`);
            if (payment) {
                // Reset form fields
                const methodSelect = payment.querySelector('.payment-method');
                const amountInput = payment.querySelector('.payment-amount');
                const installmentsSection = document.getElementById(`installments${paymentIndex}`);
                
                if (methodSelect) methodSelect.value = '';
                if (amountInput) amountInput.value = '';
                
                // Hide installments section if visible
                if (installmentsSection) installmentsSection.classList.add('d-none');
                
                // Hide the payment container
                payment.classList.add('d-none');
                
                // Recalculate totals
                setTimeout(() => cart.calculateTotals(), 100);
            }
        }
    };

    // ========== MODAL MANAGEMENT ==========
    const modal = {
        initializeNewSale() {
            cart.clear();
            this.loadCustomers();
            this.loadProducts();
            payments.setup();
        },

        loadCustomers() {
            const customerSelect = document.getElementById('customerSelect');
            if (customerSelect && clientsData.length > 0) {
                customerSelect.innerHTML = '<option value="">Selecione um cliente...</option>';
                clientsData.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = client.name;
                    customerSelect.appendChild(option);
                });
            }
        },

        loadProducts() {
            const productGrid = document.getElementById('productGrid');
            if (!productGrid || !productsData.length) return;

            const gridHtml = productsData.map(product => {
                const price = product.promo_price || product.current_price || product.original_price || product.price;
                const isOnSale = product.promo_price && product.promo_price < (product.original_price || product.price);
                
                return `
                    <div class="col-md-6 col-lg-4 mb-3">
                        <div class="card product-card h-100" data-product-id="${product.id}">
                            <div class="card-body d-flex flex-column">
                                <h6 class="card-title">${product.name}</h6>
                                <p class="card-text text-muted small">${product.brand_name || 'Sem marca'}</p>
                                ${product.category ? `<span class="badge bg-light text-dark mb-2">${product.category}</span>` : ''}
                                
                                <div class="price-info mb-2">
                                    ${isOnSale ? `<span class="text-decoration-line-through text-muted small">${formatCurrency(product.original_price || product.price)}</span>` : ''}
                                    <div class="h6 mb-0 ${isOnSale ? 'text-danger' : 'text-primary'}">${formatCurrency(price)}</div>
                                </div>
                                
                                <div class="stock-info mb-3">
                                    <small>
                                        <i class="bi bi-box me-1"></i>
                                        Estoque: ${product.stock}
                                        ${product.stock <= 0 ? '<span class="badge bg-danger ms-1">Esgotado</span>' : 
                                        product.stock <= 5 ? '<span class="badge bg-warning ms-1">Baixo</span>' : 
                                        '<span class="badge bg-success ms-1">Disponível</span>'}
                                    </small>
                                </div>
                                
                                <div class="d-grid mt-auto">
                                    <button class="btn ${product.stock <= 0 ? 'btn-secondary' : 'btn-primary'} btn-sm" 
                                            onclick="cart.add(${product.id}, 1)" 
                                            ${product.stock <= 0 ? 'disabled' : ''}>
                                        <i class="bi bi-${product.stock <= 0 ? 'x-circle' : 'cart-plus'} me-1"></i>
                                        ${product.stock <= 0 ? 'Sem Estoque' : 'Adicionar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            productGrid.innerHTML = gridHtml;
        },

        setupProductSearch() {
            const productSearch = document.getElementById('productSearch');
            if (productSearch) {
                productSearch.addEventListener('input', debounce((e) => {
                    const searchTerm = e.target.value.toLowerCase().trim();
                    this.filterProducts(searchTerm);
                }, 300));
            }
        },

        filterProducts(searchTerm) {
            if (!searchTerm) {
                this.loadProducts();
                return;
            }

            const filtered = productsData.filter(product => {
                return product.name.toLowerCase().includes(searchTerm) ||
                       (product.brand_name && product.brand_name.toLowerCase().includes(searchTerm)) ||
                       (product.category && product.category.toLowerCase().includes(searchTerm));
            });

            this.displayFilteredProducts(filtered);
        },

        displayFilteredProducts(products) {
            const productGrid = document.getElementById('productGrid');
            if (!productGrid) return;

            if (products.length === 0) {
                productGrid.innerHTML = `
                    <div class="col-12">
                        <div class="text-center py-4">
                            <i class="bi bi-search h1 text-muted"></i>
                            <p class="text-muted">Nenhum produto encontrado</p>
                            <button class="btn btn-outline-primary btn-sm" onclick="modal.loadProducts()">
                                Limpar busca
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            // Use the same product display logic as loadProducts
            const gridHtml = products.map(product => {
                const price = product.promo_price || product.current_price || product.original_price || product.price;
                const isOnSale = product.promo_price && product.promo_price < (product.original_price || product.price);
                
                return `
                    <div class="col-md-6 col-lg-4 mb-3">
                        <div class="card product-card h-100" data-product-id="${product.id}">
                            <div class="card-body d-flex flex-column">
                                <h6 class="card-title">${product.name}</h6>
                                <p class="card-text text-muted small">${product.brand_name || 'Sem marca'}</p>
                                
                                <div class="price-info mb-2">
                                    ${isOnSale ? `<span class="text-decoration-line-through text-muted small">${formatCurrency(product.original_price || product.price)}</span>` : ''}
                                    <div class="h6 mb-0 ${isOnSale ? 'text-danger' : 'text-primary'}">${formatCurrency(price)}</div>
                                </div>
                                
                                <div class="d-grid mt-auto">
                                    <button class="btn ${product.stock <= 0 ? 'btn-secondary' : 'btn-primary'} btn-sm" 
                                            onclick="cart.add(${product.id}, 1)" 
                                            ${product.stock <= 0 ? 'disabled' : ''}>
                                        <i class="bi bi-${product.stock <= 0 ? 'x-circle' : 'cart-plus'} me-1"></i>
                                        ${product.stock <= 0 ? 'Sem Estoque' : 'Adicionar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            productGrid.innerHTML = gridHtml;
        }
    };

    // ========== SALE SUBMISSION ==========
    const submitSale = async () => {
        try {
            // Validation
            if (currentCart.length === 0) {
                showNotification('Adicione pelo menos um produto ao carrinho', 'warning');
                return;
            }

            const customerSelect = document.getElementById('customerSelect');
            if (!customerSelect || !customerSelect.value) {
                showNotification('Selecione um cliente', 'warning');
                return;
            }

            const payments = [];
            let hasValidPayment = false;
            let totalPaid = 0;

            document.querySelectorAll('.payment-method').forEach(select => {
                if (select.value && !select.closest('.d-none')) {
                    const paymentIndex = select.dataset.payment;
                    const amountInput = document.querySelector(`.payment-amount[data-payment="${paymentIndex}"]`);
                    const installmentsSelect = document.querySelector(`.payment-installments[data-payment="${paymentIndex}"]`);
                    const interestInput = document.querySelector(`.payment-interest[data-payment="${paymentIndex}"]`);

                    if (amountInput && amountInput.value) {
                        const amount = parseCurrencyInput(amountInput.value);
                        if (amount > 0) {
                            const method = paymentMethodsData.find(m => m.id === parseInt(select.value));
                            const isCredit = method && (
                                method.method.toLowerCase().includes('crédito') || 
                                method.method.toLowerCase().includes('credito') ||
                                (method.requires_installments === true)
                            );
                            
                            const interestRate = isCredit ? parseFloat(interestInput?.value || 0) : 0;
                            
                            payments.push({
                                method: select.value,
                                amount: amount,
                                installments: isCredit ? parseInt(installmentsSelect?.value || 1) : 1,
                                interest: interestRate,
                                isCredit: isCredit
                            });
                            
                            totalPaid += amount;
                            hasValidPayment = true;
                        }
                    }
                }
            });

            if (!hasValidPayment) {
                showNotification('Configure pelo menos um método de pagamento válido', 'warning');
                return;
            }

            // Calculate subtotal and total with interest
            const subtotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let totalInterest = 0;
            
            // Calculate total interest
            payments.forEach(payment => {
                if (payment.isCredit && payment.interest > 0) {
                    const interestAmount = payment.amount * (payment.interest / 100);
                    totalInterest += interestAmount;
                }
            });
            
            const total = subtotal + totalInterest;

            // Validate total payment equals total with interest
            if (Math.abs(totalPaid - total) > 0.01) {
                showNotification(`Valor total pago (${formatCurrency(totalPaid)}) deve ser igual ao total com juros (${formatCurrency(total)})`, 'warning');
                return;
            }

            showLoading();

            const saleData = {
                clientId: customerSelect.value,
                saleDate: new Date().toISOString().split('T')[0],
                products: currentCart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price
                })),
                payments: payments
            };

            const result = await api.post('/api/vendas', saleData);

            if (result) {
                showNotification('Venda registrada com sucesso!', 'success');
                
                const modalElement = bootstrap.Modal.getInstance(document.getElementById('newSaleModal'));
                if (modalElement) modalElement.hide();
                
                cart.clear();
                await refreshAnalytics();
                await refreshSales();
                setTimeout(() => {
                    // Check if function exists before calling
                    if (typeof updateMonthlyProfit === 'function') {
                        updateMonthlyProfit();
                    } else {
                        console.error("updateMonthlyProfit function not found");
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Sale submission error:', error);
            showNotification(`Erro ao registrar venda: ${error.message}`, 'danger');
        } finally {
            hideLoading();
        }
    };

    // ========== SALES TABLE ==========
    const salesTable = {
        update() {
            const tbody = document.querySelector('#salesTableBody');
            const paginationStats = document.getElementById('paginationStats');
            
            if (!tbody) return;

            if (!salesData || salesData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhuma venda encontrada</td></tr>';
                if (paginationStats) {
                    paginationStats.textContent = 'Nenhuma venda encontrada';
                }
                return;
            }

            const tableHtml = salesData.map(sale => {
                const saleDate = new Date(sale.sale_date).toLocaleDateString('pt-BR');
                const products = Array.isArray(sale.products) ? sale.products : [];
                const paymentMethods = Array.isArray(sale.payment_methods) ? sale.payment_methods : [];
                
                let paymentStatus = 'Pendente';
                let statusClass = 'warning';
                
                if (paymentMethods.length > 0) {
                    const allPaid = paymentMethods.every(payment => 
                        payment.parcels ? payment.parcels.every(parcel => parcel.paid) : payment.paid
                    );
                    
                    if (allPaid) {
                        paymentStatus = 'Pago';
                        statusClass = 'success';
                    }
                }
                
                return `
                    <tr>
                        <td>
                            <input type="checkbox" class="form-check-input sale-checkbox" value="${sale.id}">
                        </td>
                        <td>
                            <div class="d-flex flex-column">
                                <span class="fw-bold">#${sale.id}</span>
                                <small class="text-muted">${saleDate}</small>
                            </div>
                        </td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="avatar bg-primary text-white rounded-circle me-2" style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 12px;">
                                    ${sale.client_name ? sale.client_name.substring(0, 2).toUpperCase() : 'SC'}
                                </div>
                                <div>
                                    <div class="fw-bold">${sale.client_name || 'Cliente não especificado'}</div>
                                </div>
                            </div>
                        </td>
                        <td>
                            ${products.map(product => `
                                <div class="badge bg-secondary me-1">${product.quantity}x ${product.name}</div>
                            `).join('')}
                        </td>
                        <td>
                            ${paymentMethods.map(payment => `
                                <div class="badge bg-info mb-1">
                                    <strong>${payment.method}:</strong> ${formatCurrency(payment.amount)}
                                    ${payment.paid ? '<i class="bi bi-check-circle-fill text-success ms-1"></i>' : ''}
                                </div>
                            `).join('')}
                        </td>
                        <td class="fw-bold">${formatCurrency(sale.total)}</td>
                        <td>
                            <span class="badge bg-${statusClass}">
                                <i class="bi bi-${statusClass === 'success' ? 'check-circle' : 'clock'} me-1"></i>
                                ${paymentStatus}
                            </span>
                        </td>
                        <td>
                            <div class="btn-group" role="group">
                                <button class="btn btn-sm btn-outline-primary" onclick="viewSale(${sale.id})" title="Visualizar">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-success" onclick="duplicateSale(${sale.id})" title="Duplicar">
                                    <i class="bi bi-files"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteSale(${sale.id})" title="Excluir">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = tableHtml;
            
            // Update pagination stats
            if (paginationStats) {
                const start = ((currentPage - 1) * CONFIG.PAGINATION_SIZE) + 1;
                const end = Math.min(currentPage * CONFIG.PAGINATION_SIZE, salesData.length);
                const total = salesData.length;
                paginationStats.textContent = `Mostrando ${start}-${end} de ${total} vendas`;
            }
            
            this.setupEventListeners();
        },

        setupEventListeners() {
            const selectAllCheckbox = document.getElementById('selectAllSales');
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', function() {
                    const checkboxes = document.querySelectorAll('.sale-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = this.checked;
                    });
                    updateBulkActionsVisibility();
                });
            }

            document.querySelectorAll('.sale-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', updateBulkActionsVisibility);
            });
        }
    };

    // ========== BULK ACTIONS ==========
    function updateBulkActionsVisibility() {
        const selectedCheckboxes = document.querySelectorAll('.sale-checkbox:checked');
        const bulkActionsPanel = document.getElementById('bulkActionsPanel');
        const selectedCount = document.getElementById('selectedCount');
        const bulkDeleteBtn = document.querySelector('button[onclick="bulkDelete()"]');
        
        if (selectedCheckboxes.length > 0) {
            if (bulkActionsPanel) bulkActionsPanel.classList.remove('d-none');
            if (selectedCount) selectedCount.textContent = selectedCheckboxes.length;
            if (bulkDeleteBtn) bulkDeleteBtn.removeAttribute('disabled');
        } else {
            if (bulkActionsPanel) bulkActionsPanel.classList.add('d-none');
            if (bulkDeleteBtn) bulkDeleteBtn.setAttribute('disabled', 'disabled');
        }
    }

    const bulkMarkPaid = async () => {
        const selectedCheckboxes = document.querySelectorAll('.sale-checkbox:checked');
        const saleIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        
        if (saleIds.length === 0) {
            showNotification('Selecione pelo menos uma venda', 'warning');
            return;
        }
        
        if (!confirm(`Marcar ${saleIds.length} venda${saleIds.length > 1 ? 's' : ''} como paga${saleIds.length > 1 ? 's' : ''}?`)) {
            return;
        }
        
        try {
            showLoading();
            
            const result = await api.post('/api/acoes-lote/marcar-parcelas', {
                saleIds: saleIds,
                action: 'pay'
            });
            
            if (result) {
                showNotification(result.message || 'Vendas processadas com sucesso', 'success');
                
                document.querySelectorAll('.sale-checkbox').forEach(cb => cb.checked = false);
                const selectAll = document.getElementById('selectAllSales');
                if (selectAll) selectAll.checked = false;
                
                updateBulkActionsVisibility();
                await loadSalesData();
            }
        } catch (error) {
            console.error('Erro ao marcar vendas como pagas:', error);
            showNotification('Erro ao marcar vendas como pagas: ' + error.message, 'danger');
        } finally {
            hideLoading();
        }
    };

    window.bulkDelete = async () => {
        const selectedCheckboxes = document.querySelectorAll('.sale-checkbox:checked');
        const saleIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        
        if (saleIds.length === 0) {
            showNotification('Selecione pelo menos uma venda para excluir', 'warning');
            return;
        }
        
        const confirmModal = new bootstrap.Modal(document.getElementById('confirmationModal') || createConfirmationModal());
        
        // Update modal content
        document.getElementById('confirmModalTitle').textContent = 'Confirmar Exclusão em Massa';
        document.getElementById('confirmModalBody').innerHTML = `
            <div class="text-center mb-4">
                <i class="bi bi-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
            </div>
            <p class="mb-1">Você está prestes a excluir <strong>${saleIds.length}</strong> venda${saleIds.length > 1 ? 's' : ''}.</p>
            <p class="text-danger mb-3">Esta ação não pode ser desfeita!</p>
            <div class="alert alert-warning">
                <small>
                    <i class="bi bi-info-circle me-1"></i>
                    Esta ação irá restaurar o estoque dos produtos vendidos e ajustar os débitos dos clientes.
                </small>
            </div>
        `;
        
        // Set up confirmation button
        const confirmBtn = document.getElementById('confirmModalBtn');
        confirmBtn.textContent = 'Excluir Vendas';
        confirmBtn.className = 'btn btn-danger';
        confirmBtn.onclick = async () => {
            confirmModal.hide();
            await executeBulkDelete(saleIds);
        };
        
        confirmModal.show();
    };

    // Function to create confirmation modal if it doesn't exist
    function createConfirmationModal() {
        const modalHtml = `
            <div class="modal fade" id="confirmationModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmModalTitle">Confirmar Ação</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="confirmModalBody">
                            <!-- Content will be set dynamically -->
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger" id="confirmModalBtn">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        return new bootstrap.Modal(document.getElementById('confirmationModal'));
    }

    // Function to execute the bulk delete operation
    async function executeBulkDelete(saleIds) {
        const progress = showProgressBar('Excluindo vendas...');
        
        try {
            progress.update(10, 'Enviando solicitação...');
            
            const response = await fetch('/api/vendas/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ saleIds })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao excluir vendas');
            }
            
            progress.update(50, 'Processando resposta...');
            const result = await response.json();
            
            progress.update(75, 'Atualizando interface...');
            
            // Clear checkboxes
            document.querySelectorAll('.sale-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('selectAllSales').checked = false;
            
            // Hide bulk actions
            updateBulkActionsVisibility();
            
            progress.update(90, 'Recarregando dados...');
            
            // Refresh sales data
            await loadSalesData();
            await refreshAnalytics();
            
            progress.update(100, 'Concluído!');
            
            // Show success notification
            showNotification(result.message, 'success');
            
            // Update monthly profit with delay
            setTimeout(() => {
                if (typeof updateMonthlyProfit === 'function') {
                    updateMonthlyProfit();
                }
            }, 1500);
            
        } catch (error) {
            console.error('Error executing bulk delete:', error);
            showNotification(`Erro ao excluir vendas: ${error.message}`, 'danger');
        } finally {
            setTimeout(() => {
                progress.finish();
            }, 500);
        }
    }

    // Add a progress indicator for bulk operations
    function showProgressBar(message = 'Processando...') {
        hideLoading(); // Remove any existing loaders
        
        const progressHtml = `
            <div id="progressOverlay" class="overlay-loading">
                <div class="card" style="width: 300px;">
                    <div class="card-body text-center">
                        <h5 class="card-title mb-3">${message}</h5>
                        <div class="progress mb-3">
                            <div id="progressBar" class="progress-bar progress-bar-striped progress-bar-animated" 
                                style="width: 0%"></div>
                        </div>
                        <div id="progressText">Iniciando...</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', progressHtml);
        
        return {
            update: (percent, text) => {
                const bar = document.getElementById('progressBar');
                const textEl = document.getElementById('progressText');
                if (bar) bar.style.width = `${percent}%`;
                if (textEl) textEl.textContent = text;
            },
            finish: () => {
                document.getElementById('progressOverlay')?.remove();
            }
        };
    }

    // ========== SALE OPERATIONS ==========
    const viewSale = async (saleId) => {
        try {
            const sale = await api.get(`/api/vendas/${saleId}`);
            if (!sale) return;
            
            const modalHtml = `
                <div class="modal fade" id="viewSaleModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Detalhes da Venda #${saleId}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>Cliente:</strong> ${sale.client_name}</p>
                                        <p><strong>Data:</strong> ${new Date(sale.sale_date).toLocaleDateString('pt-BR')}</p>
                                        <p><strong>Total:</strong> ${formatCurrency(sale.total)}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Produtos:</h6>
                                        ${sale.products ? sale.products.map(product => `
                                            <p>${product.quantity}x ${product.name} - ${formatCurrency(product.unit_price)}</p>
                                        `).join('') : ''}
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h6>Métodos de Pagamento e Parcelas:</h6>
                                        ${sale.payment_methods ? sale.payment_methods.map(payment => `
                                            <div class="card mb-2">
                                                <div class="card-body">
                                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                                        <strong>${payment.method}: ${formatCurrency(payment.amount)}</strong>
                                                        <span class="badge bg-${payment.parcels && payment.parcels.every(p => p.paid) ? 'success' : 'warning'}">
                                                            ${payment.parcels && payment.parcels.every(p => p.paid) ? 'Pago' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                    ${payment.parcels ? payment.parcels.map((parcel, index) => `
                                                        <div class="d-flex justify-content-between align-items-center border-top pt-2 ${index === 0 ? 'border-top-0 pt-0' : ''}">
                                                            <span>Parcela ${parcel.number}: ${formatCurrency(parcel.value)}</span>
                                                            <div class="d-flex align-items-center">
                                                                <small class="text-muted me-2">Venc: ${new Date(parcel.due_date).toLocaleDateString('pt-BR')}</small>
                                                                ${parcel.paid ? 
                                                                    `<span class="badge bg-success">Pago</span>` :
                                                                    `<button class="btn btn-sm btn-success" onclick="markInstallmentPaid(${parcel.id})">
                                                                        <i class="bi bi-check-circle me-1"></i>Marcar como Pago
                                                                    </button>`
                                                                }
                                                            </div>
                                                        </div>
                                                    `).join('') : ''}
                                                </div>
                                            </div>
                                        `).join('') : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('viewSaleModal'));
            modal.show();
        } catch (error) {
            showNotification('Erro ao carregar detalhes da venda', 'danger');
        }
    };

    // Mark installment as paid function
    const markInstallmentPaid = async (installmentId) => {
        if (!confirm('Tem certeza que deseja marcar esta parcela como paga?')) {
            return;
        }
        
        try {
            showLoading();
            const result = await api.patch(`/api/installments/${installmentId}/pay`);
            
            if (result) {
                showNotification('Parcela marcada como paga com sucesso!', 'success');
                
                // Close the modal and refresh the sales data
                const modal = bootstrap.Modal.getInstance(document.getElementById('viewSaleModal'));
                if (modal) modal.hide();
                
                await refreshSales();

                console.log('Updating monthly profit after paying installment');
                if (typeof scheduleUpdateMonthlyProfit === 'function') {
                    scheduleUpdateMonthlyProfit(1000); // Delay of 1 second
                } else if (typeof updateMonthlyProfit === 'function') {
                    setTimeout(updateMonthlyProfit, 1000);
                }
            }
        } catch (error) {
            console.error('Error marking installment as paid:', error);
            showNotification('Erro ao marcar parcela como paga: ' + error.message, 'danger');
        } finally {
            hideLoading();
        }
    };

    // Make markInstallmentPaid globally available
    window.markInstallmentPaid = markInstallmentPaid;

    const duplicateSale = async (saleId) => {
        try {
            const sale = await api.get(`/api/vendas/${saleId}`);
            if (!sale) return;
            
            const modalElement = new bootstrap.Modal(document.getElementById('newSaleModal'));
            modalElement.show();
            
            setTimeout(() => {
                if (sale.client_id) {
                    const customerSelect = document.getElementById('customerSelect');
                    if (customerSelect) customerSelect.value = sale.client_id;
                }
                
                if (sale.products) {
                    sale.products.forEach(product => {
                        cart.add(product.id, product.quantity);
                    });
                }
            }, 500);
        } catch (error) {
            showNotification('Erro ao duplicar venda', 'danger');
        }
    };

    const deleteSale = async (saleId) => {
        if (!confirm('Tem certeza que deseja excluir esta venda?')) {
            return;
        }
        
        try {
            showLoading();
            const result = await api.delete(`/api/vendas/${saleId}`);
            
            if (result) {
                showNotification('Venda excluída com sucesso', 'success');
                await loadSalesData();
                
                // Important: Update the monthly profit after deletion
                console.log('Updating monthly profit after sale deletion');
                if (typeof scheduleUpdateMonthlyProfit === 'function') {
                    scheduleUpdateMonthlyProfit(1000);
                } else if (typeof updateMonthlyProfit === 'function') {
                    setTimeout(updateMonthlyProfit, 1000);
                }
            }
        } catch (error) {
            console.error('Failed to delete sale:', error);
            showNotification('Falha ao excluir venda', 'danger');
        } finally {
            hideLoading();
        }
    };

    // ========== LOADING STATE ==========
    const showLoading = () => {
        hideLoading();
        
        const loader = document.createElement('div');
        loader.className = 'overlay-loading';
        loader.id = 'globalLoader';
        loader.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.9); display: flex;
            justify-content: center; align-items: center; z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        loader.innerHTML = `
            <div class="d-flex flex-column align-items-center">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted">Processando...</div>
            </div>
        `;
        
        document.body.appendChild(loader);
        setTimeout(hideLoading, 10000); // Failsafe to prevent loader being stuck
    };

    const hideLoading = () => {
        document.querySelectorAll('.overlay-loading, #globalLoader').forEach(loader => {
            try {
                if (loader && loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                }
            } catch (e) {
                console.warn('Error removing loader:', e);
            }
        });
    };

    // ========== NOTIFICATIONS ==========
    const loadNotifications = async () => {
        try {
            const notification = await api.get('/api/notifications');
            if (!notification) return;
            
            const notificationText = document.getElementById('notificationText');
            const notificationBar = document.querySelector('.notification-bar');
            
            if (notificationText && notificationBar) {
                notificationText.textContent = notification.message;
                notificationBar.className = `notification-bar alert-${notification.type}`;
                
                const icon = notificationBar.querySelector('i');
                if (icon) {
                    icon.className = `bi ${notification.icon} me-2`;
                }
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
            const notificationText = document.getElementById('notificationText');
            if (notificationText) {
                notificationText.textContent = 'Bem-vindo ao sistema de vendas!';
            }
        }
    };

    // ========== ANALYTICS FUNCTIONS ==========
    const loadAnalyticsData = async () => {
        try {
            console.log('Loading analytics data...');
            
            const [
                salesTodayResult,
                conversionResult,
                topProductsResult,
                revenueTrendResult,
                paymentMethodsResult,
                clientInsightsResult
            ] = await Promise.allSettled([
                api.get('/api/analytics/sales-today'),
                api.get('/api/analytics/conversion'),
                api.get('/api/analytics/top-products?limit=3'),
                api.get('/api/analytics/revenue-trend?days=7'),
                api.get('/api/analytics/payment-methods?days=30'),
                api.get('/api/analytics/client-insights')
            ]);

            // Handle each result with proper error checking
            if (salesTodayResult.status === 'fulfilled' && salesTodayResult.value) {
                updateSalesTodayDisplay(salesTodayResult.value);
            } else {
                console.warn('Sales today data failed:', salesTodayResult.reason);
                // Set default values
                const salesTodayElement = document.getElementById('salesToday');
                if (salesTodayElement) salesTodayElement.textContent = '0';
            }

            if (conversionResult.status === 'fulfilled' && conversionResult.value) {
                updateConversionDisplay(conversionResult.value);
            } else {
                console.warn('Conversion data failed:', conversionResult.reason);
            }

            if (topProductsResult.status === 'fulfilled' && topProductsResult.value) {
                updateTopProductsDisplay(topProductsResult.value);
            } else {
                console.warn('Top products data failed:', topProductsResult.reason);
            }

            if (revenueTrendResult.status === 'fulfilled' && revenueTrendResult.value) {
                updateRevenueTrendDisplay(revenueTrendResult.value);
            } else {
                console.warn('Revenue trend data failed:', revenueTrendResult.reason);
                updateRevenueTrendDisplay([]); // Pass empty array to show default
            }

            if (paymentMethodsResult.status === 'fulfilled' && paymentMethodsResult.value) {
                updatePaymentMethodsDisplay(paymentMethodsResult.value);
            } else {
                console.warn('Payment methods data failed:', paymentMethodsResult.reason);
            }

            if (clientInsightsResult.status === 'fulfilled' && clientInsightsResult.value) {
                updateClientInsightsDisplay(clientInsightsResult.value);
            } else {
                console.warn('Client insights data failed:', clientInsightsResult.reason);
                updateClientInsightsDisplay(null); // Pass null to show error state
            }

            console.log('✅ Analytics data loaded successfully');

        } catch (error) {
            console.error('Error loading analytics data:', error);
            showNotification('Erro ao carregar dados de analytics', 'warning');
        }
    };

    const updateSalesTodayDisplay = (data) => {
        const salesTodayElement = document.getElementById('salesToday');
        const salesChangeElement = document.querySelector('[data-metric="sales-change"]');
        const revenueElement = document.querySelector('[data-metric="revenue-today"]');
        const revenueChangeElement = document.querySelector('[data-metric="revenue-change"]');

        if (salesTodayElement) {
            animateCounter(salesTodayElement, data.sales_count);
        }

        if (salesChangeElement) {
            const changeText = data.sales_change >= 0 ? `+${data.sales_change}%` : `${data.sales_change}%`;
            const changeClass = data.sales_change >= 0 ? 'text-success' : 'text-danger';
            const icon = data.sales_change >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
            
            salesChangeElement.innerHTML = `
                <i class="bi ${icon} ${changeClass}"></i>
                <span class="${changeClass}">${changeText} vs ontem</span>
            `;
        }

        if (revenueElement) {
            revenueElement.textContent = formatCurrency(data.total_revenue);
        }

        if (revenueChangeElement) {
            const changeText = data.revenue_change >= 0 ? `+${data.revenue_change}%` : `${data.revenue_change}%`;
            const changeClass = data.revenue_change >= 0 ? 'text-success' : 'text-danger';
            const icon = data.revenue_change >= 0 ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
            
            revenueChangeElement.innerHTML = `
                <i class="bi ${icon} ${changeClass}"></i>
                <span class="${changeClass}">${changeText} vs ontem</span>
            `;
        }
    };

    const updateConversionDisplay = (data) => {
        const conversionElement = document.querySelector('[data-metric="conversion-rate"]');
        const conversionChangeElement = document.querySelector('[data-metric="conversion-change"]');

        if (conversionElement) {
            animateCounter(conversionElement, data.conversion_rate, '%');
        }

        if (conversionChangeElement) {
            const changeText = data.target_diff >= 0 ? `+${data.target_diff}%` : `${data.target_diff}%`;
            const changeClass = data.target_diff >= 0 ? 'text-success' : 'text-warning';
            const icon = data.target_diff >= 0 ? 'bi-target' : 'bi-exclamation-triangle';
            
            conversionChangeElement.innerHTML = `
                <i class="bi ${icon} ${changeClass}"></i>
                <span class="${changeClass}">${changeText} vs meta</span>
            `;
        }
    };

    const updateTopProductsDisplay = (data) => {
        const container = document.querySelector('[data-section="top-products"]');
        if (!container) return;

        const html = data.map(product => `
            <div class="d-flex align-items-center mb-2">
                <i class="bi bi-fire me-2 text-danger"></i>
                <div class="flex-grow-1">
                    <div class="fw-bold">${product.product_name}</div>
                    <small class="text-muted">${product.brand_name} - ${product.total_quantity} vendidos</small>
                </div>
                <div class="text-end">
                    <div class="fw-bold">${formatCurrency(product.total_revenue)}</div>
                    <small class="text-muted">${product.sales_count} vendas</small>
                </div>
            </div>
        `).join('');

        container.innerHTML = html || '<p class="text-muted">Nenhum produto vendido recentemente</p>';
    };

    const updateRevenueTrendDisplay = (data) => {
        const container = document.querySelector('[data-section="revenue-trend"]');
        if (!container) return;

        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <div class="h4 mb-1">R$ 0,00</div>
                    <small class="text-muted">Nenhuma venda no período</small>
                    <div class="mt-2">
                        <span class="badge bg-secondary">0%</span>
                    </div>
                </div>
            `;
            return;
        }

        const totalRevenue = data.reduce((sum, day) => sum + (day.revenue || 0), 0);
        const avgDaily = data.length > 0 ? totalRevenue / data.length : 0;
        
        // Calculate trend properly
        let trend = 0;
        if (data.length > 1) {
            const firstHalf = data.slice(0, Math.floor(data.length / 2));
            const secondHalf = data.slice(Math.floor(data.length / 2));
            
            const firstHalfAvg = firstHalf.reduce((sum, day) => sum + (day.revenue || 0), 0) / firstHalf.length;
            const secondHalfAvg = secondHalf.reduce((sum, day) => sum + (day.revenue || 0), 0) / secondHalf.length;
            
            if (firstHalfAvg > 0) {
                trend = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100);
            } else if (secondHalfAvg > 0) {
                trend = 100; // If we had no sales before but have sales now
            }
        }

        // Ensure trend is a valid number
        if (isNaN(trend) || !isFinite(trend)) {
            trend = 0;
        }

        container.innerHTML = `
            <div class="text-center">
                <div class="h4 mb-1">${formatCurrency(avgDaily)}</div>
                <small class="text-muted">Média diária (${data.length} dias)</small>
                <div class="mt-2">
                    <span class="badge bg-${trend >= 0 ? 'success' : 'danger'}">
                        <i class="bi bi-${trend >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                        ${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%
                    </span>
                </div>
            </div>
        `;
    };

    const updatePaymentMethodsDisplay = (data) => {
        const container = document.querySelector('[data-section="payment-methods"]');
        if (!container) return;

        const html = data.slice(0, 3).map(method => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <span class="fw-bold">${method.method}</span>
                    <div class="progress" style="height: 4px; width: 100px;">
                        <div class="progress-bar" style="width: ${method.percentage}%"></div>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold">${method.percentage}%</div>
                    <small class="text-muted">${method.count} usos</small>
                </div>
            </div>
        `).join('');

        container.innerHTML = html || '<p class="text-muted">Nenhum método de pagamento usado</p>';
    };

    const updateClientInsightsDisplay = (data) => {
        const container = document.querySelector('[data-metric="active-clients"]');
        const changeContainer = document.querySelector('[data-metric="client-growth"]');
        
        if (!container) return;

        if (!data || typeof data !== 'object') {
            container.textContent = '0';
            if (changeContainer) {
                changeContainer.innerHTML = '<span class="text-muted">Dados indisponíveis</span>';
            }
            return;
        }

        // Animate the counter
        animateCounter(container, data.active_clients || 0);
        
        if (changeContainer) {
            const rate = data.activity_rate || 0;
            const rateClass = rate >= 70 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-danger';
            const icon = rate >= 70 ? 'bi-arrow-up-right' : rate >= 50 ? 'bi-dash' : 'bi-arrow-down-right';
            
            changeContainer.innerHTML = `
                <i class="bi ${icon} ${rateClass}"></i>
                <span class="${rateClass}">${rate}% atividade</span>
            `;
        }
    };

    const animateCounter = (element, targetValue, suffix = '') => {
        if (!element) return;
        
        const startValue = 0;
        const duration = 1500;
        const startTime = Date.now();
        
        const updateCounter = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (targetValue - startValue) * easeOut;
            
            if (suffix === '%') {
                element.textContent = Math.round(currentValue * 10) / 10 + suffix;
            } else {
                element.textContent = Math.floor(currentValue) + suffix;
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = targetValue + suffix;
            }
        };
        
        updateCounter();
    };

    // ========== PAYMENT METHODS ==========
    window.loadPaymentMethodsData = async function() {
        try {
            const response = await fetch('/api/payment-methods');
            if (response.ok) {
                const methods = await response.json();
                window.paymentMethodsData = methods;
                console.log('Payment methods data loaded:', methods.length, 'methods');
                return methods;
            } else {
                console.error('Failed to load payment methods:', response.status);
                return [];
            }
        } catch (error) {
            console.error('Error loading payment methods data:', error);
            return [];
        }
    };

    async function loadPaymentMethods() {
        try {
            const response = await fetch('/api/payment-methods');
            const methods = await response.json();
            
            const container = document.getElementById('paymentMethodsList');
            if (!container) return;
            container.innerHTML = '';
            
            if (methods.length === 0) {
                container.innerHTML = '<div class="alert alert-info">Nenhum método de pagamento encontrado</div>';
                return;
            }
            
            // Store payment methods in global variable for reference in other functions
            window.paymentMethodsData = methods;
            
            methods.forEach(method => {
                const methodItem = document.createElement('div');
                methodItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                
                const badgeClass = method.is_system_default ? 'bg-secondary' : 'bg-primary';
                const badgeText = method.is_system_default ? 'Padrão' : 'Personalizado';
                
                methodItem.innerHTML = `
                    <div>
                        <strong>${method.method}</strong>
                        <span class="badge ${badgeClass} ms-2">${badgeText}</span>
                        ${method.requires_installments ? 
                            '<span class="badge bg-info ms-1">Parcelável</span>' : ''}
                    </div>
                    <div>
                        ${!method.is_system_default ? `
                            <button class="btn btn-sm btn-outline-danger" 
                                    onclick="deletePaymentMethod(${method.id}, '${method.method}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
                container.appendChild(methodItem);
            });
            
        } catch (error) {
            console.error('Error loading payment methods:', error);
            showNotification('Erro ao carregar métodos de pagamento', 'danger');
        }
    }

    // Add payment method
    async function addPaymentMethod() {
        const nameInput = document.getElementById('newPaymentMethodName');
        const requiresInstallments = document.getElementById('requiresInstallments').checked;
        const name = nameInput.value.trim();
        
        if (!name) {
            showNotification('Digite o nome do método de pagamento', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/payment-methods', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    method: name,
                    requires_installments: requiresInstallments 
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao criar método de pagamento');
            }
            
            nameInput.value = '';
            document.getElementById('requiresInstallments').checked = false;
            showNotification('Método de pagamento criado com sucesso!', 'success');
            
            // Reload payment methods and update dropdowns
            await loadPaymentMethods();
            if (window.payments && typeof window.payments.setup === 'function') {
                window.payments.setup();
            }
            
        } catch (error) {
            showNotification(error.message, 'danger');
        }
    }

    // Delete payment method
    async function deletePaymentMethod(methodId, methodName) {
        if (!confirm(`Tem certeza que deseja excluir o método "${methodName}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/payment-methods/${methodId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao excluir método de pagamento');
            }
            
            showNotification('Método de pagamento excluído com sucesso!', 'success');
            
            // Reload payment methods and update dropdowns
            await loadPaymentMethods();
            if (window.payments && typeof window.payments.setup === 'function') {
                window.payments.setup();
            }
            
        } catch (error) {
            showNotification(error.message, 'danger');
        }
    }

    // Create a function to properly handle the payment methods modal
    function createPaymentMethodsModal() {
        // Check if a modal already exists in the DOM
        let modalElement = document.getElementById('paymentMethodsModal');
        
        // If not found, we need to create it from scratch
        if (!modalElement) {
            console.log('Creating new payment methods modal element');
            const modalHTML = `
                <div class="modal fade" id="paymentMethodsModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title">
                                    <i class="bi bi-credit-card me-2"></i>Métodos de Pagamento
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-md-8">
                                        <input type="text" id="newPaymentMethodName" class="form-control" 
                                            placeholder="Nome do método de pagamento">
                                    </div>
                                    <div class="col-md-4">
                                        <button class="btn btn-primary w-100" onclick="addPaymentMethod()">
                                            <i class="bi bi-plus-circle me-2"></i>Adicionar
                                        </button>
                                    </div>
                                </div>
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" id="requiresInstallments">
                                    <label class="form-check-label" for="requiresInstallments">
                                        Permite parcelamento
                                    </label>
                                </div>
                                <div id="paymentMethodsList" class="list-group">
                                    <!-- Payment methods will be loaded here -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Append to the body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            modalElement = document.getElementById('paymentMethodsModal');
        }
        
        return modalElement;
    }

    // Function to remove a payment method from the form
    function removePaymentMethod(paymentIndex) {
        const payment = document.getElementById(`payment${paymentIndex}`);
        if (payment) {
            // Reset form fields
            const methodSelect = payment.querySelector('.payment-method');
            const amountInput = payment.querySelector('.payment-amount');
            const installmentsSection = document.getElementById(`installments${paymentIndex}`);
            
            if (methodSelect) methodSelect.value = '';
            if (amountInput) amountInput.value = '';
            
            // Hide installments section if visible
            if (installmentsSection) installmentsSection.classList.add('d-none');
            
            // Hide the payment container
            payment.classList.add('d-none');
            
            // Recalculate totals
            if (typeof cart !== 'undefined' && cart.calculateTotals) {
                cart.calculateTotals();
            }
        }
    }

    // Enhanced payment-related functions
    window.payments = {
        add() {
            const payment2 = document.getElementById('payment2');
            if (payment2) {
                payment2.classList.remove('d-none');
                // Auto-calculate totals after showing second payment method
                setTimeout(() => {
                    if (typeof cart !== 'undefined' && cart.calculateTotals) {
                        cart.calculateTotals();
                    }
                }, 100);
            }
        },
        
        remove: removePaymentMethod,
        
        handleMethodChange(event) {
            const select = event.target;
            const paymentIndex = select.dataset.payment;
            const installmentsSection = document.getElementById(`installments${paymentIndex}`);
            
            if (!installmentsSection) return;

            const method = window.paymentMethodsData?.find(m => m.id === parseInt(select.value));
            const isCreditMethod = method && (
                method.method.toLowerCase().includes('crédito') || 
                method.method.toLowerCase().includes('credito') ||
                (method.requires_installments === true)
            );

            if (select.value && isCreditMethod) {
                installmentsSection.classList.remove('d-none');
                installmentsSection.style.display = 'block';
                
                const interestInput = installmentsSection.querySelector('.payment-interest');
                const installmentsSelect = installmentsSection.querySelector('.payment-installments');
                
                if (interestInput) {
                    interestInput.required = true;
                    if (!interestInput.value) interestInput.value = '0';
                }
                if (installmentsSelect) {
                    installmentsSelect.required = true;
                    if (!installmentsSelect.value) installmentsSelect.value = '1';
                }
            } else {
                installmentsSection.classList.add('d-none');
                installmentsSection.style.display = 'none';
                
                // Reset interest to 0 if not a credit method
                const interestInput = installmentsSection.querySelector('.payment-interest');
                if (interestInput) interestInput.value = '0';
            }

            // Trigger totals calculation after a brief delay to allow DOM updates
            setTimeout(() => {
                if (window.cart && typeof window.cart.calculateTotals === 'function') {
                    window.cart.calculateTotals();
                }
            }, 100);
        },
        
        setup() {
            document.querySelectorAll('.payment-method').forEach(select => {
                select.innerHTML = '<option value="">Selecione...</option>';
                if (Array.isArray(paymentMethodsData)) {
                    paymentMethodsData.forEach(method => {
                        const option = document.createElement('option');
                        option.value = method.id;
                        option.textContent = method.method;
                        select.appendChild(option);
                    });
                }
            });

            this.attachListeners();
        },

        attachListeners() {
            document.querySelectorAll('.payment-method').forEach(select => {
                // Remove existing listeners first to avoid duplicates
                select.removeEventListener('change', e => this.handleMethodChange(e));
                select.addEventListener('change', e => this.handleMethodChange(e));
            });

            document.querySelectorAll('.payment-amount').forEach(input => {
                input.addEventListener('input', debounce(() => {
                    if (typeof cart !== 'undefined' && cart.calculateTotals) {
                        cart.calculateTotals();
                    }
                }, 300));
                
                input.addEventListener('blur', () => {
                    const value = parseCurrencyInput(input.value);
                    input.value = formatInputValue(value);
                    // Recalculate after formatting
                    if (typeof cart !== 'undefined' && cart.calculateTotals) {
                        cart.calculateTotals();
                    }
                });
            });

            document.querySelectorAll('.payment-interest').forEach(input => {
                input.addEventListener('input', debounce(() => {
                    if (typeof cart !== 'undefined' && cart.calculateTotals) {
                        cart.calculateTotals();
                    }
                }, 300));
            });
        }
    };

    // Cart calculations for payment handling
    if (window.cart) {
        // Enhanced version with more robust payment handling
        window.cart.calculateTotals = function() {
            console.log('📊 RECALCULATING CART TOTALS');
            
            // Calculate subtotal from current cart
            const subtotal = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            console.log(`Cart subtotal: ${subtotal}`);
            
            // Update the subtotal display
            const subtotalElement = document.getElementById('subtotalAmount');
            if (subtotalElement) {
                subtotalElement.textContent = formatCurrency(subtotal);
            }
            
            // Calculate interest from payment methods
            let totalInterest = 0;
            let totalPaid = 0;

            document.querySelectorAll('.payment-method').forEach(select => {
                // Only consider visible payment methods with values
                if (select.value && !select.closest('.d-none')) {
                    const paymentIndex = select.dataset.payment;
                    const amountInput = document.querySelector(`.payment-amount[data-payment="${paymentIndex}"]`);
                    const interestInput = document.querySelector(`.payment-interest[data-payment="${paymentIndex}"]`);
                    
                    if (amountInput && amountInput.value) {
                        // Get base amount from input
                        const baseAmount = parseCurrencyInput(amountInput.value);
                        const interestRate = parseFloat(interestInput?.value || 0);
                        
                        // Determine if this payment method applies interest
                        const method = window.paymentMethodsData?.find(m => m.id === parseInt(select.value)) || 
                                    paymentMethodsData.find(m => m.id === parseInt(select.value));
                                    
                        const isCreditMethod = method && (
                            method.method.toLowerCase().includes('crédito') || 
                            method.method.toLowerCase().includes('credito') ||
                            (method.requires_installments === true)
                        );
                        
                        // Calculate interest if applicable
                        let interest = 0;
                        if (isCreditMethod && interestRate > 0) {
                            interest = baseAmount * (interestRate / 100);
                        }
                        
                        // Add to totals
                        totalPaid += baseAmount;
                        totalInterest += interest;
                        
                        console.log(`Payment ${paymentIndex}: Method=${select.value}, Amount=${baseAmount}, Interest=${interest}`);
                    }
                }
            });

            // Calculate final total and remaining amount
            const total = subtotal + totalInterest;
            const remaining = Math.max(0, total - totalPaid);

            console.log(`Total: ${total}, Paid: ${totalPaid}, Interest: ${totalInterest}, Remaining: ${remaining}`);

            // Update displays
            const interestElement = document.getElementById('interestAmount');
            const totalElement = document.getElementById('totalAmount');
            const paidElement = document.getElementById('paidAmount');
            const remainingElement = document.getElementById('remainingAmount');
            const remainingRow = document.getElementById('remainingRow');

            if (interestElement) interestElement.textContent = formatCurrency(totalInterest);
            if (totalElement) totalElement.textContent = formatCurrency(total);
            if (paidElement) paidElement.textContent = formatCurrency(totalPaid);
            if (remainingElement) remainingElement.textContent = formatCurrency(remaining);
            
            if (remainingRow) {
                remainingRow.style.display = remaining > 0 ? 'flex' : 'none';
            }

            // Auto-fill payment methods based on new total
            this._forceUpdatePaymentAmounts(total);
        };
        
        // Original autoFillPayments - redirect to our more aggressive version
        window.cart.autoFillPayments = function(total) {
            console.log(`Legacy autoFillPayments called with total: ${total}`);
            this._forceUpdatePaymentAmounts(total);
        };
        
        // New completely rewritten payment auto-filler with stronger logic
        window.cart._forceUpdatePaymentAmounts = function(total) {
            console.log(`💰 FORCE UPDATING PAYMENT AMOUNTS FOR TOTAL: ${total}`);
            
            const payment1Method = document.querySelector('.payment-method[data-payment="1"]');
            const payment1Amount = document.querySelector('.payment-amount[data-payment="1"]');
            const payment2Method = document.querySelector('.payment-method[data-payment="2"]');
            const payment2Amount = document.querySelector('.payment-amount[data-payment="2"]');
            const payment2Container = document.getElementById('payment2');
            
            if (!payment1Amount) {
                console.warn('Cannot find payment amount field');
                return;
            }
            
            // Check if payment method 2 is active (visible)
            const payment2Active = payment2Container && !payment2Container.classList.contains('d-none');
            const payment2HasMethod = payment2Method && payment2Method.value;
            
            console.log(`Payment 2 active: ${payment2Active}, has method: ${payment2HasMethod}`);
            console.log(`Current values - Payment 1: ${payment1Amount.value}, Payment 2: ${payment2Active ? payment2Amount.value : 'N/A'}`);
            
            // CASE 1: Only one payment method visible
            if (!payment2Active || !payment2HasMethod) {
                // Always set the full amount for the first payment
                payment1Amount.value = formatInputValue(total);
                console.log(`✅ Single payment mode: Set payment 1 amount to full total: ${total}`);
                return;
            }
            
            // CASE 2: Two payment methods visible
            if (payment2Amount) {
                const payment1Value = parseCurrencyInput(payment1Amount.value) || 0;
                const payment2Value = parseCurrencyInput(payment2Amount.value) || 0;
                const currentTotal = payment1Value + payment2Value;
                
                console.log(`Two payment mode: Current values (${payment1Value} + ${payment2Value} = ${currentTotal}), Target total: ${total}`);
                
                // Check if values need adjusting due to cart changes
                if (Math.abs(currentTotal - total) > 0.01) {
                    // CASE 2A: Both payments are empty or zero
                    if ((payment1Value === 0 || !payment1Amount.value) && 
                        (payment2Value === 0 || !payment2Amount.value)) {
                        // Split evenly
                        const half = total / 2;
                        payment1Amount.value = formatInputValue(half);
                        payment2Amount.value = formatInputValue(half);
                        console.log(`✅ Both empty: Split payment evenly: ${half} each`);
                    } 
                    // CASE 2B: First payment has value, second is empty
                    else if (payment1Value > 0 && (payment2Value === 0 || !payment2Amount.value)) {
                        if (payment1Value >= total) {
                            // First payment covers or exceeds the total
                            payment1Amount.value = formatInputValue(total);
                            payment2Amount.value = formatInputValue(0);
                            console.log(`✅ First has value: First payment covers total, set to: ${total}`);
                        } else {
                            // First payment is less than total, fill second with remainder
                            const remainder = total - payment1Value;
                            payment2Amount.value = formatInputValue(remainder);
                            console.log(`✅ First has value: First payment stays at ${payment1Value}, second adjusted to: ${remainder}`);
                        }
                    } 
                    // CASE 2C: Second payment has value, first is empty
                    else if ((payment1Value === 0 || !payment1Amount.value) && payment2Value > 0) {
                        if (payment2Value >= total) {
                            // Second payment covers or exceeds the total
                            payment2Amount.value = formatInputValue(total);
                            payment1Amount.value = formatInputValue(0);
                            console.log(`✅ Second has value: Second payment covers total, set to: ${total}`);
                        } else {
                            // Second payment is less than total, fill first with remainder
                            const remainder = total - payment2Value;
                            payment1Amount.value = formatInputValue(remainder);
                            console.log(`✅ Second has value: Second payment stays at ${payment2Value}, first adjusted to: ${remainder}`);
                        }
                    } 
                    // CASE 2D: Both payments have values
                    else {
                        // Adjust proportionally to maintain the ratio but match the new total
                        const ratio = payment1Value / currentTotal;
                        const newPayment1 = Math.round((total * ratio) * 100) / 100; // Round to 2 decimal places
                        const newPayment2 = Math.round((total - newPayment1) * 100) / 100;
                        
                        payment1Amount.value = formatInputValue(newPayment1);
                        payment2Amount.value = formatInputValue(newPayment2);
                        console.log(`✅ Both have values: Adjusted proportionally - first: ${newPayment1}, second: ${newPayment2}`);
                    }
                } else {
                    console.log(`✅ No adjustment needed, current total (${currentTotal}) matches cart total (${total})`);
                }
            }
        };

        // Make sure cart modifications trigger IMMEDIATE recalculations
        const originalAddToCart = window.cart.add;
        window.cart.add = function(productId, quantity = 1) {
            console.log(`🛒 Adding product ${productId} to cart, quantity: ${quantity}`);
            // Call the original method
            originalAddToCart.call(this, productId, quantity);
            
            // Force immediate recalculation of totals
            this.calculateTotals();
        };
        
        const originalRemoveFromCart = window.cart.remove;
        window.cart.remove = function(productId) {
            console.log(`🛒 Removing product ${productId} from cart`);
            // Call the original method
            originalRemoveFromCart.call(this, productId);
            
            // Force immediate recalculation of totals
            this.calculateTotals();
        };
        
        const originalUpdateQuantity = window.cart.updateQuantity;
        window.cart.updateQuantity = function(productId, newQuantity) {
            console.log(`🛒 Updating quantity for product ${productId} to ${newQuantity}`);
            // Call the original method
            originalUpdateQuantity.call(this, productId, newQuantity);
            
            // Force immediate recalculation of totals
            this.calculateTotals();
        };
    }

    // Improve modal handling to ensure it can be reopened
    const modalInstances = {};

    // Function to safely show a modal
    window.showPaymentMethodsModal = function() {
        console.log('Attempting to show payment methods modal');
        
        try {
            // Make sure we have a modal element in the DOM
            const modalElement = createPaymentMethodsModal();
            
            // Clean up any existing instance
            let existingModal = bootstrap.Modal.getInstance(modalElement);
            if (existingModal) {
                existingModal.dispose();
            }
            
            // Create a fresh instance
            const modalInstance = new bootstrap.Modal(modalElement);
            
            // Load the payment methods data
            loadPaymentMethods();
            
            // Show the modal
            modalInstance.show();
            
            console.log('Payment methods modal shown successfully');
        } catch (error) {
            console.error('Error showing payment methods modal:', error);
        }
    };

    // Clean up modal instances when modals are hidden
    document.addEventListener('hidden.bs.modal', function(event) {
        const modalId = event.target.id;
        if (modalId === 'paymentMethodsModal') {
            if (modalInstances.paymentMethods) {
                modalInstances.paymentMethods = null;
            }
        }
    }, false);

    // Set up global functions
    window.addPaymentMethod = addPaymentMethod;
    window.deletePaymentMethod = deletePaymentMethod;
    window.removePaymentMethod = removePaymentMethod;

    // Initialize payment methods if document is already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Document already loaded, initialize immediately
        loadPaymentMethods();
    } else {
        // Wait for document to load
        document.addEventListener('DOMContentLoaded', loadPaymentMethods);
    }

    // ========== QUICK ACTIONS ==========
    window.showQuickSale = () => {
        const modalElement = new bootstrap.Modal(document.getElementById('newSaleModal'));
        modalElement.show();
        modal.initializeNewSale();
    };

    window.showNewSaleForm = () => {
        window.showQuickSale();
    };

    window.showBulkActions = () => {
        const panel = document.getElementById('bulkActionsPanel');
        if (panel) {
            panel.classList.toggle('d-none');
            updateBulkActionsVisibility();
        }
    };

    window.showCommissionCalc = async () => {
        try {
            const data = await api.get('/api/comissoes/calcular');
            
            const modalHtml = `
                <div class="modal fade" id="commissionModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Calculadora de Comissões</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Data Início</label>
                                        <input type="date" class="form-control" id="commissionStartDate">
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">Data Fim</label>
                                        <input type="date" class="form-control" id="commissionEndDate">
                                    </div>
                                </div>
                                <button class="btn btn-primary" onclick="calculateCommissions()">Calcular</button>
                                <div id="commissionResults" class="mt-3"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalElement = new bootstrap.Modal(document.getElementById('commissionModal'));
            modalElement.show();
            
        } catch (error) {
            showNotification('Erro ao carregar calculadora de comissões', 'danger');
        }
    };

    function updateMonthlyProfit() {
        console.log("⚙️ Updating monthly profit...");
        
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        
        fetch(`/api/monthly-profit?t=${timestamp}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch updated monthly profit');
                }
                console.log("✅ Monthly profit data received");
                return response.json();
            })
            .then(data => {
                console.log("💰 New profit value:", data.formattedProfit);
                
                const profitDisplay = document.getElementById('monthlyProfitValue');
                if (profitDisplay) {
                    profitDisplay.textContent = data.formattedProfit;
                    
                    // Add animation effect to highlight the change
                    profitDisplay.classList.add('profit-updated');
                    setTimeout(() => {
                        profitDisplay.classList.remove('profit-updated');
                    }, 2000);
                    
                    console.log("✨ Profit display updated successfully!");
                } else {
                    console.error("❌ Monthly profit element not found in DOM");
                }
            })
            .catch(error => {
                console.error('❌ Error updating monthly profit:', error);
            });
    }

    window.calculateCommissions = async () => {
        const startDate = document.getElementById('commissionStartDate').value;
        const endDate = document.getElementById('commissionEndDate').value;
        
        try {
            const data = await api.get(`/api/comissoes/calcular?startDate=${startDate}&endDate=${endDate}`);
            
            const resultsHtml = `
                <div class="card">
                    <div class="card-body">
                        <h6>Total de Comissões: ${formatCurrency(data.totalCommission)}</h6>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Quantidade</th>
                                        <th>Receita</th>
                                        <th>Comissão</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.commissions.map(item => `
                                        <tr>
                                            <td>${item.product_name}</td>
                                            <td>${item.total_quantity_sold}</td>
                                            <td>${formatCurrency(item.total_revenue)}</td>
                                            <td>${formatCurrency(item.total_commission)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('commissionResults').innerHTML = resultsHtml;
            
        } catch (error) {
            showNotification('Erro ao calcular comissões', 'danger');
        }
    };

    window.showCustomerInsights = async () => {
        try {
            const data = await api.get('/api/insights/clientes');
            
            const modalHtml = `
                <div class="modal fade" id="insightsModal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Insights de Clientes</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-4">
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h5>${data.summary.totalClients}</h5>
                                                <small>Total Clientes</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h5>${data.summary.activeClients}</h5>
                                                <small>Ativos</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h5>${data.summary.inactiveClients}</h5>
                                                <small>Inativos</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h5>${data.summary.lostClients}</h5>
                                                <small>Perdidos</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Cliente</th>
                                                <th>Status</th>
                                                <th>Total Gasto</th>
                                                <th>Compras</th>
                                                <th>Ticket Médio</th>
                                                <th>Última Compra</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.topClients.map(client => `
                                                <tr>
                                                    <td>${client.name}</td>
                                                    <td><span class="badge bg-${client.status === 'Ativo' ? 'success' : client.status === 'Inativo' ? 'warning' : 'danger'}">${client.status}</span></td>
                                                    <td>${formatCurrency(client.total_spent || 0)}</td>
                                                    <td>${client.total_purchases}</td>
                                                    <td>${formatCurrency(client.average_purchase || 0)}</td>
                                                    <td>${client.last_purchase_date ? new Date(client.last_purchase_date).toLocaleDateString('pt-BR') : 'Nunca'}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalElement = new bootstrap.Modal(document.getElementById('insightsModal'));
            modalElement.show();
            
        } catch (error) {
            showNotification('Erro ao carregar insights', 'danger');
        }
    };

    window.showReports = () => {
        const modalHtml = `
            <div class="modal fade" id="reportsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Relatórios de Vendas</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-body text-center">
                                            <i class="bi bi-graph-up h1"></i>
                                            <h6>Vendas por Período</h6>
                                            <button class="btn btn-primary" onclick="generateSalesReport()">Gerar</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-body text-center">
                                            <i class="bi bi-box h1"></i>
                                            <h6>Produtos Mais Vendidos</h6>
                                            <button class="btn btn-primary" onclick="generateProductsReport()">Gerar</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-body text-center">
                                            <i class="bi bi-people h1"></i>
                                            <h6>Clientes Devedores</h6>
                                            <button class="btn btn-primary" onclick="generateDebtorsReport()">Gerar</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card">
                                        <div class="card-body text-center">
                                            <i class="bi bi-currency-dollar h1"></i>
                                            <h6>Lucro Mensal</h6>
                                            <button class="btn btn-primary" onclick="generateProfitReport()">Gerar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div id="reportResults" class="mt-4"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = new bootstrap.Modal(document.getElementById('reportsModal'));
        modalElement.show();
    };

    window.generateSalesReport = async () => {
        try {
            const data = await api.get('/api/relatorios/vendas-detalhado');
            
            const reportHtml = `
                <div class="card">
                    <div class="card-header">
                        <h6>Relatório de Vendas Detalhado</h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Período</th>
                                        <th>Vendas</th>
                                        <th>Receita</th>
                                        <th>Ticket Médio</th>
                                        <th>Clientes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(item => `
                                        <tr>
                                            <td>${new Date(item.period).toLocaleDateString('pt-BR')}</td>
                                            <td>${item.total_sales}</td>
                                            <td>${formatCurrency(item.total_revenue)}</td>
                                            <td>${formatCurrency(item.average_ticket)}</td>
                                            <td>${item.unique_clients}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('reportResults').innerHTML = reportHtml;
            
        } catch (error) {
            showNotification('Erro ao gerar relatório', 'danger');
        }
    };

    window.generateProductsReport = async () => {
        try {
            const data = await api.get('/api/relatorios/produtos-mais-vendidos');
            
            const reportHtml = `
                <div class="card">
                    <div class="card-header">
                        <h6>Produtos Mais Vendidos</h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Marca</th>
                                        <th>Vendidos</th>
                                        <th>Receita</th>
                                        <th>Vendas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(item => `
                                        <tr>
                                            <td>${item.name}</td>
                                            <td>${item.brand_name}</td>
                                            <td>${item.total_sold}</td>
                                            <td>${formatCurrency(item.total_revenue)}</td>
                                            <td>${item.sales_count}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('reportResults').innerHTML = reportHtml;
            
        } catch (error) {
            showNotification('Erro ao gerar relatório', 'danger');
        }
    };

    window.generateDebtorsReport = async () => {
        try {
            const data = await api.get('/api/relatorios/clientes-devedores');
            
            const reportHtml = `
                <div class="card">
                    <div class="card-header">
                        <h6>Clientes Devedores</h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Dívida</th>
                                        <th>Parcelas Pendentes</th>
                                        <th>Valor Atrasado</th>
                                        <th>Total Gasto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(item => `
                                        <tr>
                                            <td>${item.name}</td>
                                            <td>${formatCurrency(item.debt)}</td>
                                            <td>${item.pending_installments}</td>
                                            <td>${formatCurrency(item.overdue_amount)}</td>
                                            <td>${formatCurrency(item.total_spent)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('reportResults').innerHTML = reportHtml;
            
        } catch (error) {
            showNotification('Erro ao gerar relatório', 'danger');
        }
    };

    window.generateProfitReport = async () => {
        try {
            const data = await api.get('/api/relatorios/lucro-mensal');
            
            const reportHtml = `
                <div class="card">
                    <div class="card-header">
                        <h6>Lucro Mensal</h6>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Mês</th>
                                        <th>Lucro Recebido</th>
                                        <th>Lucro Total</th>
                                        <th>Parcelas Pagas</th>
                                        <th>Total Parcelas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.map(item => `
                                        <tr>
                                            <td>${item.month_name}</td>
                                            <td>${formatCurrency(item.profit_paid)}</td>
                                            <td>${formatCurrency(item.profit_total)}</td>
                                            <td>${item.installments_paid}</td>
                                            <td>${item.installments_total}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('reportResults').innerHTML = reportHtml;
            
        } catch (error) {
            showNotification('Erro ao gerar relatório', 'danger');
        }
    };

    window.showExportOptions = () => {
        const modalHtml = `
            <div class="modal fade" id="exportModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Exportar Dados</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">Data Início</label>
                                    <input type="date" class="form-control" id="exportStartDate">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Data Fim</label>
                                    <input type="date" class="form-control" id="exportEndDate">
                                </div>
                                <div class="col-12">
                                    <label class="form-label">Formato</label>
                                    <select class="form-select" id="exportFormat">
                                        <option value="json">JSON</option>
                                        <option value="csv">CSV</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="exportData()">Exportar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = new bootstrap.Modal(document.getElementById('exportModal'));
        modalElement.show();
    };

    window.exportData = () => {
        const startDate = document.getElementById('exportStartDate').value;
        const endDate = document.getElementById('exportEndDate').value;
        const format = document.getElementById('exportFormat').value;
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('format', format);
        
        window.open(`/api/exportar/vendas?${params.toString()}`, '_blank');
    };

    // Setup global event delegation for payment-related fields
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Setting up payment method event listeners');
        
        // Listen for changes to payment method fields using event delegation
        document.body.addEventListener('change', function(e) {
            if (e.target.classList.contains('payment-method')) {
                window.payments.handleMethodChange(e);
            }
        });
        
        // Listen for input on payment amounts
        document.body.addEventListener('input', function(e) {
            if (e.target.classList.contains('payment-amount') || 
                e.target.classList.contains('payment-interest')) {
                
                // Use debounce for performance
                clearTimeout(window._paymentInputTimeout);
                window._paymentInputTimeout = setTimeout(() => {
                    if (window.cart && typeof window.cart.calculateTotals === 'function') {
                        window.cart.calculateTotals();
                    }
                }, 300);
            }
        });
        
        // Handle blur events to format values
        document.body.addEventListener('blur', function(e) {
            if (e.target.classList.contains('payment-amount')) {
                const value = parseCurrencyInput(e.target.value);
                e.target.value = formatInputValue(value);
                
                // Recalculate after formatting
                if (window.cart && typeof window.cart.calculateTotals === 'function') {
                    window.cart.calculateTotals();
                }
            }
        });
        
        // Fix "addPaymentMethod" button if it has wrong function
        document.querySelectorAll('button[onclick="window.addPaymentMethod()"]').forEach(btn => {
            btn.setAttribute('onclick', 'payments.add()');
        });
    });

    // ========== FILTER MODAL FUNCTIONS ==========
    window.filterManager = filterManager;

    window.showAdvancedFiltersModal = () => {
        filterManager.populateFilterOptions();
        const modal = new bootstrap.Modal(document.getElementById('advancedFiltersModal'));
        modal.show();
    };

    window.applyAdvancedFilters = () => {
        const filters = {
            clientId: document.getElementById('advancedClientFilter')?.value,
            paymentMethod: document.getElementById('advancedPaymentFilter')?.value,
            minValue: document.getElementById('minValueFilter')?.value,
            maxValue: document.getElementById('maxValueFilter')?.value,
            productId: document.getElementById('advancedProductFilter')?.value,
            installmentStatus: document.getElementById('installmentStatusFilter')?.value
        };

        Object.keys(filters).forEach(key => {
            if (filters[key] && filters[key] !== '') {
                filterManager.updateFilter(key, filters[key]);
            } else {
                filterManager.removeFilter(key);
            }
        });

        const modal = bootstrap.Modal.getInstance(document.getElementById('advancedFiltersModal'));
        if (modal) modal.hide();
    };

    window.applyCustomDateFilter = () => {
        const startDate = document.getElementById('startDateFilter')?.value;
        const endDate = document.getElementById('endDateFilter')?.value;

        if (startDate) filterManager.updateFilter('startDate', startDate);
        if (endDate) filterManager.updateFilter('endDate', endDate);
    };

    window.clearAllFilters = () => {
        appliedFilters = {};
        currentPage = 1;

        const elements = [
            'salesSearchInput', 'dateRangeFilter', 'statusFilter',
            'startDateFilter', 'endDateFilter', 'advancedClientFilter',
            'advancedPaymentFilter', 'minValueFilter', 'maxValueFilter',
            'advancedProductFilter', 'installmentStatusFilter'
        ];

        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        document.getElementById('customDateRange')?.classList.add('d-none');

        filterManager.updateDisplay();
        loadSalesData();

        const modal = bootstrap.Modal.getInstance(document.getElementById('advancedFiltersModal'));
        if (modal) modal.hide();
    };

    // ========== EVENT LISTENERS SETUP ==========
    const setupEventListeners = () => {
        // Modal initialization
        const newSaleModal = document.getElementById('newSaleModal');
        if (newSaleModal) {
            newSaleModal.addEventListener('shown.bs.modal', () => {
                modal.initializeNewSale();
                modal.setupProductSearch();
            });
            newSaleModal.addEventListener('hidden.bs.modal', () => {
                cart.clear();
            });
        }

        // Payment method buttons
        const addPaymentBtn = document.getElementById('addPaymentBtn');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', payments.add);
        }

        // Search functionality
        const salesSearchInput = document.getElementById('salesSearchInput');
        if (salesSearchInput) {
            salesSearchInput.addEventListener('input', debounce((e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                if (searchTerm) {
                    filterManager.updateFilter('search', searchTerm);
                } else {
                    filterManager.removeFilter('search');
                }
            }, 500));
        }

        // Sorting functionality
        document.querySelectorAll('.sort-header').forEach(header => {
            header.addEventListener('click', function() {
                const field = this.dataset.sort;
                if (!field) return;
                
                const newOrder = currentSort.field === field && currentSort.order === 'ASC' ? 'DESC' : 'ASC';
                
                currentSort = { field, order: newOrder };
                currentPage = 1;
                
                // Update sort indicators
                document.querySelectorAll('.sort-header').forEach(h => {
                    h.classList.remove('sort-asc', 'sort-desc');
                });
                
                this.classList.add(newOrder === 'ASC' ? 'sort-asc' : 'sort-desc');
                
                loadSalesData();
            });
        });

        // Date filter listeners
        const startDateFilter = document.getElementById('startDateFilter');
        const endDateFilter = document.getElementById('endDateFilter');
        
        if (startDateFilter && endDateFilter) {
            startDateFilter.addEventListener('change', () => {
                if (startDateFilter.value) {
                    filterManager.updateFilter('startDate', startDateFilter.value);
                } else {
                    filterManager.removeFilter('startDate');
                }
            });
            
            endDateFilter.addEventListener('change', () => {
                if (endDateFilter.value) {
                    filterManager.updateFilter('endDate', endDateFilter.value);
                } else {
                    filterManager.removeFilter('endDate');
                }
            });
        }

        // Cleanup modals when hidden
        document.addEventListener('hidden.bs.modal', (e) => {
            if (e.target.id !== 'newSaleModal') {
                e.target.remove();
            }
        });
    };

    const originalXHROpen = window.XMLHttpRequest.prototype.open;

    // Override XMLHttpRequest to catch installment payment requests
    window.XMLHttpRequest.prototype.open = function() {
        const method = arguments[0];
        const url = arguments[1];
        
        // Check if this is an installment payment request
        if (method === 'PATCH' && url.includes('/api/installments') && url.includes('/pay')) {
            this.addEventListener('load', function() {
                if (this.status >= 200 && this.status < 300) {
                    console.log('✅ Installment payment successful - updating profit display');
                    refreshProfitAfterInstallmentPayment();
                }
            });
        }
        
        return originalXHROpen.apply(this, arguments);
    };

    // Update profit after installment payment
    function refreshProfitAfterInstallmentPayment() {
        console.log('💰 Refreshing profit after installment payment...');
        
        // Add a delay to ensure database transaction is complete
        setTimeout(() => {
            fetch(`/api/monthly-profit?refresh=${Date.now()}`, {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log('📊 New profit data received:', data);
                
                const profitDisplay = document.getElementById('monthlyProfitValue');
                if (profitDisplay) {
                    // Update profit display
                    profitDisplay.textContent = data.formattedProfit;
                    
                    // Add highlight effect
                    profitDisplay.style.transition = 'all 0.3s ease-out';
                    profitDisplay.style.color = '#4caf50';
                    profitDisplay.style.transform = 'scale(1.1)';
                    profitDisplay.style.textShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
                    
                    setTimeout(() => {
                        profitDisplay.style.color = '';
                        profitDisplay.style.transform = '';
                        profitDisplay.style.textShadow = '';
                    }, 2000);
                    
                    console.log('✨ Profit display updated after installment payment!');
                } else {
                    console.error('❌ Could not find profit display element');
                }
            })
            .catch(err => {
                console.error('❌ Error updating profit after installment payment:', err);
            });
        }, 500);
    }

    // ========== GLOBAL FUNCTIONS ==========
    window.cart = cart || {};
    window.payments = payments;
    window.modal = modal;
    window.submitSale = submitSale;
    window.viewSale = viewSale;
    window.duplicateSale = duplicateSale;
    window.deleteSale = deleteSale;
    window.bulkMarkPaid = bulkMarkPaid;
    window.goToPage = goToPage;
    window.updateMonthlyProfit = updateMonthlyProfit;
    window.dismissNotification = () => {
        const notificationBar = document.querySelector('.notification-bar');
        if (notificationBar) notificationBar.style.display = 'none';
    };
    window.refreshAnalytics = () => {
        loadAnalyticsData();
        showNotification('Analytics atualizados', 'success', 2000);
    };
    window.refreshSales = () => {
        loadSalesData();
        showNotification('Dados atualizados', 'success', 2000);
    };

    const updateSalesStats = () => {
        const statsContainer = document.getElementById('salesStatsContainer');
        if (!statsContainer) return;

        // Make an API call to get complete sales statistics instead of using local salesData
        api.get('/api/sales/statistics')
            .then(stats => {
                if (!stats) return;
                
                statsContainer.innerHTML = `
                    <div class="row g-3 mb-4">
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title text-primary">${stats.totalSales}</h5>
                                    <p class="card-text">Total de Vendas</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title text-success">${formatCurrency(stats.totalRevenue)}</h5>
                                    <p class="card-text">Receita Total</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title text-success">${stats.paidSales}</h5>
                                    <p class="card-text">Vendas Pagas</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title text-warning">${stats.pendingSales}</h5>
                                    <p class="card-text">Vendas Pendentes</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            })
            .catch(error => {
                console.error('Failed to load sales statistics:', error);
                statsContainer.innerHTML = '<p class="text-center text-muted">Erro ao carregar estatísticas</p>';
            });
    };

    // ========== MAIN DATA LOADING ==========
    const loadSalesData = async () => {
        try {
            showLoading();
            
            const params = new URLSearchParams({
                page: currentPage,
                limit: CONFIG.PAGINATION_SIZE,
                sortBy: currentSort.field,
                sortOrder: currentSort.order,
                ...appliedFilters
            });

            console.log('Loading sales with filters:', appliedFilters);

            const response = await api.get(`/api/vendas?${params.toString()}`);
            if (response) {
                if (response.sales) {
                    salesData = response.sales;
                    totalPages = response.pagination?.totalPages || 1;
                    totalSales = response.pagination?.totalSales || response.sales.length;
                    
                    // Store pagination info
                    currentPagination = {
                        currentPage: response.pagination?.currentPage || 1,
                        totalPages: response.pagination?.totalPages || 1,
                        hasNextPage: response.pagination?.hasNextPage || false,
                        hasPreviousPage: response.pagination?.hasPreviousPage || false
                    };
                } else {
                    salesData = response;
                    totalSales = response.length;
                    totalPages = 1;
                    currentPagination = {
                        currentPage: 1,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    };
                }
                
                salesTable.update();
                updateSalesStats(); // This now makes a separate API call
                renderPagination();
            }
        } catch (error) {
            console.error('Failed to load sales data:', error);
            showNotification('Erro ao carregar vendas', 'danger');
        } finally {
            hideLoading();
        }
    };

    function renderPagination() {
        const paginationElement = document.getElementById('salesPagination');
        const paginationStats = document.getElementById('paginationStats');
        
        if (!paginationElement) return;
        
        // Clear existing pagination
        paginationElement.innerHTML = '';
        
        // Update stats text
        if (paginationStats) {
            const start = ((currentPage - 1) * CONFIG.PAGINATION_SIZE) + 1;
            const end = Math.min(currentPage * CONFIG.PAGINATION_SIZE, totalSales);
            paginationStats.textContent = `Mostrando ${start}-${end} de ${totalSales} vendas`;
        }
        
        // If we only have one page, don't show pagination
        if (totalPages <= 1) return;
        
        // Add previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        
        const prevLink = document.createElement('a');
        prevLink.className = 'page-link';
        prevLink.href = '#';
        prevLink.setAttribute('aria-label', 'Previous');
        prevLink.innerHTML = '<span aria-hidden="true">&laquo;</span>';
        
        if (currentPage > 1) {
            prevLink.addEventListener('click', (e) => {
                e.preventDefault();
                goToPage(currentPage - 1);
            });
        }
        
        prevLi.appendChild(prevLink);
        paginationElement.appendChild(prevLi);
        
        // Determine which page numbers to show
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Adjust if we're near the end
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }
        
        // Add page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageLi = document.createElement('li');
            pageLi.className = `page-item ${i === currentPage ? 'active' : ''}`;
            
            const pageLink = document.createElement('a');
            pageLink.className = 'page-link';
            pageLink.href = '#';
            pageLink.textContent = i;
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                goToPage(i);
            });
            
            pageLi.appendChild(pageLink);
            paginationElement.appendChild(pageLi);
        }
        
        // Add next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        
        const nextLink = document.createElement('a');
        nextLink.className = 'page-link';
        nextLink.href = '#';
        nextLink.setAttribute('aria-label', 'Next');
        nextLink.innerHTML = '<span aria-hidden="true">&raquo;</span>';
        
        if (currentPage < totalPages) {
            nextLink.addEventListener('click', (e) => {
                e.preventDefault();
                goToPage(currentPage + 1);
            });
        }
        
        nextLi.appendChild(nextLink);
        paginationElement.appendChild(nextLi);
    }

    function goToPage(page) {
        if (page !== currentPage) {
            currentPage = page;
            loadSalesData();
            // Scroll to top of sales table
            const salesTable = document.getElementById('salesTable');
            if (salesTable) {
                salesTable.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    // ========== STYLES ==========
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .overlay-loading {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(255, 255, 255, 0.9); display: flex;
                justify-content: center; align-items: center; z-index: 9999;
                backdrop-filter: blur(2px);
            }
            .notification {
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                border-radius: 6px;
                z-index: 1100;
            }
            .product-card {
                transition: all 0.3s ease;
                cursor: pointer;
            }
            .product-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            .cart-item {
                border-bottom: 1px solid #e9ecef;
                padding-bottom: 0.5rem;
            }
            .cart-item:last-child {
                border-bottom: none;
            }
            .installments-section {
                background: #f8f9fa;
                padding: 0.75rem;
                border-radius: 0.375rem;
                margin-top: 0.5rem;
            }
            .fade-in {
                animation: fadeIn 0.3s ease-in;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .profit-updated {
                animation: pulse 1.5s ease-in-out;
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); color: #4caf50; }
                100% { transform: scale(1); }
            }
            .sort-header {
                cursor: pointer;
                position: relative;
                user-select: none;
            }
            .sort-header::after {
                content: '⇅';
                opacity: 0.5;
                margin-left: 5px;
                font-size: 0.8em;
            }
            .sort-header.sort-asc::after {
                content: '↑';
                opacity: 1;
            }
            .sort-header.sort-desc::after {
                content: '↓';
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    };

    // ========== INITIALIZATION ==========
    const initialize = async () => {
        try {
            showLoading();
            
            console.log('Initializing optimized sales system...');
            
            const dataLoaded = await loadData();
            
            if (dataLoaded) {
                injectStyles();
                setupEventListeners();
                filterManager.init();
                salesTable.update();
                
                await Promise.all([
                    loadNotifications(),
                    loadAnalyticsData(),
                    loadSalesData()
                ]);
                
                console.log('✅ Optimized sales system initialized successfully');
            } else {
                throw new Error('Failed to load essential data');
            }
            
        } catch (error) {
            console.error('Initialization failed:', error);
            showNotification('Falha na inicialização. Recarregue a página.', 'danger', 10000);
        } finally {
            hideLoading();
        }
    };

    // ========== START INITIALIZATION ==========
    initialize();

    // Auto-refresh every 5 minutes
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadSalesData();
            loadAnalyticsData();
        }
    }, 5 * 60 * 1000);

    // Add a function to schedule update of monthly profit with delay
    function scheduleUpdateMonthlyProfit(delay = 1000) {
        console.log(`Scheduling monthly profit update in ${delay}ms`);
        clearTimeout(window._profitUpdateTimeout);
        window._profitUpdateTimeout = setTimeout(() => {
            updateMonthlyProfit();
        }, delay);
    }
    
    // Make it globally available
    window.scheduleUpdateMonthlyProfit = scheduleUpdateMonthlyProfit;
        // Setup payment method listeners for enhanced payment handling

    
    // Call setup after a short delay to ensure DOM is ready
    setTimeout(setupPaymentListeners, 500);
    
    // Additionally, set up global event delegation for newly added elements
    document.body.addEventListener('change', function(e) {
        if (e.target.classList.contains('payment-method')) {
            if (window.payments && typeof window.payments.handleMethodChange === 'function') {
                window.payments.handleMethodChange(e);
            }
            
            // Recalculate totals after method change
            if (window.cart && typeof window.cart.calculateTotals === 'function') {
                setTimeout(() => window.cart.calculateTotals(), 100);
            }
        }
    });
    // Define a single, definitive payment listener setup function
    function setupPaymentListeners() {
        console.log('🔧 Setting up enhanced payment listeners');
        
        // Clean up any existing listeners (clone and replace approach)
        document.querySelectorAll('.payment-method').forEach(select => {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
        });
        
        document.querySelectorAll('.payment-amount, .payment-interest').forEach(input => {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
        });
        
        // Add a recalculate button for manual testing
        document.querySelectorAll('.payment-container').forEach(container => {
            if (!container.querySelector('.recalculate-button')) {
                const recalcButton = document.createElement('button');
                recalcButton.type = 'button';
                recalcButton.className = 'btn btn-sm btn-outline-secondary mt-2 recalculate-button';
                recalcButton.innerHTML = '<i class="bi bi-arrow-repeat"></i> Recalcular';
                recalcButton.onclick = function() {
                    console.log('Manual recalculation triggered');
                    if (window.cart && typeof window.cart.calculateTotals === 'function') {
                        window.cart.calculateTotals();
                    }
                };
                container.appendChild(recalcButton);
            }
        });
        
        // Setup global event delegation for all payment-related events
        document.removeEventListener('change', handlePaymentChange);
        document.addEventListener('change', handlePaymentChange);
        
        document.removeEventListener('input', handlePaymentInput);
        document.addEventListener('input', handlePaymentInput);
        
        document.removeEventListener('blur', handlePaymentBlur, true);
        document.addEventListener('blur', handlePaymentBlur, true);
        
        console.log('✅ Payment listeners setup complete');
    }

    // Separate handler functions for better organization
    function handlePaymentChange(e) {
        if (e.target.classList.contains('payment-method')) {
            console.log(`Payment method changed: ${e.target.value}`);
            
            // Update installment UI if needed
            if (window.payments && typeof window.payments.handleMethodChange === 'function') {
                window.payments.handleMethodChange({target: e.target});
            }
            
            // Always recalculate totals after payment method change
            if (window.cart && typeof window.cart.calculateTotals === 'function') {
                window.cart.calculateTotals();
            }
        }
    }

    function handlePaymentInput(e) {
        if (e.target.classList.contains('payment-amount') || e.target.classList.contains('payment-interest')) {
            const inputType = e.target.classList.contains('payment-amount') ? 'amount' : 'interest';
            console.log(`Payment ${inputType} input: ${e.target.value}`);
            
            // Debounce for performance
            clearTimeout(window._paymentInputTimeout);
            window._paymentInputTimeout = setTimeout(() => {
                if (window.cart && typeof window.cart.calculateTotals === 'function') {
                    window.cart.calculateTotals();
                }
            }, 300);
        }
    }

    function handlePaymentBlur(e) {
        if (e.target.classList.contains('payment-amount')) {
            console.log(`Payment amount blur event: ${e.target.value}`);
            const value = parseCurrencyInput(e.target.value);
            e.target.value = formatInputValue(value);
            
            // Recalculate after formatting
            if (window.cart && typeof window.cart.calculateTotals === 'function') {
                window.cart.calculateTotals();
            }
        }
    }

    // Call setup once after DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        // Give time for the page to fully initialize
        setTimeout(setupPaymentListeners, 500);
    });

    // Also make sure cart changes trigger recalculation explicitly
    document.addEventListener('DOMContentLoaded', function() {
        const cartButtons = document.querySelectorAll('button[onclick*="cart.add"], button[onclick*="cart.remove"]');
        cartButtons.forEach(button => {
            button.addEventListener('click', function() {
                setTimeout(() => {
                    if (window.cart && typeof window.cart.calculateTotals === 'function') {
                        console.log('Cart button clicked, forcing recalculation');
                        window.cart.calculateTotals();
                    }
                }, 100);
            });
        });
    });

    // Call this function after DOM is ready
    setTimeout(setupPaymentListeners, 1000);
});
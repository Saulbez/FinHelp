document.addEventListener('DOMContentLoaded', () => {
    let productsData = [];
    let campaigns = [];
    const centsMap = new WeakMap();

    // === CONFIGURATION CONSTANTS ===
    const CONFIG = {
        NOTIFICATION_DURATION: 5000,
        CALCULATION_PRECISION: 0.01,
        MAX_RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000
    };

    // === UTILITY FUNCTIONS ===
    const isVisible = (el) => {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    };

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(null, args), delay);
        };
    };

    const retryFetch = async (url, options = {}, maxRetries = CONFIG.MAX_RETRY_ATTEMPTS) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response;
            } catch (error) {
                console.warn(`Attempt ${attempt} failed for ${url}:`, error.message);
                if (attempt === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
            }
        }
    };

    // ========== IMPROVED LOADING FUNCTIONS ==========
    const loadProducts = async () => {
        try {
            const response = await retryFetch('/api/produtos');
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Invalid products data format - expected array');
            }
            
            productsData = data;
            console.log('Products loaded successfully:', productsData.length, 'items');
            
            // Validate product data structure
            const invalidProducts = productsData.filter(p => 
                !p.id || !p.name || (p.promo_price === undefined && p.original_price === undefined)
            );
            
            if (invalidProducts.length > 0) {
                console.warn('Found products with missing required fields:', invalidProducts);
            }
            
        } catch (error) {
            console.error('Failed to load products:', error);
            showNotification(`Failed to load products: ${error.message}`, 'danger');
            productsData = []; // Ensure it's still an array
        }
    };

    const loadCampaigns = async () => {
        try {
            const response = await retryFetch('/api/campanhas');
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Invalid campaigns data format - expected array');
            }
            
            campaigns = data;
            console.log('Campaigns loaded successfully:', campaigns.length, 'items');
            
        } catch (error) {
            console.error('Failed to load campaigns:', error);
            // Don't show user notification for campaigns as it's not critical
            campaigns = []; // Ensure it's still an array
        }
    };

    // ========== IMPROVED NOTIFICATION SYSTEM ==========
    const showNotification = (message, type = 'danger', duration = CONFIG.NOTIFICATION_DURATION) => {
        // Remove existing notifications of the same type to avoid spam
        document.querySelectorAll(`.notification.alert-${type}`).forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            <span>${message}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
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
        
        notification.querySelector('.btn-close').addEventListener('click', () => {
            notification.remove();
        });
        
        document.body.appendChild(notification);
        
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);
        }
    };

    // ========== IMPROVED PAYMENT METHOD TOGGLE ==========
    const handlePaymentMethodToggle = function() {
        const paymentMethod2 = document.getElementById('paymentMethod2');
        const layoutPaymentMethods = document.querySelector('.payment-methods-container');
        
        if (!paymentMethod2 || !layoutPaymentMethods) {
            console.error('Payment method elements not found');
            return;
        }
        
        if (this.checked) {
            // Show second payment method
            paymentMethod2.classList.remove('d-none');
            
            // Copy options from first method if needed
            const firstMethodSelect = document.querySelector('.payment-method[data-index="1"]');
            const secondMethodSelect = paymentMethod2.querySelector('.payment-method');
            
            if (firstMethodSelect && secondMethodSelect && secondMethodSelect.options.length <= 1) {
                Array.from(firstMethodSelect.options).forEach((option, index) => {
                    if (index > 0) {
                        secondMethodSelect.appendChild(option.cloneNode(true));
                    }
                });
            }
            
            layoutPaymentMethods.classList.remove('justify-content-start');
            layoutPaymentMethods.classList.add('justify-content-center');
            
            // Set fields as required
            const methodSelect = paymentMethod2.querySelector('.payment-method');
            const amountInput = paymentMethod2.querySelector('.payment-amount');
            if (methodSelect) methodSelect.required = true;
            if (amountInput) amountInput.required = true;
            
        } else {
            // Hide second payment method
            paymentMethod2.classList.add('d-none');
            layoutPaymentMethods.classList.remove('justify-content-center');
            layoutPaymentMethods.classList.add('justify-content-start');
            
            // Remove requirements and clear values
            const methodSelect = paymentMethod2.querySelector('.payment-method');
            const amountInput = paymentMethod2.querySelector('.payment-amount');
            
            if (methodSelect) {
                methodSelect.required = false;
                methodSelect.value = '';
            }
            if (amountInput) {
                amountInput.required = false;
                amountInput.value = '';
            }
        }
        
        calculateTotals();
    };

    // ========== IMPROVED PRODUCT MANAGEMENT ==========
    const addProductRow = async () => {
        if (!productsData || productsData.length === 0) {
            showNotification('Loading products...', 'info', 2000);
            try {
                await loadProducts();
                if (productsData.length === 0) {
                    showNotification('No products available', 'warning');
                    return;
                }
            } catch (error) {
                showNotification('Failed to load products', 'danger');
                return;
            }
        }
        
        const container = document.getElementById('productsContainer');
        if (!container) {
            console.error('Products container not found');
            return;
        }
        
        const index = container.children.length + 1;
        const html = `
            <div class="product-item mb-3" data-index="${index}">
                <div class="input-group">
                    <button type="button" class="btn btn-outline-danger remove-product" title="Remove product">
                        <i class="bi bi-dash-circle"></i>
                    </button>
                    <select class="form-select product-select" required>
                        <option value="">Select a product...</option>
                        ${productsData.map(product => {
                            const price = (product.promo_price ?? product.original_price ?? 0);
                            const formattedPrice = String(price).replace(',', '.');
                            const stockText = product.stock ? `(${product.stock} in stock)` : '(No stock info)';
                            return `
                                <option value="${product.id}" 
                                        data-price="${formattedPrice}"
                                        data-profit="${product.profit_percentage || 0}"
                                        data-stock="${product.stock || 0}"
                                        ${product.stock === 0 ? 'disabled' : ''}>
                                    ${product.name} - ${product.brand} ${stockText}
                                </option>
                            `;
                        }).join('')}
                    </select>
                    <input type="number" class="form-control quantity" min="1" max="1000" value="1" required>
                    <span class="input-group-text product-price">R$ 0,00</span>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        setupProductRowEvents(index);
        calculateTotals();
    };

    const setupProductRowEvents = (index) => {
        const row = document.querySelector(`[data-index="${index}"]`);
        if (!row) return;
        
        const removeBtn = row.querySelector('.remove-product');
        const productSelect = row.querySelector('.product-select');
        const quantityInput = row.querySelector('.quantity');
        
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                row.remove();
                calculateTotals();
            });
        }
        
        if (productSelect) {
            productSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const rawPrice = parseFloat(selectedOption?.dataset?.price || 0);
                const stock = parseInt(selectedOption?.dataset?.stock || 0);
                const priceElement = row.querySelector('.product-price');
                const quantityInput = row.querySelector('.quantity');
                
                if (priceElement) {
                    priceElement.dataset.rawPrice = rawPrice.toFixed(2);
                    priceElement.textContent = formatCurrency(rawPrice);
                }
                
                // Update quantity max based on stock
                if (quantityInput && stock > 0) {
                    quantityInput.max = stock;
                    if (parseInt(quantityInput.value) > stock) {
                        quantityInput.value = stock;
                    }
                }
                
                calculateTotals();
            });
        }
        
        if (quantityInput) {
            quantityInput.addEventListener('input', function() {
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const stock = parseInt(selectedOption?.dataset?.stock || 0);
                
                if (stock > 0 && parseInt(this.value) > stock) {
                    this.value = stock;
                    showNotification(`Maximum quantity available: ${stock}`, 'warning', 3000);
                }
                
                calculateTotals();
            });
        }
    };

    // ========== IMPROVED CURRENCY HANDLING ==========
    const parseCurrencyInput = (value) => {
        if (!value || value === '') return 0;
        
        // Handle different input formats
        const cleaned = String(value)
            .replace(/[^\d,.-]/g, '') // Remove non-numeric characters except comma, dot, minus
            .replace(/\./g, '') // Remove thousand separators (dots)
            .replace(/,/g, '.'); // Convert comma to dot for decimal
        
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    };

    const formatCurrency = (value) => {
        const num = Number(value);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const formatDisplayCurrency = (value) => {
        const num = Number(value);
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // ========== IMPROVED CALCULATION SYSTEM ==========
    const calculateTotals = debounce(() => {
        let subtotal = 0;
        
        // Calculate subtotal from products
        document.querySelectorAll('.product-item').forEach(item => {
            const priceElement = item.querySelector('.product-price');
            const quantityInput = item.querySelector('.quantity');
            
            if (priceElement && quantityInput) {
                const price = parseFloat(priceElement.dataset.rawPrice || 0);
                const quantity = parseInt(quantityInput.value) || 0;
                subtotal += price * quantity;
            }
        });
        
        let totalInterest = 0;
        let totalBase = 0;
        
        // Calculate payment totals
        document.querySelectorAll('.payment-method').forEach(method => {
            if (!isVisible(method)) return;
            
            const dataIndex = method.getAttribute('data-index');
            const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
            
            if (!amountInput) return;
            
            const baseValue = parseCurrencyInput(amountInput.value);
            let interest = 0;
            let paymentTotal = baseValue;
            
            // Calculate interest for credit methods
            if (['credito', 'pix_credito'].includes(method.value)) {
                const interestRateInput = document.querySelector(`.interest-field[data-index="${dataIndex}"] .interest-rate`);
                const interestRate = parseFloat(interestRateInput?.value || 0);
                interest = baseValue * (interestRate / 100);
                paymentTotal = baseValue + interest;
                
                // Update interest display
                const interestDetail = document.querySelector(`.interest-detail[data-index="${dataIndex}"]`);
                if (interestDetail) {
                    interestDetail.innerHTML = `<small class="text-muted">Interest: ${formatDisplayCurrency(interest)}</small>`;
                }
            }
            
            totalInterest += interest;
            totalBase += baseValue;
            
            // Update method total display
            const methodTotal = document.querySelector(`.method-total[data-index="${dataIndex}"]`);
            if (methodTotal) {
                methodTotal.textContent = `Total: ${formatDisplayCurrency(paymentTotal)}`;
            }
        });
        
        const total = subtotal + totalInterest;
        
        // Update display elements
        const subtotalElement = document.getElementById('subtotal');
        const totalRawElement = document.getElementById('totalRaw');
        const totalAmountElement = document.getElementById('totalAmount');
        
        if (subtotalElement) {
            subtotalElement.textContent = formatDisplayCurrency(subtotal);
            subtotalElement.dataset.raw = subtotal.toFixed(2);
        }
        
        if (totalRawElement) {
            totalRawElement.dataset.subtotal = subtotal.toFixed(2);
            totalRawElement.dataset.value = total.toFixed(2);
        }
        
        if (totalAmountElement) {
            totalAmountElement.textContent = formatDisplayCurrency(total);
        }
        
        // Handle single payment method auto-fill
        const paymentMethod2 = document.getElementById('paymentMethod2');
        const isSecondMethodActive = paymentMethod2 && !paymentMethod2.classList.contains('d-none');
        const firstPaymentInput = document.querySelector('.payment-amount[data-index="1"]');
        
        if (firstPaymentInput) {
            if (!isSecondMethodActive) {
                firstPaymentInput.value = formatDisplayCurrency(subtotal);
                firstPaymentInput.setAttribute('readonly', 'true');
            } else {
                firstPaymentInput.removeAttribute('readonly');
            }
        }
    }, 300);

    // ========== IMPROVED VALIDATION ==========
    const validateSale = () => {
        let isValid = true;
        clearErrors();
        const errorMessages = [];
        
        // Validate client selection
        const clientSelect = document.getElementById('clientSelect');
        if (!clientSelect || !clientSelect.value) {
            errorMessages.push('Please select a client');
            if (clientSelect) clientSelect.classList.add('is-invalid');
            isValid = false;
        }
        
        // Validate products
        const products = document.querySelectorAll('.product-item');
        if (products.length === 0) {
            errorMessages.push('Add at least one product');
            isValid = false;
        }
        
        // Validate product quantities against stock
        products.forEach((item, index) => {
            const productSelect = item.querySelector('.product-select');
            const quantityInput = item.querySelector('.quantity');
            
            if (productSelect && quantityInput) {
                const selectedOption = productSelect.options[productSelect.selectedIndex];
                const stock = parseInt(selectedOption?.dataset?.stock || 0);
                const quantity = parseInt(quantityInput.value || 0);
                
                if (stock > 0 && quantity > stock) {
                    errorMessages.push(`Product ${index + 1}: Quantity (${quantity}) exceeds available stock (${stock})`);
                    quantityInput.classList.add('is-invalid');
                    isValid = false;
                }
            }
        });
        
        // Validate payment amounts
        const subtotal = parseFloat(document.getElementById('totalRaw')?.dataset?.subtotal || 0);
        const totalCalculated = parseFloat(document.getElementById('totalRaw')?.dataset?.value || 0);
        let totalBase = 0;
        let totalWithInterest = 0;
        
        document.querySelectorAll('.payment-amount').forEach(input => {
            if (!isVisible(input)) return;
            
            const numericValue = parseCurrencyInput(input.value);
            const paymentGroup = input.closest('.input-group');
            const method = paymentGroup?.querySelector('.payment-method')?.value;
            const interestRateInput = paymentGroup?.querySelector('.interest-rate');
            const interestRate = parseFloat(interestRateInput?.value || 0);
            
            if (numericValue <= 0 || isNaN(numericValue)) {
                input.classList.add('is-invalid');
                errorMessages.push(`Invalid payment amount: ${input.value}`);
                isValid = false;
            }
            
            totalBase += numericValue;
            
            if (['credito', 'pix_credito'].includes(method)) {
                totalWithInterest += numericValue * (1 + interestRate / 100);
            } else {
                totalWithInterest += numericValue;
            }
        });
        
        // Validate payment totals
        if (Math.abs(totalBase - subtotal) > CONFIG.CALCULATION_PRECISION) {
            errorMessages.push(
                `Payment sum (${formatCurrency(totalBase)}) must equal subtotal (${formatCurrency(subtotal)})`
            );
            isValid = false;
        }
        
        if (Math.abs(totalWithInterest - totalCalculated) > CONFIG.CALCULATION_PRECISION) {
            errorMessages.push(
                `Total mismatch: Calculated ${formatCurrency(totalWithInterest)}, Expected ${formatCurrency(totalCalculated)}`
            );
            isValid = false;
        }
        
        if (errorMessages.length > 0) {
            showNotification(errorMessages.join('<br>'), 'danger', 8000);
        }
        
        return isValid;
    };

    // ========== IMPROVED FORM SUBMISSION ==========
    const handleSaleSubmit = async (e) => {
        e.preventDefault();
        clearErrors();
        
        if (!validateSale()) {
            return;
        }
        
        showLoading();
        
        try {
            const saleData = {
                clientId: document.getElementById('clientSelect').value,
                saleDate: document.getElementById('saleDate').value,
                products: Array.from(document.querySelectorAll('.product-item')).map(item => {
                    const select = item.querySelector('select');
                    const selectedOption = select.options[select.selectedIndex];
                    return {
                        productId: select.value,
                        quantity: parseInt(item.querySelector('.quantity').value),
                        price: parseFloat(selectedOption.dataset.price)
                    };
                }),
                payments: Array.from(document.querySelectorAll('.payment-method'))
                    .filter(method => isVisible(method))
                    .map(method => {
                        const dataIndex = method.getAttribute('data-index');
                        const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
                        const installmentsInput = document.querySelector(`.installments[data-index="${dataIndex}"]`);
                        const interestInput = document.querySelector(`.interest-field[data-index="${dataIndex}"] .interest-rate`);
                        const statusInput = document.querySelector(`.payment-status[data-index="${dataIndex}"]`);
                        
                        return {
                            method: method.value,
                            amount: parseCurrencyInput(amountInput.value),
                            interest: parseFloat(interestInput?.value || 0),
                            installments: parseInt(installmentsInput?.value || 1),
                            status: statusInput?.checked ? 'paid' : 'pending'
                        };
                    })
                    .filter(payment => payment.method && payment.amount > 0)
            };
            
            console.log('Submitting sale data:', saleData);
            
            const response = await retryFetch('/api/vendas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(saleData)
            });
            
            const result = await response.json();
            
            showNotification('Sale registered successfully!', 'success', 3000);
            
            // Reset form after successful submission
            setTimeout(() => {
                document.getElementById('saleForm').reset();
                document.getElementById('productsContainer').innerHTML = '';
                calculateTotals();
            }, 1000);
            
        } catch (error) {
            console.error('Sale submission error:', error);
            showNotification(
                `Failed to register sale: ${error.message}`,
                'danger',
                8000
            );
        } finally {
            hideLoading();
        }
    };

    // ========== IMPROVED UTILITY FUNCTIONS ==========
    const showLoading = () => {
        hideLoading(); // Remove any existing loader
        
        const loader = document.createElement('div');
        loader.className = 'overlay-loading';
        loader.innerHTML = `
            <div class="d-flex flex-column align-items-center">
                <div class="spinner-border text-primary mb-3" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="text-muted">Processing sale...</div>
            </div>
        `;
        
        document.body.appendChild(loader);
    };

    const hideLoading = () => {
        document.querySelectorAll('.overlay-loading').forEach(loader => loader.remove());
    };

    const clearErrors = () => {
        document.querySelectorAll('.is-invalid').forEach(element => {
            element.classList.remove('is-invalid');
        });
        
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = '';
        }
        
        document.querySelectorAll('.notification').forEach(notification => {
            notification.remove();
        });
    };

    // ========== EVENT LISTENERS SETUP ==========
    const setupEventListeners = () => {
        // Toggle payment method
        const togglePaymentMethod = document.getElementById('togglePaymentMethod');
        if (togglePaymentMethod) {
            togglePaymentMethod.addEventListener('change', handlePaymentMethodToggle);
        }
        
        // Show/hide new sale form
        const showNewSaleForm = document.getElementById('showNewSaleForm');
        if (showNewSaleForm) {
            showNewSaleForm.addEventListener('click', () => {
                const form = document.getElementById('newSaleForm');
                if (form) {
                    form.classList.toggle('d-none');
                }
            });
        }
        
        // Add product button
        const addProductBtn = document.getElementById('addProductBtn');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', addProductRow);
        }
        
        // Currency input handling
        document.body.addEventListener('keydown', e => {
            const input = e.target;
            if (!input.classList.contains('payment-amount')) return;
            
            if (input.dataset.editing !== "true") {
                input.value = formatDisplayCurrency(parseCurrencyInput(input.value));
            }
            
            // Handle currency input with cents mapping
            if (/^\d$/.test(e.key) || e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                let cents = centsMap.get(input) || 0;
                
                if (/^\d$/.test(e.key)) {
                    cents = cents * 10 + Number(e.key);
                } else {
                    cents = Math.floor(cents / 10);
                }
                
                centsMap.set(input, cents);
                updateCurrencyInput(input);
            }
        });
        
        // Focus handling for currency inputs
        document.body.addEventListener('focusin', e => {
            const input = e.target;
            if (!input.classList.contains('payment-amount')) return;
            
            const raw = parseCurrencyInput(input.value);
            centsMap.set(input, Math.round(raw * 100));
        });
        
        document.body.addEventListener('focusout', e => {
            const input = e.target;
            if (!input.classList.contains('payment-amount')) return;
            updateCurrencyInput(input);
        });
        
        // Payment method changes
        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('payment-method')) {
                handlePaymentMethodChange(e);
            }
        });
        
        // Payment amount changes
        document.body.addEventListener('input', (e) => {
            if (e.target.classList.contains('payment-amount')) {
                calculateTotals();
            }
        });
        
        // Form submission
        const saleForm = document.getElementById('saleForm');
        if (saleForm) {
            saleForm.addEventListener('submit', handleSaleSubmit);
        }
        
        // Installment payment marking
        document.body.addEventListener('click', async e => {
            const btn = e.target.closest('button.mark-installment-paid');
            if (!btn) return;
            
            const installmentId = btn.dataset.installmentId;
            if (!installmentId) {
                console.error('Installment ID not found on button', btn);
                return;
            }
            
            if (!confirm('Mark this installment as paid?')) return;
            
            try {
                const response = await retryFetch(`/api/installments/${installmentId}/pay`, {
                    method: 'PATCH'
                });
                
                btn.replaceWith('<i class="bi bi-check-circle-fill text-success" title="Paid"></i>');
                showNotification('Installment marked as paid', 'success', 3000);
                
            } catch (error) {
                console.error('Failed to mark installment as paid:', error);
                showNotification('Failed to update payment status', 'danger');
            }
        });
    };

    // Helper function for currency input updates
    const updateCurrencyInput = (input) => {
        const cents = centsMap.get(input) || 0;
        const value = (cents / 100).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        input.value = value;
        calculateTotals();
    };

    // ========== REMAINING FUNCTIONS (SIMPLIFIED) ==========
    const populatePaymentMethods = () => {
        const baseSelect = document.querySelector('[data-index="1"]');
        if (!baseSelect) return;
        
        const baseOptions = baseSelect.options;
        document.querySelectorAll('.payment-method').forEach(select => {
            if (select.options.length <= 1) {
                Array.from(baseOptions).forEach((option, index) => {
                    if (index > 0) {
                        select.appendChild(option.cloneNode(true));
                    }
                });
            }
        });
    };

    function handlePaymentMethodChange(event) {
        const dataIndex = event.target.getAttribute('data-index');
        const method = event.target.value;
        const isCredit = ['credito', 'pix_credito'].includes(method);
      
        // Busca direta pelos elementos corretos
        const interestField     = document.querySelector(`.interest-field[data-index="${dataIndex}"]`);
        const installmentsField = document.querySelector(`.installments[data-index="${dataIndex}"]`);
      
        if (interestField) {
          interestField.style.display = isCredit ? 'block' : 'none';
        }
        if (installmentsField) {
          installmentsField.style.display = isCredit ? 'flex' : 'none';
        }
        
        // Recalculate totals
        calculateTotals();
    };

    function setupPaymentMethodFields() {
        document.querySelectorAll('.payment-method').forEach(select => {
          select.removeEventListener('change', handlePaymentMethodChange);
          select.addEventListener('change', handlePaymentMethodChange);
          // dispara a atualização inicial
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    const setupPaymentMethodAutofill = () => {
        document.querySelectorAll('.payment-method').forEach(select => {
            select.addEventListener('change', function() {
                const activePayments = Array.from(document.querySelectorAll('.payment-method'))
                    .filter(method => isVisible(method));
                
                if (activePayments.length === 1) {
                    const totalRaw = document.getElementById('totalRaw');
                    const totalValue = parseFloat(totalRaw?.dataset?.value || 0);
                    const dataIndex = this.getAttribute('data-index');
                    const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
                    
                    if (amountInput && totalValue > 0) {
                        if (['credito', 'pix_credito'].includes(this.value)) {
                            const interestRateInput = document.querySelector(`.interest-field[data-index="${dataIndex}"] .interest-rate`);
                            const interestRate = parseFloat(interestRateInput?.value || 0);
                            const baseAmount = totalValue / (1 + interestRate / 100);
                            amountInput.value = formatDisplayCurrency(baseAmount);
                        } else {
                            amountInput.value = formatDisplayCurrency(totalValue);
                        }
                        calculateTotals();
                    }
                }
            });
        });
    };

    const setupInterestRateListeners = () => {
        document.querySelectorAll('.interest-rate').forEach(input => {
            input.addEventListener('input', function() {
                const dataIndex = this.closest('.interest-field').getAttribute('data-index');
                const method = document.querySelector(`.payment-method[data-index="${dataIndex}"]`);
                
                if (method && ['credito', 'pix_credito'].includes(method.value)) {
                    const subtotalElement = document.getElementById('subtotal');
                    const subtotal = parseFloat(subtotalElement?.dataset?.raw || 0);
                    const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
                    
                    if (amountInput && subtotal > 0) {
                        amountInput.value = formatDisplayCurrency(subtotal);
                        calculateTotals();
                    }
                }
            });
        });
    };

    // ========== GLOBAL FUNCTIONS ==========
    window.loadSale = async (saleId) => {
        try {
            const response = await retryFetch(`/api/vendas/${saleId}`);
            return await response.json();
        } catch (error) {
            console.error('Failed to load sale:', error);
            showNotification('Failed to load sale details', 'danger');
            return null;
        }
    };

    window.deleteSale = async (saleId) => {
        if (!confirm('Are you sure you want to delete this sale?')) {
            return;
        }
        
        try {
            showLoading();
            const response = await retryFetch(`/api/vendas/${saleId}`, {
                method: 'DELETE'
            });
            
            showNotification('Sale deleted successfully', 'success', 3000);
            setTimeout(() => location.reload(), 1000);
            
        } catch (error) {
            console.error('Failed to delete sale:', error);
            showNotification('Failed to delete sale', 'danger');
        } finally {
            hideLoading();
        }
    };

    // ========== INITIALIZATION ==========
    const initialize = async () => {
        try {
            showLoading();
            
            // Load data in parallel
            const [productsResult, campaignsResult] = await Promise.allSettled([
                loadProducts(),
                loadCampaigns()
            ]);
            
            // Log any failures
            if (productsResult.status === 'rejected') {
                console.error('Products loading failed:', productsResult.reason);
            }
            if (campaignsResult.status === 'rejected') {
                console.error('Campaigns loading failed:', campaignsResult.reason);
            }
            
            // Setup UI
            populatePaymentMethods();
            setupEventListeners();
            setupPaymentMethodAutofill();
            setupInterestRateListeners();
            setupPaymentMethodFields(); // Add this line
            calculateTotals();
            
            console.log('Sales system initialized successfully');
            
        } catch (error) {
            console.error('Initialization failed:', error);
            showNotification('System initialization failed. Please reload the page.', 'danger', 10000);
        } finally {
            hideLoading();
        }
    };

    // ========== STYLES ==========
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            .overlay-loading {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            }
            
            .notification {
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                border-radius: 6px;
            }
            
            .product-item {
                transition: all 0.3s ease;
            }
            
            .product-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .is-invalid {
                border-color: #dc3545 !important;
                animation: shake 0.5s ease-in-out;
            }
            
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            .payment-method:focus,
            .payment-amount:focus,
            .product-select:focus,
            .quantity:focus {
                box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
            }
            
            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .fade-in {
                animation: fadeIn 0.3s ease-in;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    };

    // ========== ERROR HANDLING ==========
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        showNotification('An unexpected error occurred. Please refresh the page if issues persist.', 'danger', 8000);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        showNotification('A network error occurred. Please check your connection.', 'warning', 5000);
    });

    // ========== START INITIALIZATION ==========
    injectStyles();
    initialize();
});
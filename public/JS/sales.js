document.addEventListener('DOMContentLoaded', () => {
    let productsData = [];
    let campaigns = [];

    // === FUNÇÃO AUXILIAR PARA VERIFICAR VISIBILIDADE ===
    const isVisible = (el) => {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    };

    // ========== FUNÇÕES DE CARREGAMENTO ==========
    const loadProducts = async () => {
        try {
            const response = await fetch('/api/produtos');
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            productsData = await response.json();
            console.log('Produtos carregados:', productsData); 
            if (!Array.isArray(productsData)) {
                throw new Error('Dados de produtos inválidos');
            }
        } catch (error) {
            console.error('Erro ao carregar produtos:', error);
            showNotification('Falha ao carregar produtos. Tente recarregar a página.', 'danger');
        }
    };

    const loadCampaigns = async () => {
        try {
            const response = await fetch('/api/campanhas');
            campaigns = await response.json();
        } catch (error) {
            console.error('Erro ao carregar campanhas:', error);
        }
    };

    // ========== NOTIFICAÇÃO NO TOPO ==========
    const showNotification = (message, type = 'danger', duration = 5000) => {
        let notification = document.createElement('div');
        notification.className = `notification alert alert-${type}`;
        notification.innerHTML = `<span>${message}</span> <button class="btn-close" aria-label="Close"></button>`;
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.zIndex = '1100';
        notification.style.minWidth = '300px';
        notification.querySelector('.btn-close').addEventListener('click', () => {
            notification.remove();
        });
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, duration);
    };

    // ========== FUNÇÃO DE ATUALIZAÇÃO DO LUCRO MENSAL ==========
    function updateMonthlyProfit() {
        const subtotal = parseFloat(document.getElementById('subtotal').dataset.raw) || 0;
        const total = parseFloat(document.getElementById('totalRaw').dataset.value) || 0;
        
        let totalProfitWeighted = 0;
        document.querySelectorAll('.product-item').forEach(item => {
            const select = item.querySelector('.product-select');
            const quantity = parseInt(item.querySelector('.quantity').value) || 0;
            const price = parseFloat(select.options[select.selectedIndex].dataset.price || 0);
            const profitPercent = parseFloat(select.options[select.selectedIndex].dataset.profit || 0);
            totalProfitWeighted += price * quantity * profitPercent;
        });
        let weightedProfit = subtotal > 0 ? (totalProfitWeighted / subtotal) : 0;
        
        // Obtém o número de parcelas do método primário (data-index="1")
        const primaryInstallmentsInput = document.querySelector('.installments[data-index="1"]');
        const primaryInstallments = primaryInstallmentsInput ? parseInt(primaryInstallmentsInput.value) || 1 : 1;
        
        let monthlyProfit = (total / primaryInstallments) - (subtotal / primaryInstallments) - (((subtotal * weightedProfit) / 100) / primaryInstallments);
        
        document.querySelector('.profit p:last-child').textContent = `R$ ${monthlyProfit.toFixed(2)}`;
    }

    // ========== EVENTO PARA ALTERAÇÃO DA FORMA DE PAGAMENTO ==========
    document.getElementById('togglePaymentMethod').addEventListener('change', function() {
        const paymentMethod2 = document.getElementById('paymentMethod2');
        const isActive = paymentMethod2.classList.toggle('d-none');
        const layoutPaymentMethods = document.querySelector('.payment-methods-container');
        
        console.log('Switch checked:', this.checked);
        
        if (this.checked) {
            paymentMethod2.classList.remove('d-none');
            paymentMethod2.querySelector('.payment-method').innerHTML = document.querySelector('.payment-method[data-index="1"]').innerHTML;
            layoutPaymentMethods.classList.remove('justify-content-start');
            layoutPaymentMethods.classList.add('justify-content-center');
        } else {
            paymentMethod2.classList.add('d-none');
            paymentMethod2.querySelector('.payment-method').value = '';
            paymentMethod2.querySelector('.payment-amount').value = '';
            layoutPaymentMethods.classList.remove('justify-content-center');
            layoutPaymentMethods.classList.add('justify-content-start');
        }

        const method2Select = paymentMethod2.querySelector('.payment-method');
        const method2Input = paymentMethod2.querySelector('.payment-amount');
        
        if (!isActive) {
            method2Select.required = true;
            method2Input.required = true;
        } else {
            method2Select.required = false;
            method2Input.required = false;
            method2Select.value = '';
            method2Input.value = '';
        }
        
        console.log('Classes do paymentMethod2:', paymentMethod2.classList);
        calculateTotals();
    });

    const populatePaymentMethods = () => {
        const baseOptions = document.querySelector('[data-index="1"]').options;
        document.querySelectorAll('.payment-method').forEach(select => {
            if (select.options.length <= 1) {
                Array.from(baseOptions).forEach((option, index) => {
                    if (index > 0) select.appendChild(option.cloneNode(true));
                });
            }
        });
    };

    const addProductRow = () => {
        if (!productsData || productsData.length === 0) {
            showNotification('Carregando produtos...', 'warning');
            loadProducts().then(() => addProductRow());
            return;
        }
        const container = document.getElementById('productsContainer');
        const index = container.children.length + 1;
        const html = `
            <div class="product-item mb-3" data-index="${index}">
                <div class="input-group">
                    <button type="button" class="btn btn-outline-danger remove-product">
                        <i class="bi bi-dash-circle"></i>
                    </button>
                    <select class="form-select product-select" required>
                        <option value="">Selecione um produto...</option>
                        ${productsData.map(p => {
                            const price = (p.promo_price ?? p.price ?? 0);
                            const formattedPrice = String(price).replace(',', '.');
                            return `
                                <option value="${p.id}" 
                                        data-price="${formattedPrice}"
                                        data-profit="${p.profit_percentage || 0}"
                                        data-stock="${p.stock}">
                                    ${p.name} - ${p.brand} (${p.stock} em estoque)
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
        
        row.querySelector('.remove-product').addEventListener('click', () => {
            row.remove();
            calculateTotals();
        });
        row.querySelector('.product-select').addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const rawPrice = parseFloat(selectedOption?.dataset?.price || 0);
            const priceElement = row.querySelector('.product-price');
            priceElement.dataset.rawPrice = rawPrice.toFixed(2);
            priceElement.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rawPrice);
            calculateTotals();
        });
        row.querySelector('.quantity').addEventListener('input', () => {
            calculateTotals();
        });
    };

    const setupEventListeners = () => {
        document.getElementById('showNewSaleForm').addEventListener('click', () => {
            document.getElementById('newSaleForm').classList.toggle('d-none');
        });
        document.getElementById('addProductBtn').addEventListener('click', addProductRow);
        document.querySelectorAll('.payment-method').forEach(select => {
            select.addEventListener('change', handlePaymentMethodChange);
        });
        document.querySelectorAll('.payment-amount.active-payment:not([disabled])').forEach(input => {
            input.addEventListener('input', function(e) {
                const rawValue = formatCurrencyInput(e.target.value);
                e.target.value = formatDisplayCurrency(rawValue);
                calculateTotals();
            });
        });
        document.querySelectorAll('.payment-amount').forEach(input => {
            input.addEventListener('input', function(e) {
                const rawValue = e.target.value;
                const formattedValue = formatCurrencyInput(rawValue);
                e.target.value = formattedValue;
                calculateTotals();
            });
        });
        document.getElementById('saleForm').addEventListener('submit', handleSaleSubmit);
        document.body.addEventListener('change', (e) => {
            if (e.target.classList.contains('payment-method')) {
                handlePaymentMethodChange(e);
            }
        });
        document.body.addEventListener('input', (e) => {
            if (e.target.classList.contains('payment-amount')) {
                calculateTotals();
            }
        });
    };

    // === FUNÇÃO ATUALIZADA PARA CONVERTER VALOR DE MOEDA ===
    const parseCurrencyInput = (value) => {
        if (!value) return 0;
        // Remove "R$", espaços e outros caracteres não numéricos, remove pontos e converte vírgula para ponto
        const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(/,/g, '.');
        return parseFloat(cleaned) || 0;
    };

    const formatCurrencyInput = (value) => {
        let cleaned = value.replace(/[^\d,]/g, '');
        const parts = cleaned.split(',');
        if (parts.length > 2) cleaned = parts[0] + ',' + parts.slice(1).join('');
        return cleaned;
    };

    const formatDisplayCurrency = (value) => {
        return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const calculateTotals = () => {
        let subtotal = 0;
        document.querySelectorAll('.product-item').forEach(item => {
            const priceElement = item.querySelector('.product-price');
            const price = parseFloat(priceElement.dataset.rawPrice || 0);
            const quantity = parseInt(item.querySelector('.quantity').value) || 0;
            subtotal += price * quantity;
        });
      
        let totalInterest = 0;
        let totalBase = 0;
        // Itera por todos os elementos de pagamento, processando apenas os visíveis
        document.querySelectorAll('.payment-method').forEach(method => {
            if (!isVisible(method)) return;
            const dataIndex = method.getAttribute('data-index');
            const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
            let baseValue = parseCurrencyInput(amountInput.value);
            let interest = 0;
            let paymentTotal = baseValue;
            
            if (['credito', 'pix_credito'].includes(method.value)) {
                const interestRate = parseFloat(
                  document.querySelector(`.interest-field[data-index="${dataIndex}"] .interest-rate`)?.value || 0
                );
                interest = baseValue * (interestRate / 100);
                paymentTotal = baseValue + interest;
                const interestDetail = document.querySelector(`.interest-detail[data-index="${dataIndex}"]`);
                if (interestDetail) {
                    interestDetail.innerHTML = `<small class="text-muted">Juros: ${formatCurrency(interest)}</small>`;
                }
            }
            
            totalInterest += interest;
            totalBase += baseValue;
            
            const methodTotal = document.querySelector(`.method-total[data-index="${dataIndex}"]`);
            if (methodTotal) {
                methodTotal.textContent = `Total: ${formatCurrency(paymentTotal)}`;
            }
            amountInput.value = formatDisplayCurrency(baseValue);
        });
        
        const total = subtotal + totalInterest;
        
        // Atualiza os elementos de resumo
        document.getElementById('subtotal').textContent = formatCurrency(subtotal);
        document.getElementById('subtotal').dataset.raw = subtotal.toFixed(2);
        document.getElementById('totalRaw').dataset.subtotal = subtotal.toFixed(2);
        document.getElementById('totalRaw').dataset.value = total.toFixed(2);
        
        // Atualiza o span que mostra o total da compra
        document.getElementById('totalAmount').textContent = formatCurrency(total);
      
        const paymentMethod2 = document.getElementById('paymentMethod2');
        const isSecondMethodActive = !paymentMethod2.classList.contains('d-none');
        const firstPaymentInput = document.querySelector('.payment-amount[data-index="1"]');
        if (!isSecondMethodActive) {
            firstPaymentInput.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
            firstPaymentInput.setAttribute('readonly', 'true');
        } else {
            firstPaymentInput.removeAttribute('readonly');
        }
        
        updateMonthlyProfit();
    };

    const setupPaymentMethodAutofill = () => {
        document.querySelectorAll('.payment-method').forEach(select => {
            select.addEventListener('change', function() {
                const activePayments = [];
                document.querySelectorAll('.payment-method').forEach(method => {
                    if (isVisible(method)) activePayments.push(method);
                });
                if (activePayments.length === 1) {
                    const totalValue = parseFloat(document.getElementById('totalRaw').dataset.value);
                    const method = activePayments[0].value;
                    const dataIndex = activePayments[0].getAttribute('data-index');
                    const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
                    if (amountInput) {
                        if (['credito', 'pix_credito'].includes(method)) {
                            const interestRate = parseFloat(document.querySelector(`.interest-field[data-index="${dataIndex}"] .interest-rate`)?.value) || 0;
                            amountInput.value = (totalValue / (1 + interestRate/100)).toFixed(2).replace('.', ',');
                        } else {
                            amountInput.value = totalValue.toFixed(2).replace('.', ',');
                        }
                    }
                    calculateTotals();
                }
            });
        });
    };

    const setupInterestRateListeners = () => {
        document.querySelectorAll('.interest-rate').forEach(input => {
            input.addEventListener('input', function() {
                const dataIndex = this.closest('.interest-field').getAttribute('data-index');
                const method = document.querySelector(`.payment-method[data-index="${dataIndex}"]`).value;
                if (['credito', 'pix_credito'].includes(method)) {
                    const subtotal = parseFloat(document.getElementById('subtotal').dataset.raw);
                    const interestRate = parseFloat(this.value) || 0;
                    const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
                    if (amountInput) {
                        amountInput.value = (subtotal * (1 + interestRate/100)).toFixed(2).replace('.', ',');
                    }
                    calculateTotals();
                }
            });
        });
    };

    const handlePaymentMethodChange = (event) => {
        const dataIndex = event.target.getAttribute('data-index');
        const interestField = document.querySelector(`.interest-field[data-index="${dataIndex}"]`);
        interestField.style.display = ['credito', 'pix_credito'].includes(event.target.value) ? 'block' : 'none';
        calculateTotals();
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

    const validateSale = () => {
        let isValid = true;
        clearErrors();
        const errorMessages = [];
        
        if (!document.getElementById('clientSelect').value) {
            errorMessages.push('Selecione um cliente');
            isValid = false;
        }
        
        const products = document.querySelectorAll('.product-item');
        if (products.length === 0) {
            errorMessages.push('Adicione pelo menos um produto');
            isValid = false;
        }
    
        const subtotal = parseFloat(document.getElementById('totalRaw').dataset.subtotal || 0);
        const totalCalculated = parseFloat(document.getElementById('totalRaw').dataset.value || 0);
        let totalBase = 0;
        let totalWithInterest = 0;
    
        document.querySelectorAll('.payment-amount').forEach(input => {
            if (!isVisible(input)) return; // ignora inputs ocultos
            const numericValue = parseCurrencyInput(input.value);
            const method = input.closest('.input-group').querySelector('.payment-method').value;
            const interestRate = parseFloat(input.closest('.input-group').querySelector('.interest-rate')?.value || 0);
    
            if (numericValue <= 0 || isNaN(numericValue)) {
                input.classList.add('is-invalid');
                errorMessages.push(`Valor inválido no pagamento: ${input.value}`);
                isValid = false;
            }
    
            totalBase += numericValue;
            if (['credito', 'pix_credito'].includes(method)) {
                totalWithInterest += numericValue * (1 + interestRate/100);
            } else {
                totalWithInterest += numericValue;
            }
        });
    
        if (Math.abs(totalBase - subtotal) > 0.01) {
            errorMessages.push(
                `A soma dos pagamentos (${formatCurrency(totalBase)}) deve ser igual ao subtotal (${formatCurrency(subtotal)})`
            );
            isValid = false;
        }
    
        if (Math.abs(totalWithInterest - totalCalculated) > 0.01) {
            errorMessages.push(
                `Diferença total:<br>
                Calculado (com juros): ${formatCurrency(totalWithInterest)}<br>
                Esperado: ${formatCurrency(totalCalculated)}`
            );
            isValid = false;
        }
    
        if (errorMessages.length > 0) {
            showNotification(errorMessages.join('<br>'), 'danger', 5000);
        }
    
        return isValid;
    };

    const handleSaleSubmit = async (e) => {
        e.preventDefault();
        clearErrors();
      
        if (!validateSale()) return;
      
        showLoading();
        let saleData = {};
        let response; // Declarada aqui para uso no catch
        try {
            saleData = {
                clientId: document.getElementById('clientSelect').value,
                saleDate: document.getElementById('saleDate').value,
                products: Array.from(document.querySelectorAll('.product-item')).map(item => {
                    const select = item.querySelector('select');
                    return {
                        productId: select.value,
                        quantity: parseInt(item.querySelector('.quantity').value),
                        price: parseFloat(select.options[select.selectedIndex].dataset.price)
                    };
                }),
                payments: Array.from(document.querySelectorAll('.payment-method')).map(method => {
                    if (!isVisible(method)) return null;
                    const dataIndex = method.getAttribute('data-index');
                    const amountInput = document.querySelector(`.payment-amount[data-index="${dataIndex}"]`);
                    const installmentsInput = document.querySelector(`.installments[data-index="${dataIndex}"]`);
                    return {
                        method: method.value,
                        amount: parseCurrencyInput(amountInput.value),
                        interest: parseFloat(document.querySelector(`.interest-field[data-index="${dataIndex}"] .interest-rate`)?.value) || 0,
                        installments: parseInt(installmentsInput.value),
                        status: document.querySelector(`.payment-status[data-index="${dataIndex}"]`).checked ? 'paid' : 'pending'
                    };
                }).filter(p => p && p.method && p.amount > 0)
            };
            console.log("[DEBUG] Enviando requisição para /api/vendas", saleData);
            response = await fetch('/api/vendas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saleData)
            });
            console.log("[DEBUG] Resposta recebida:", response.status);
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Erro desconhecido');
            }
            showNotification('Venda registrada com sucesso!', 'success', 5000);
            setTimeout(() => { location.reload(); }, 2000);
        } catch (error) {
            console.error('Erro detalhado:', error);
            showNotification(`Erro: ${error.message} (Status: ${response?.status || 'Desconhecido'})`, 'danger', 5000);
        } finally {
            document.querySelector('.overlay-loading')?.remove();
        }
        console.log('Enviando dados:', saleData);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    };

    const showLoading = () => {
        const loader = document.createElement('div');
        loader.className = 'overlay-loading';
        loader.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
        `;
        document.body.appendChild(loader);
    };

    // ========== INICIALIZAÇÃO ==========
    const initialize = async () => {
        await loadProducts();
        await loadCampaigns();
        populatePaymentMethods();
        setupEventListeners();
        setupPaymentMethodAutofill();
        setupInterestRateListeners();
        calculateTotals();
    };

    const style = document.createElement('style');
    style.textContent = `
        .overlay-loading {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
    `;
    document.head.appendChild(style);

    window.loadSale = async (saleId) => {
        try {
            const response = await fetch(`/api/vendas/${saleId}`);
            return await response.json();
        } catch (error) {
            console.error('Erro ao carregar venda:', error);
        }
    };

    window.deleteSale = async (saleId) => {
        if (confirm('Tem certeza que deseja excluir esta venda?')) {
            try {
                const response = await fetch(`/api/vendas/${saleId}`, { method: 'DELETE' });
                if (response.ok) location.reload();
            } catch (error) {
                console.error('Erro ao excluir venda:', error);
            }
        }
    };

    initialize();
});

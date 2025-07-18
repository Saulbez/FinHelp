// Global variables
let searchTimeout;
let priceTimeout;
let currentProducts = [];
let isLoading = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeProfitCalculators();
    loadStatistics();
    loadProducts();
    loadBrands();
});

// Initialize all event listeners
function initializeEventListeners() {
    // Search and filter event listeners
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    document.getElementById('brandFilter').addEventListener('change', filterProducts);
    document.getElementById('categoryFilter').addEventListener('change', filterProducts);
    document.getElementById('minPrice').addEventListener('input', handlePriceInput);
    document.getElementById('maxPrice').addEventListener('input', handlePriceInput);
    document.getElementById('lowStockFilter').addEventListener('change', filterProducts);
    document.getElementById('onSaleFilter').addEventListener('change', filterProducts);
    document.getElementById('sortBy').addEventListener('change', filterProducts);
    document.getElementById('sortOrder').addEventListener('change', filterProducts);
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);

    // Form event listeners
    document.getElementById('newProductForm').addEventListener('submit', handleNewProductSubmit);
    document.getElementById('editProductForm').addEventListener('submit', handleEditProductSubmit);

    // Image preview event listeners
    document.getElementById('newImageInput').addEventListener('change', function(e) {
        handleImagePreview(e, 'newImagePreview');
    });
    document.getElementById('editImageInput').addEventListener('change', function(e) {
        handleImagePreview(e, 'editImagePreview');
    });

    // Modal event listeners
    document.getElementById('brandsModal').addEventListener('show.bs.modal', loadBrands);
    document.getElementById('newBrandName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addBrand();
        }
    });
}

// Initialize profit calculators
function initializeProfitCalculators() {
    // New Product Calculator
    document.getElementById('newCostPrice').addEventListener('input', function() {
        calculateProfit('new');
    });
    document.getElementById('newSellPrice').addEventListener('input', function() {
        calculateProfit('new');
    });

    // Edit Product Calculator
    document.getElementById('editCostPrice').addEventListener('input', function() {
        calculateProfit('edit');
    });
    document.getElementById('editSellPrice').addEventListener('input', function() {
        calculateProfit('edit');
    });

    // Campaign Calculator
    document.getElementById('campaignCostPrice').addEventListener('input', function() {
        calculateProfit('campaign');
    });
    document.getElementById('campaignSellPrice').addEventListener('input', function() {
        calculateProfit('campaign');
    });
}

// Calculate profit based on cost and sell prices
function calculateProfit(type) {
    const costPriceId = type + 'CostPrice';
    const sellPriceId = type + 'SellPrice';
    const profitAmountId = type + 'ProfitAmount';
    const profitPercentId = type + 'ProfitPercent';

    const costPrice = parseFloat(document.getElementById(costPriceId).value) || 0;
    const sellPrice = parseFloat(document.getElementById(sellPriceId).value) || 0;

    if (costPrice > 0 && sellPrice > 0) {
        const profit = sellPrice - costPrice;
        const profitPercent = ((profit / costPrice) * 100);

        document.getElementById(profitAmountId).textContent = formatCurrency(profit);
        document.getElementById(profitPercentId).textContent = profitPercent.toFixed(2) + '%';
        
        // Color coding for profit percentage
        const percentElement = document.getElementById(profitPercentId);
        percentElement.className = 'fw-bold';
        if (profitPercent < 0) {
            percentElement.classList.add('text-danger');
        } else if (profitPercent < 20) {
            percentElement.classList.add('text-warning');
        } else {
            percentElement.classList.add('text-success');
        }
    } else {
        document.getElementById(profitAmountId).textContent = 'R$ 0,00';
        document.getElementById(profitPercentId).textContent = '0%';
        document.getElementById(profitPercentId).className = 'fw-bold text-muted';
    }
}

// Copy calculated profit percentage to the input field
function copyCalculatedProfit(type) {
    const profitPercentText = document.getElementById(type + 'ProfitPercent').textContent;
    const profitPercent = parseFloat(profitPercentText.replace('%', ''));
    
    if (!isNaN(profitPercent)) {
        let inputId;
        if (type === 'new') {
            inputId = 'newProfitPercentInput';
        } else if (type === 'edit') {
            inputId = 'editProductProfit';
        } else if (type === 'campaign') {
            inputId = 'campaignProfitPercentInput';
        }
        
        document.getElementById(inputId).value = profitPercent.toFixed(2);
        
        // Show success feedback
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="bi bi-check me-2"></i>Copiado!';
        button.classList.remove('btn-outline-success');
        button.classList.add('btn-success');
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('btn-success');
            button.classList.add('btn-outline-success');
        }, 1500);
    }
}

// Format currency for display
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Handle search input with debounce
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterProducts, 300);
}

// Handle price input with debounce
function handlePriceInput() {
    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(filterProducts, 300);
}

// Load statistics from API
async function loadStatistics() {
    try {
        const response = await fetch('/api/estatisticas');
        const stats = await response.json();
        
        document.getElementById('totalProducts').textContent = stats.total_products || 0;
        document.getElementById('totalBrands').textContent = stats.total_brands || 0;
        document.getElementById('lowStockCount').textContent = stats.low_stock_count || 0;
        document.getElementById('productsOnSale').textContent = stats.products_on_sale || 0;
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Main filter function
async function filterProducts() {
    if (isLoading) return;
    
    isLoading = true;
    showLoading();
    
    const params = buildFilterParams();
    
    try {
        const response = await fetch(`/api/produtos?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const products = await response.json();
        currentProducts = products;
        renderProducts(products);
        
    } catch (error) {
        console.error('Erro na busca:', error);
        showError('Erro ao carregar produtos. Tente novamente.');
    } finally {
        isLoading = false;
        hideLoading();
    }
}

// Build filter parameters
function buildFilterParams() {
    const params = new URLSearchParams();
    
    const searchTerm = document.getElementById('searchInput').value.trim();
    const brand = document.getElementById('brandFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;
    const lowStock = document.getElementById('lowStockFilter').checked;
    const onSale = document.getElementById('onSaleFilter').checked;
    const sortBy = document.getElementById('sortBy').value;
    const sortOrder = document.getElementById('sortOrder').value;

    if (searchTerm) params.append('search', searchTerm);
    if (brand !== 'all') params.append('brand', brand);
    if (category !== 'all') params.append('category', category);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);
    if (lowStock) params.append('lowStock', 'true');
    if (onSale) params.append('onSale', 'true');
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);

    return params;
}

// Initial load of products
async function loadProducts() {
    await filterProducts();
}

// Render products in the grid
function renderProducts(products) {
    const container = document.getElementById('productsContainer');
    const noResults = document.getElementById('noResults');
    
    container.innerHTML = '';
    
    if (!products || products.length === 0) {
        noResults.classList.remove('d-none');
        return;
    }
    
    noResults.classList.add('d-none');
    
    products.forEach(product => {
        const productCard = createProductCard(product);
        container.appendChild(productCard);
    });
}

// Create product card element
function createProductCard(product) {
    const col = document.createElement('div');
    col.className = 'col';
    
    const isOnSale = product.has_active_promo;
    const currentPrice = product.current_price;
    const originalPrice = product.original_price;
    const isLowStock = product.stock <= 5;
    
    col.innerHTML = `
        <div class="card h-100 shadow-sm">
            <div class="position-relative">
                <img src="${product.image}" class="card-img-top object-fit-cover" 
                     alt="${product.name}" style="height: 200px;"
                     onerror="this.onerror=null; this.src='/images/products/default-product.png';">
                ${isOnSale ? '<span class="badge bg-danger position-absolute top-0 start-0 m-2">PROMOÇÃO</span>' : ''}
                ${isLowStock ? '<span class="badge bg-warning position-absolute top-0 end-0 m-2">ESTOQUE BAIXO</span>' : ''}
            </div>
            <div class="card-body d-flex flex-column">
                <h6 class="card-title">${product.name}</h6>
                <p class="card-text text-muted mb-1">${product.brand_name}</p>
                ${product.category ? `<p class="card-text text-muted mb-2"><small>${product.category}</small></p>` : ''}
                
                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            ${isOnSale ? `
                                <span class="text-decoration-line-through text-muted">R$ ${parseFloat(originalPrice).toFixed(2)}</span><br>
                                <span class="fw-bold text-danger">R$ ${parseFloat(currentPrice).toFixed(2)}</span>
                            ` : `
                                <span class="fw-bold">R$ ${parseFloat(currentPrice).toFixed(2)}</span>
                            `}
                        </div>
                        <span class="badge ${isLowStock ? 'bg-warning' : 'bg-success'}">
                            ${product.stock} un.
                        </span>
                    </div>
                    
                    <div class="btn-group w-100" role="group">
                        <button class="btn btn-outline-primary btn-sm" onclick="editProduct(${product.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deleteProduct(${product.id}, '${product.name}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return col;
}

function handleImagePreview(event, previewId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        // Set to default image if no file selected
        preview.src = '/images/products/default-product.png';
    }
}

// Clear all filters
function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('brandFilter').value = 'all';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('lowStockFilter').checked = false;
    document.getElementById('onSaleFilter').checked = false;
    document.getElementById('sortBy').value = 'name';
    document.getElementById('sortOrder').value = 'ASC';
    
    filterProducts();
}

// Handle new product form submission
async function handleNewProductSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Criando...';
        
        const response = await fetch('/api/produtos', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar produto');
        }
        
        // Close modal and refresh
        bootstrap.Modal.getInstance(document.getElementById('newProductModal')).hide();
        resetNewProductForm();
        
        showSuccess('Produto criado com sucesso!');
        loadProducts();
        loadStatistics();
        
    } catch (error) {
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Criar Produto';
    }
}

// Reset new product form
function resetNewProductForm() {
    const form = document.getElementById('newProductForm');
    form.reset();
    document.getElementById('newImagePreview').src = '/images/products/default-product.png';
    
    // Reset calculator
    document.getElementById('newCostPrice').value = '';
    document.getElementById('newSellPrice').value = '';
    document.getElementById('newProfitAmount').textContent = 'R$ 0,00';
    document.getElementById('newProfitPercent').textContent = '0%';
    document.getElementById('newProfitPercent').className = 'fw-bold text-muted';
}

// Handle edit product form submission
async function handleEditProductSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const productId = document.getElementById('editProductId').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';
        
        // Add current image if no new image selected
        if (!formData.get('image').name) {
            formData.append('currentImage', document.getElementById('existingImage').value);
        }
        
        const response = await fetch(`/api/produtos/${productId}`, {
            method: 'PUT',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar produto');
        }
        
        // Close modal and refresh
        bootstrap.Modal.getInstance(document.getElementById('editProductModal')).hide();
        
        showSuccess('Produto atualizado com sucesso!');
        loadProducts();
        loadStatistics();
        
    } catch (error) {
        showError(error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Salvar Alterações';
    }
}

// Edit product function
async function editProduct(productId) {
    try {
        const response = await fetch(`/api/produtos/${productId}`);
        
        if (!response.ok) {
            throw new Error('Produto não encontrado');
        }
        
        const product = await response.json();
        
        // Fill form
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductBrand').value = product.brand;
        document.getElementById('editProductCategory').value = product.category || '';
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductStock').value = product.stock;
        document.getElementById('editProductProfit').value = product.profit_percent || '';
        document.getElementById('editImagePreview').src = product.image;
        document.getElementById('existingImage').value = product.image;
        
        // Reset calculator
        document.getElementById('editCostPrice').value = '';
        document.getElementById('editSellPrice').value = '';
        document.getElementById('editProfitAmount').textContent = 'R$ 0,00';
        document.getElementById('editProfitPercent').textContent = '0%';
        document.getElementById('editProfitPercent').className = 'fw-bold text-muted';
        
        // Show modal
        new bootstrap.Modal(document.getElementById('editProductModal')).show();
        
    } catch (error) {
        showError(error.message);
    }
}

// Delete product function
async function deleteProduct(productId, productName) {
    if (!confirm(`Tem certeza que deseja excluir o produto "${productName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/produtos/${productId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao excluir produto');
        }
        
        showSuccess('Produto excluído com sucesso!');
        loadProducts();
        loadStatistics();
        
    } catch (error) {
        showError(error.message);
    }
}

// Handle image preview
function handleImagePreview(event, previewId) {
    const file = event.target.files[0];
    const preview = document.getElementById(previewId);
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Load brands for management
async function loadBrands() {
    try {
        const response = await fetch('/api/marcas');
        const brands = await response.json();
        
        const container = document.getElementById('brandsList');
        container.innerHTML = '';
        
        if (brands.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhuma marca cadastrada</div>';
            return;
        }
        
        brands.forEach(brand => {
            const brandItem = document.createElement('div');
            brandItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            brandItem.innerHTML = `
                <div>
                    <strong>${brand.name}</strong>
                    <small class="text-muted d-block">${brand.product_count} produto(s)</small>
                </div>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="editBrand(${brand.id}, '${brand.name}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteBrand(${brand.id}, '${brand.name}', ${brand.product_count})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(brandItem);
        });
        
    } catch (error) {
        console.error('Erro ao carregar marcas:', error);
    }
}

// Add new brand
async function addBrand() {
    const nameInput = document.getElementById('newBrandName');
    const name = nameInput.value.trim();
    
    if (!name) {
        showError('Digite o nome da marca');
        return;
    }
    
    try {
        const response = await fetch('/api/marcas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao criar marca');
        }
        
        nameInput.value = '';
        showSuccess('Marca criada com sucesso!');
        loadBrands();
        
        // Refresh brand selects
        location.reload();
        
    } catch (error) {
        showError(error.message);
    }
}

// Edit brand
async function editBrand(brandId, currentName) {
    const newName = prompt('Novo nome da marca:', currentName);
    
    if (!newName || newName === currentName) {
        return;
    }
    
    try {
        const response = await fetch(`/api/marcas/${brandId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar marca');
        }
        
        showSuccess('Marca atualizada com sucesso!');
        loadBrands();
        
        // Refresh brand selects
        location.reload();
        
    } catch (error) {
        showError(error.message);
    }
}

// Delete brand
async function deleteBrand(brandId, brandName, productCount) {
    let confirmMessage = `Tem certeza que deseja excluir a marca "${brandName}"?`;
    
    if (productCount > 0) {
        confirmMessage += `\n\nISTO TAMBÉM EXCLUIRÁ ${productCount} PRODUTO(S) ASSOCIADO(S) A ESTA MARCA!`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const url = productCount > 0 ? `/api/marcas/${brandId}?force=true` : `/api/marcas/${brandId}`;
        
        const response = await fetch(url, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao excluir marca');
        }
        
        const result = await response.json();
        showSuccess(result.message);
        loadBrands();
        loadProducts();
        loadStatistics();
        
        // Refresh brand selects
        location.reload();
        
    } catch (error) {
        showError(error.message);
    }
}

// Utility functions
function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.remove('d-none');
    }
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.add('d-none');
    }
}

function showSuccess(message) {
    // Create a temporary toast or alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 end-0 m-3';
    alert.style.zIndex = '9999';
    alert.innerHTML = `
        <i class="bi bi-check-circle me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}

function showError(message) {
    // Create a temporary toast or alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 end-0 m-3';
    alert.style.zIndex = '9999';
    alert.innerHTML = `
        <i class="bi bi-exclamation-triangle me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.parentNode.removeChild(alert);
        }
    }, 5000);
}

// Add this function to load active campaigns for the management modal
async function loadCampaigns() {
    try {
        const response = await fetch('/api/campanhas');
        const campaigns = await response.json();
        
        const container = document.getElementById('campaignsList');
        container.innerHTML = '';
        
        if (campaigns.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Nenhuma campanha ativa encontrada</div>';
            return;
        }
        
        campaigns.forEach(campaign => {
            const startDate = new Date(campaign.start_date).toLocaleDateString('pt-BR');
            const endDate = new Date(campaign.end_date).toLocaleDateString('pt-BR');
            const isActive = new Date() >= new Date(campaign.start_date) && new Date() <= new Date(campaign.end_date);
            
            const campaignItem = document.createElement('div');
            campaignItem.className = 'list-group-item';
            campaignItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">${campaign.product_name}</h6>
                    <span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">${isActive ? 'Ativa' : 'Agendada'}</span>
                </div>
                <div class="row mb-2">
                    <div class="col-md-6 small">
                        <strong>Marca:</strong> ${campaign.brand_name || 'N/A'}
                    </div>
                    <div class="col-md-6 small">
                        <strong>Período:</strong> ${startDate} - ${endDate}
                    </div>
                </div>
                <div class="row mb-2">
                    <div class="col-md-6 small">
                        <strong>Preço normal:</strong> R$ ${parseFloat(campaign.original_price || 0).toFixed(2)}
                    </div>
                    <div class="col-md-6 small">
                        <strong>Preço promo:</strong> <span class="text-danger fw-bold">R$ ${parseFloat(campaign.promo_price || 0).toFixed(2)}</span>
                    </div>
                </div>
                <div class="d-flex justify-content-end mt-2">
                    <button class="btn btn-sm btn-outline-primary me-2" onclick="editCampaign(${campaign.id})">
                        <i class="bi bi-pencil"></i> Editar
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCampaign(${campaign.id}, '${campaign.product_name}')">
                        <i class="bi bi-trash"></i> Excluir
                    </button>
                </div>
            `;
            container.appendChild(campaignItem);
        });
    } catch (error) {
        console.error('Error loading campaigns:', error);
        showError('Erro ao carregar campanhas ativas');
    }
}

// Add edit campaign function
async function editCampaign(campaignId) {
    try {
        const response = await fetch(`/api/campanhas/${campaignId}`);
        
        if (!response.ok) {
            throw new Error('Campanha não encontrada');
        }
        
        const campaign = await response.json();
        
        // Fill edit form
        document.getElementById('editCampaignId').value = campaign.id;
        document.getElementById('editCampaignProduct').value = campaign.product_id;
        document.getElementById('editCampaignStartDate').value = formatDateForInput(campaign.start_date);
        document.getElementById('editCampaignEndDate').value = formatDateForInput(campaign.end_date);
        document.getElementById('editCampaignPromoPrice').value = campaign.promo_price;
        document.getElementById('editCampaignProfit').value = campaign.campaign_profit_percent || '';
        
        // Show modal
        new bootstrap.Modal(document.getElementById('editCampaignModal')).show();
        
    } catch (error) {
        showError(error.message);
    }
}

// Add delete campaign function
async function deleteCampaign(campaignId, productName) {
    // Use our custom confirmation dialog instead of the browser default
    showCustomConfirm(
        'Excluir Campanha',
        `Tem certeza que deseja excluir a campanha para "${productName}"?`,
        'Esta ação não pode ser desfeita e o produto voltará ao preço normal.',
        async () => {
            try {
                showLoading();
                
                const response = await fetch(`/api/campanhas/${campaignId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('Erro ao excluir campanha');
                }
                
                showSuccess('Campanha excluída com sucesso!');
                loadCampaigns();
                loadProducts(); // Refresh products to show updated pricing
                loadStatistics();
            } catch (error) {
                showError(error.message);
            } finally {
                hideLoading();
            }
        },
        'Excluir',
        'btn-danger'
    );
}

// Helper function to format date for input fields
function formatDateForInput(dateString) {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
}

// Add this to initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
    // Add to your existing DOMContentLoaded event
    document.getElementById('manageCampaignsBtn').addEventListener('click', loadCampaigns);
});

// Custom confirmation dialog functions if not already defined
function showCustomConfirm(title, message, details, callback, confirmBtnText = 'Confirmar', confirmBtnClass = 'btn-danger') {
    // Store the callback for later execution
    confirmCallback = callback;
    
    // Update modal content
    document.getElementById('confirmationModalLabel').textContent = title;
    document.getElementById('confirmationMessage').textContent = message;
    
    const detailsElement = document.getElementById('confirmationDetails');
    if (details) {
        detailsElement.textContent = details;
        detailsElement.style.display = 'block';
    } else {
        detailsElement.style.display = 'none';
    }
    
    // Configure the confirm button
    const confirmBtn = document.getElementById('confirmActionBtn');
    confirmBtn.textContent = confirmBtnText;
    
    // Reset all button classes and add the requested ones
    confirmBtn.className = 'btn px-4 ' + confirmBtnClass;
    
    // Show the modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
    confirmModal.show();
    
    // Set up the confirm button event handler
    confirmBtn.onclick = function() {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
        }
        confirmModal.hide();
    };
}

document.addEventListener('DOMContentLoaded', function() {
    const editCampaignForm = document.getElementById('editCampaignForm');
    if (editCampaignForm) {
        editCampaignForm.addEventListener('submit', handleEditCampaignSubmit);
    }
});

async function handleEditCampaignSubmit(e) {
    e.preventDefault();
    
    const campaignId = document.getElementById('editCampaignId').value;
    const formData = {
        product_id: document.getElementById('editCampaignProduct').value,
        start_date: document.getElementById('editCampaignStartDate').value,
        end_date: document.getElementById('editCampaignEndDate').value,
        promo_price: document.getElementById('editCampaignPromoPrice').value,
        profit_percentual: document.getElementById('editCampaignProfit').value || 0
    };
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Atualizando...';
        
        const response = await fetch(`/api/campanhas/${campaignId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao atualizar campanha');
        }
        
        // Close modal and refresh
        bootstrap.Modal.getInstance(document.getElementById('editCampaignModal')).hide();
        
        showSuccess('Campanha atualizada com sucesso!');
        loadCampaigns();
        loadProducts(); // Refresh products to show updated pricing
        loadStatistics();
        
    } catch (error) {
        showError(error.message);
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Atualizar Campanha';
    }
}
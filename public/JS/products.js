let searchTimeout;
let priceTimeout;
document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterProducts, 300);
});

// Função para filtrar produtos
async function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const brand = document.getElementById('brandFilter').value;
    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;

    // Validação de preços
    if ((minPrice && isNaN(minPrice)) || (maxPrice && isNaN(maxPrice))) {
        alert('Por favor, insira valores numéricos nos filtros de preço');
        return;
    }

    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (brand !== 'all') params.append('brand', brand);
    if (minPrice) params.append('minPrice', minPrice);
    if (maxPrice) params.append('maxPrice', maxPrice);

    try {
        const response = await fetch(`/api/produtos?${params.toString()}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || `HTTP error! status: ${response.status}`);
        }

        const products = await response.json();
        if (Array.isArray(products) && products.length === 0) {
            renderProducts("Nenhum produto atende aos critérios de busca");
          } else {
            renderProducts(products);
          }

    } catch (err) {
        console.error('Erro na busca:', err);
        document.getElementById('noResults').classList.remove('d-none');
    }
}

function renderProducts(products) {
    const container = document.querySelector('.row.row-cols-1.row-cols-sm-2.row-cols-md-3.row-cols-lg-4.g-4');
    container.innerHTML = '';

    products.forEach(product => {
        // Verifica promoção ativa
        const hasActivePromo = product.promo_price && 
            new Date(product.end_date) > new Date() && 
            new Date(product.start_date) <= new Date();

        // Formatação de preços
        const originalPrice = parseFloat(product.original_price || product.price).toFixed(2);
        const promoPrice = hasActivePromo ? parseFloat(product.promo_price).toFixed(2) : null;

        // Template do card
        const productCard = `
            <div class="col" data-brand="${product.brand}">
                <div class="card h-100 shadow-sm position-relative ${product.stock < 5 ? 'border-danger' : ''}">
                    ${hasActivePromo ? `
                    <span class="position-absolute top-0 start-0 m-2 badge bg-success">
                        PROMO <i class="bi bi-tag ms-1"></i>
                    </span>` : ''}

                    <div class="position-relative">
                        <img src="${product.image || 'images/products/placeholder.png'}" 
                             class="card-img-top p-2 object-fit-cover img-thumbnail"
                             alt="${product.name}"
                             style="height: 200px;">
                        
                        <!-- Botões de Editar/Excluir -->
                        <div class="position-absolute top-0 end-0 m-3">
                            <button class="btn btn-sm btn-light rounded-circle shadow-sm"
                                data-bs-toggle="modal" 
                                data-bs-target="#editProductModal"
                                data-product-id="${product.id}"
                                onclick="loadProductData(this)">
                                <i class="bi bi-pencil text-primary"></i>
                            </button>
                        </div>
                        <div class="position-absolute top-0 start-0 m-3">
                            <button class="btn btn-sm btn-light rounded-circle shadow-sm me-1"
                                onclick="deleteProduct('${product.id}')">
                                <i class="bi bi-trash text-danger"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Corpo do Card -->
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title mb-3">
                            ${product.name}
                            <small class="d-block text-muted fs-6">
                                ${product.brand_name}
                            </small>
                        </h5>

                        <div class="mt-auto">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="badge bg-${product.stock < 5 ? 'danger' : 'secondary'}">
                                    Estoque: ${product.stock}
                                </span>
                                <div class="d-flex flex-column align-items-end">
                                    ${hasActivePromo ? `
                                    <span class="text-danger fw-bold fs-5">
                                        R$ ${promoPrice}
                                    </span>
                                    <span class="text-decoration-line-through text-muted small">
                                        R$ ${originalPrice}
                                    </span>` : `
                                    <span class="text-dark fw-bold fs-5">
                                        R$ ${originalPrice}
                                    </span>`}
                                </div>
                            </div>
                            ${hasActivePromo ? `
                            <div class="bg-warning bg-opacity-10 p-2 rounded text-center small">
                                <i class="bi bi-clock-history me-1"></i>
                                Promoção válida até ${new Date(product.end_date).toLocaleDateString()}
                            </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', productCard);
    });
}

// Event listeners
document.getElementById('brandFilter').addEventListener('change', filterProducts);
document.getElementById('searchInput').addEventListener('input', filterProducts);
document.addEventListener('DOMContentLoaded', filterProducts);
document.getElementById('minPrice').addEventListener('input', () => {
    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(filterProducts, 300);
});

document.getElementById('maxPrice').addEventListener('input', () => {
    clearTimeout(priceTimeout);
    priceTimeout = setTimeout(filterProducts, 300);
});

// Função para carregar dados no modal de edição
let editModal = null;

async function loadProductData(button) {
    const productId = button.dataset.productId;
    
    try {
        const response = await fetch(`/api/produtos/${productId}`);
        const product = await response.json();
        
        // Preencher formulário com dados do produto
        document.getElementById('editProductId').value = product.id;
        document.getElementById('editProductName').value = product.name;
        document.getElementById('editProductBrand').value = product.brand;
        document.getElementById('editProductPrice').value = product.price;
        document.getElementById('editProductStock').value = product.stock;
        document.getElementById('existingImage').value = product.image;
        
        // Exibir prévia da imagem
        document.getElementById('editImagePreview').src = product.image || '/images/products/placeholder.png';
        document.getElementById('editImageInput').addEventListener('change', function(e) {
            handleImagePreview(e, 'editImagePreview');
        });
        document.getElementById('newImageInput').addEventListener('change', function(e) {
            handleImagePreview(e, 'newImagePreview');
        });

    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar os dados do produto');
    }
}

function handleImagePreview(event, previewId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(previewId).src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

document.getElementById('newProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/produtos', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            // Use Bootstrap's Modal API with vanilla JS
            const modalEl = document.getElementById('newProductModal');
            // Get the existing modal instance or create a new one if it doesn't exist
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.hide();
            location.reload();
        }
    } catch (error) {
        console.error('Erro:', error);
    }
});

// Submit do formulário de edição
document.getElementById('editProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('editProductName').value);
    formData.append('brand', document.getElementById('editProductBrand').value);
    formData.append('price', document.getElementById('editProductPrice').value);
    formData.append('stock', document.getElementById('editProductStock').value);
    formData.append('currentImage', document.getElementById('existingImage').value);
    
    const fileInput = document.querySelector('#editProductForm input[type="file"]');
    if (fileInput.files[0]) {
        formData.append('image', fileInput.files[0]);
    }

    try {
        const response = await fetch(`/api/produtos/${document.getElementById('editProductId').value}`, {
            method: 'PUT',
            body: formData
        });

        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao atualizar produto');
    }
});

async function deleteProduct(productId) {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
        fetch(`/produtos/${productId}`, {
            method: 'DELETE'
        })
        .then(response => {
            if (response.ok) {
                // Atualize a interface, por exemplo, removendo o card do produto
                location.reload();
            } else {
                alert('Erro ao excluir o produto.');
            }
        })
        .catch(error => console.error('Erro:', error));
    }
}

document.getElementById('searchInput').addEventListener('input', function(e) {
    document.querySelector('.clear-search').classList.toggle('show', e.target.value.length > 0);
});

document.querySelector('.clear-search').addEventListener('click', function() {
    document.getElementById('searchInput').value = '';
    this.classList.remove('show');
    filterProducts(); // Sua função de filtragem
});
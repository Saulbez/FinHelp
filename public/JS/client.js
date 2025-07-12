// clients.js - Dynamic Client Management System
const hamburguerMenu = document.querySelector("div.hamburguer");
const navBar = document.querySelector("nav");

hamburguerMenu.addEventListener("click", function(){
    navBar.classList.toggle("active");
})

// Global variables
let allClients = [];
let filteredClients = [];
let editingClientId = null;
let selectedClients = [];
let currentPage = 1;
let itemsPerPage = 10;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadClients();
    setupEventListeners();
    setupSearch();
    setupFilters();
    setupBulkActions();
});

// Setup event listeners
function setupEventListeners() {
    // Edit form submission
    const editForm = document.getElementById('editForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }

    // Add client form submission
    const addClientForm = document.getElementById('addClientForm');
    if (addClientForm) {
        addClientForm.addEventListener('submit', handleAddClient);
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', handleSelectAll);
    }
}

// Load all clients from API
function showSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.remove('spinner-hidden');
        spinner.classList.add('d-flex');
    }
}

function hideSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.remove('d-flex');
        spinner.classList.add('spinner-hidden');
    }
}

// Load all clients from API
async function loadClients() {
    try {
        showSpinner(); // Show spinner while loading
        
        const response = await fetch('/api/clientes');
        if (!response.ok) {
            throw new Error('Failed to fetch clients');
        }
        
        allClients = await response.json();
        filteredClients = [...allClients];
        renderClients(filteredClients);
        updateStats();
        updatePagination();
        
    } catch (error) {
        console.error('Error loading clients:', error);
        showNotification('Erro ao carregar clientes', 'error');
    } finally {
        hideSpinner(); // Always hide spinner when done
    }
}

// Refresh clients function
async function refreshClients() {
    await loadClients();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    loadClients();
    setupEventListeners();
    setupSearch();
    setupFilters();
    setupBulkActions();
});
// Render clients table
function renderClients(clients) {
    const tableBody = document.getElementById('clientsTableBody');
    if (!tableBody) return;

    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedClients = clients.slice(startIndex, endIndex);

    if (paginatedClients.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="empty-state">
                        <i class="bi bi-inbox display-4 text-muted"></i>
                        <p class="text-muted mt-2">Nenhum cliente encontrado</p>
                        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addClientModal">
                            <i class="bi bi-plus-circle"></i> Adicionar Primeiro Cliente
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = paginatedClients.map(client => `
        <tr data-client-id="${client.id}">
            <td>
                <input type="checkbox" class="form-check-input client-checkbox" 
                       value="${client.id}" onchange="handleClientSelect(this)">
            </td>
            <td class="client-name">
                <div class="d-flex align-items-center">
                    <div class="avatar-sm bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2">
                        ${client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-medium">${escapeHtml(client.name)}</div>
                        <small class="text-muted">ID: ${client.id}</small>
                    </div>
                </div>
            </td>
            <td class="client-phone">
                ${client.phone ? 
                    `<a href="tel:${client.phone}" class="text-decoration-none">
                        <i class="bi bi-telephone"></i> ${escapeHtml(client.phone)}
                    </a>` : 
                    '<span class="text-muted">N/A</span>'
                }
            </td>
            <td>
                ${client.last_products ? 
                    `<span class="badge bg-success">
                        <i class="bi bi-check-circle"></i> ${escapeHtml(client.last_products)}
                    </span>` :
                    `<span class="badge bg-secondary">
                        <i class="bi bi-x-circle"></i> Não Comprou
                    </span>`
                }
            </td>
            <td>
                <span class="badge ${parseFloat(client.debt) > 0 ? 'bg-warning text-dark' : 'bg-success'}">
                    R$ ${formatCurrency(client.debt)}
                </span>
            </td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-outline-primary" onclick="openEditModal('${client.id}')" 
                            data-bs-toggle="tooltip" title="Editar Cliente">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="openHistoryModal('${client.id}')" 
                            data-bs-toggle="tooltip" title="Ver Histórico">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="confirmDelete('${client.id}')" 
                            data-bs-toggle="tooltip" title="Excluir Cliente">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Initialize tooltips for new elements
    initializeTooltips();
}

// Update statistics
function updateStats() {
    const totalClients = allClients.length;
    const activeClients = allClients.filter(client => 
        client.last_products && client.last_products.trim() !== ''
    ).length;
    const clientsWithDebt = allClients.filter(client => 
        parseFloat(client.debt) > 0
    ).length;
    const totalDebt = allClients.reduce((sum, client) => 
        sum + parseFloat(client.debt || 0), 0
    );

    // Update stat cards with IDs
    document.getElementById('totalClients').textContent = totalClients;
    document.getElementById('activeClients').textContent = activeClients;
    document.getElementById('clientsWithDebt').textContent = clientsWithDebt;
    document.getElementById('totalDebt').textContent = `R$ ${formatCurrency(totalDebt)}`;
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = this.value.toLowerCase().trim();
            filterClients(searchTerm);
        }, 300);
    });
}

// Filter clients based on search term and filter selection
function filterClients(searchTerm = '') {
    let filtered = allClients;

    // Apply search term filter
    if (searchTerm) {
        filtered = filtered.filter(client => 
            client.name.toLowerCase().includes(searchTerm) ||
            (client.phone && client.phone.includes(searchTerm)) ||
            (client.last_products && client.last_products.toLowerCase().includes(searchTerm))
        );
    }

    // Apply additional filters
    const filterValue = document.getElementById('filterSelect').value;
    filtered = applyFilter(filtered, filterValue);

    filteredClients = filtered;
    currentPage = 1; // Reset to first page
    renderClients(filteredClients);
    updatePagination();
}

// Apply filter based on selection
function applyFilter(clients, filterValue) {
    switch (filterValue) {
        case 'with-debt':
            return clients.filter(client => parseFloat(client.debt) > 0);
        case 'no-debt':
            return clients.filter(client => parseFloat(client.debt) <= 0);
        case 'active':
            return clients.filter(client => client.last_products && client.last_products.trim() !== '');
        case 'inactive':
            return clients.filter(client => !client.last_products || client.last_products.trim() === '');
        default:
            return clients;
    }
}

// Setup filter functionality
function setupFilters() {
    const filterSelect = document.getElementById('filterSelect');
    if (!filterSelect) return;

    filterSelect.addEventListener('change', function() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        filterClients(searchTerm);
    });
}

// Setup bulk actions
function setupBulkActions() {
    // Monitor checkbox changes to show/hide bulk actions
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('client-checkbox')) {
            updateBulkActionsVisibility();
        }
    });
}

// Handle individual client selection
function handleClientSelect(checkbox) {
    const clientId = checkbox.value;
    
    if (checkbox.checked) {
        if (!selectedClients.includes(clientId)) {
            selectedClients.push(clientId);
        }
    } else {
        selectedClients = selectedClients.filter(id => id !== clientId);
    }
    
    updateSelectAllState();
    updateBulkActionsVisibility();
}

// Handle select all checkbox
function handleSelectAll(e) {
    const isChecked = e.target.checked;
    const clientCheckboxes = document.querySelectorAll('.client-checkbox');
    
    clientCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const clientId = checkbox.value;
        
        if (isChecked) {
            if (!selectedClients.includes(clientId)) {
                selectedClients.push(clientId);
            }
        } else {
            selectedClients = selectedClients.filter(id => id !== clientId);
        }
    });
    
    updateBulkActionsVisibility();
}

// Update select all checkbox state
function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const clientCheckboxes = document.querySelectorAll('.client-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.client-checkbox:checked');
    
    if (clientCheckboxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedCheckboxes.length === clientCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else if (checkedCheckboxes.length > 0) {
        selectAllCheckbox.indeterminate = true;
        selectAllCheckbox.checked = false;
    } else {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    }
}

// Update bulk actions visibility
function updateBulkActionsVisibility() {
    const selectedCount = selectedClients.length;
    const bulkActionsButton = document.getElementById('bulkActionsButton');
    
    // Create bulk actions button if it doesn't exist
    if (!bulkActionsButton && selectedCount > 0) {
        createBulkActionsButton();
    }
    
    // Update selected count in modal
    const selectedCountElement = document.getElementById('selectedCount');
    if (selectedCountElement) {
        selectedCountElement.textContent = selectedCount;
    }
    
    // Show/hide bulk actions button
    const button = document.getElementById('bulkActionsButton');
    if (button) {
        button.style.display = selectedCount > 0 ? 'block' : 'none';
    }
}

// Create bulk actions button
function createBulkActionsButton() {
    const tableHeader = document.querySelector('.table-header .table-actions');
    if (!tableHeader) return;
    
    const button = document.createElement('button');
    button.id = 'bulkActionsButton';
    button.className = 'btn btn-warning btn-sm';
    button.setAttribute('data-bs-toggle', 'modal');
    button.setAttribute('data-bs-target', '#bulkActionsModal');
    button.innerHTML = '<i class="bi bi-list-check"></i> Ações em Massa';
    button.style.display = 'none';
    
    tableHeader.appendChild(button);
}

// Update pagination
function updatePagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'block';
    const paginationList = paginationContainer.querySelector('.pagination');
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">
                <i class="bi bi-chevron-left"></i>
            </a>
        </li>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    
    // Next button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">
                <i class="bi bi-chevron-right"></i>
            </a>
        </li>
    `;
    
    paginationList.innerHTML = paginationHTML;
}

// Change page
function changePage(page) {
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderClients(filteredClients);
    updatePagination();
    
    // Scroll to top of table
    document.querySelector('.table-container').scrollIntoView({ behavior: 'smooth' });
}

// Initialize tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Open edit modal
async function openEditModal(clientId) {
    try {
        const response = await fetch(`/clientes/${clientId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch client data');
        }

        const client = await response.json();
        editingClientId = clientId;

        // Populate form fields
        document.getElementById('editClientId').value = client.id;
        document.getElementById('editName').value = client.name;
        document.getElementById('editPhone').value = client.phone || '';
        document.getElementById('editDebt').value = client.debt || '0';
        document.getElementById('editNotes').value = client.notes || '';

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading client data:', error);
        showNotification('Erro ao carregar dados do cliente', 'error');
    }
}

// Handle edit form submission
async function handleEditSubmit(e) {
    e.preventDefault();
    
    if (!editingClientId) return;

    const formData = {
        name: document.getElementById('editName').value.trim(),
        phone: document.getElementById('editPhone').value.trim(),
        debt: parseFloat(document.getElementById('editDebt').value) || 0,
        notes: document.getElementById('editNotes').value.trim()
    };

    // Validate form data
    if (!formData.name) {
        showNotification('Nome é obrigatório', 'error');
        return;
    }

    try {
        const response = await fetch(`/clientes/${editingClientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Failed to update client');
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
        modal.hide();

        // Reload clients
        await loadClients();
        showNotification('Cliente atualizado com sucesso!', 'success');
    } catch (error) {
        console.error('Error updating client:', error);
        showNotification('Erro ao atualizar cliente', 'error');
    }
}

// Handle add client form submission
async function handleAddClient(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('name').trim();
    const phone = formData.get('phone').trim();
    const debt = parseFloat(formData.get('debt')) || 0;

    if (!name) {
        showNotification('Nome é obrigatório', 'error');
        return;
    }

    try {
        const response = await fetch('/clientes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, phone, debt })
        });

        if (!response.ok) {
            throw new Error('Failed to add client');
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('addClientModal'));
        modal.hide();

        // Reset form
        e.target.reset();

        // Reload clients
        await loadClients();
        showNotification('Cliente adicionado com sucesso!', 'success');
    } catch (error) {
        console.error('Error adding client:', error);
        showNotification('Erro ao adicionar cliente', 'error');
    }
}

// Open history modal
async function openHistoryModal(clientId) {
    try {
        const response = await fetch(`/clientes/${clientId}/historico`);
        if (!response.ok) {
            throw new Error('Failed to fetch client history');
        }
        const data = await response.json();
        const client = data.client;
        const history = data.history || [];
       
        // Update modal header with client info
        document.getElementById('historyClientName').textContent = client.name;
        document.getElementById('historyClientInfo').textContent =
            `Telefone: ${client.phone || 'N/A'} | Débito: R$ ${formatCurrency(client.debt)}`;
       
        const historyContent = document.getElementById('historyContent');
        const historyEmpty = document.getElementById('historyEmpty');
       
        if (history.length === 0) {
            historyContent.innerHTML = '';
            historyEmpty.style.display = 'block';
        } else {
            historyEmpty.style.display = 'none';
            historyContent.innerHTML = history.map(item => {
                const isPaidInFull = item.remaining_installments === 0;
                const statusBadge = isPaidInFull ? 
                    '<span class="badge bg-success">Pago</span>' : 
                    '<span class="badge bg-warning text-dark">Pendente</span>';
                
                return `
                    <tr>
                        <td>${formatDate(item.sale_date)}</td>
                        <td class="fw-bold text-success">R$ ${formatCurrency(item.total)}</td>
                        <td>${escapeHtml(item.products.join(', '))}</td>
                        <td>
                            <div>
                                <strong>Parcelas:</strong> ${item.paid_installments}/${item.total_installments}<br>
                                <strong>Valor da parcela:</strong> R$ ${formatCurrency(item.installment_value)}<br>
                                <strong>Restante:</strong> R$ ${formatCurrency(item.remaining_amount)}
                            </div>
                        </td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('historyModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading client history:', error);
        showNotification('Erro ao carregar histórico do cliente', 'error');
    }
}

// Confirm and delete client
async function confirmDelete(clientId) {
    const client = allClients.find(c => c.id == clientId);
    if (!client) return;

    const confirmMessage = `Tem certeza que deseja excluir o cliente "${client.name}"?\n\nEsta ação não pode ser desfeita.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const response = await fetch(`/clientes/${clientId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete client');
        }

        // Reload clients
        await loadClients();
        showNotification('Cliente excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting client:', error);
        showNotification('Erro ao excluir cliente', 'error');
    }
}

// Bulk actions functions
async function bulkExport() {
    try {
        const selectedClientData = allClients.filter(client => 
            selectedClients.includes(client.id.toString())
        );
        
        if (selectedClientData.length === 0) {
            showNotification('Nenhum cliente selecionado', 'error');
            return;
        }
        
        // Create CSV content
        const csvContent = generateCSV(selectedClientData);
        
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification(`${selectedClientData.length} clientes exportados com sucesso!`, 'success');
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
        modal.hide();
    } catch (error) {
        console.error('Error exporting clients:', error);
        showNotification('Erro ao exportar clientes', 'error');
    }
}

// Generate CSV content
function generateCSV(clients) {
    const headers = ['ID', 'Nome', 'Telefone', 'Débito', 'Última Compra'];
    const csvRows = [headers.join(',')];
    
    clients.forEach(client => {
        const row = [
            client.id,
            `"${client.name}"`,
            client.phone || '',
            client.debt || 0,
            `"${client.last_products || 'N/A'}"`
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// Bulk update debt
async function bulkUpdateDebt() {
    const newDebt = prompt('Digite o novo valor de débito para os clientes selecionados:');
    
    if (newDebt === null) return; // User cancelled
    
    const debtValue = parseFloat(newDebt);
    if (isNaN(debtValue) || debtValue < 0) {
        showNotification('Valor inválido. Digite um número válido.', 'error');
        return;
    }
    
    try {
        const response = await fetch('/clientes/bulk-update-debt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientIds: selectedClients,
                debt: debtValue
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update debt');
        }
        
        // Reload clients
        await loadClients();
        showNotification(`Débito atualizado para ${selectedClients.length} clientes!`, 'success');
        
        // Clear selection
        selectedClients = [];
        updateBulkActionsVisibility();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
        modal.hide();
    } catch (error) {
        console.error('Error updating debt:', error);
        showNotification('Erro ao atualizar débito', 'error');
    }
}

// Bulk delete clients
async function bulkDelete() {
    const confirmMessage = `Tem certeza que deseja excluir ${selectedClients.length} clientes selecionados?\n\nEsta ação não pode ser desfeita.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch('/clientes/bulk-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                clientIds: selectedClients
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete clients');
        }
        
        // Reload clients
        await loadClients();
        showNotification(`${selectedClients.length} clientes excluídos com sucesso!`, 'success');
        
        // Clear selection
        selectedClients = [];
        updateBulkActionsVisibility();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('bulkActionsModal'));
        modal.hide();
    } catch (error) {
        console.error('Error deleting clients:', error);
        showNotification('Erro ao excluir clientes', 'error');
    }
}

// Utility functions
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(parseFloat(value) || 0);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Refresh data function (can be called from outside)
function refreshClients() {
    loadClients();
}

// Export functions for global access
window.openEditModal = openEditModal;
window.openHistoryModal = openHistoryModal;
window.confirmDelete = confirmDelete;
window.refreshClients = refreshClients;
window.handleClientSelect = handleClientSelect;
window.changePage = changePage;
window.bulkExport = bulkExport;
window.bulkUpdateDebt = bulkUpdateDebt;
window.bulkDelete = bulkDelete;
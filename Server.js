import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import pool from "./database.js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

// ========== SESSION CONFIGURATION ==========
const PgStore = pgSession(session);

app.use(session({
  store: new PgStore({
    pool: pool,
    tableName: 'session',
    pruneSessionInterval: 60,
  }),
  secret: process.env.SESSION_SECRET || 'myfinancehelper',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== MIDDLEWARE SETUP ==========
app.use(express.static("public"));
app.use("/images", express.static("public/images"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, "Views"),        // Try with capital V
  path.join(__dirname, "views"),        // Try with lowercase v
  path.join(__dirname, "Views/partials"),  // Try partials with capital V
  path.join(__dirname, "views/partials")   // Try partials with lowercase v
]);

// ========== MULTER CONFIGURATION ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images/products"),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({ 
  storage, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens são permitidas!"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ========== AUTHENTICATION MIDDLEWARE ==========
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        return res.redirect('/login');
    }
    next();
};

// ========== UTILITY FUNCTIONS ==========
const handleError = (res, error, message = 'Erro interno do servidor') => {
    console.error(error);
    
    // Database constraint errors
    if (error.code === '23505') {
        return res.status(400).json({ error: 'Dados duplicados' });
    }
    if (error.code === '23503') {
        return res.status(400).json({ error: 'Referência inválida' });
    }
    if (error.code === '23502') {
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    }
    
    res.status(500).json({ 
        error: message,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

const validateRequired = (fields, data) => {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
        throw new Error(`Campos obrigatórios: ${missing.join(', ')}`);
    }
};

app.get('/api/monthly-profit', requireAuth, async (req, res) => {
    try {
        const startTime = Date.now();
        console.log(`Starting monthly profit calculation for user ${req.session.userId}`);
        
        // Add strong cache-control headers
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // Force database to refresh transaction state
        await pool.query('DISCARD ALL');
        
        // Analyze tables for fresh statistics
        await pool.query('ANALYZE installments');
        await pool.query('ANALYZE sales');
        await pool.query('ANALYZE sale_payments');
        
        // Calculate with fresh data
        const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
        
        const elapsedTime = Date.now() - startTime;
        console.log(`Monthly profit calculation completed in ${elapsedTime}ms: ${monthlyProfit}`);
        
        // Return formatted and raw profit values
        res.json({ 
            profit: monthlyProfit,
            formattedProfit: new Intl.NumberFormat('pt-BR', { 
                style: 'currency', 
                currency: 'BRL' 
            }).format(monthlyProfit),
            timestamp: new Date().toISOString(),
            calculationTime: elapsedTime,
            cache: false
        });
    } catch (error) {
        console.error('Error fetching monthly profit:', error);
        res.status(500).json({ error: 'Failed to calculate monthly profit' });
    }
});

// ========== PROFIT CALCULATION (OPTIMIZED) ==========
async function calculateMonthlyProfit(userId) {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Force a refresh of any statistics that might be cached
        await pool.query('ANALYZE installments');

        const sql = `
            WITH installment_profits AS (
                SELECT 
                    i.id as installment_id,
                    i.value as installment_value,
                    i.paid,
                    i.paid_date,
                    i.due_date,
                    s.id as sale_id,
                    s.total as sale_total,
                    s.sale_date,
                    sp.quantity,
                    sp.unit_price,
                    p.id as product_id,
                    p.profit_percent as standard_profit_percent,
                    c.id as campaign_id,
                    c.promo_price,
                    c.campaign_profit_percent,
                    c.start_date as campaign_start,
                    c.end_date as campaign_end,
                    -- Determine effective profit percentage based on campaign status at sale time
                    CASE 
                        WHEN c.id IS NOT NULL 
                            AND s.sale_date >= c.start_date 
                            AND s.sale_date <= c.end_date 
                        THEN c.campaign_profit_percent
                        ELSE p.profit_percent
                    END as effective_profit_percent,
                    sp.quantity * sp.unit_price as product_total,
                    -- Calculate profit using the effective profit percentage
                    (sp.quantity * sp.unit_price * (
                        CASE 
                            WHEN c.id IS NOT NULL 
                                AND s.sale_date >= c.start_date 
                                AND s.sale_date <= c.end_date 
                            THEN c.campaign_profit_percent
                            ELSE p.profit_percent
                        END / 100.0
                    )) as product_profit
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
                JOIN sale_products sp ON s.id = sp.sale_id
                JOIN products p ON sp.product_id = p.id
                -- Left join with campaigns to check if there was an active campaign when the sale was made
                LEFT JOIN campaigns c ON p.id = c.product_id
                    AND s.sale_date >= c.start_date
                    AND s.sale_date <= c.end_date
                    AND c.user_id = $1
                WHERE s.user_id = $1 
                    AND i.user_id = $1 
                    AND sp.user_id = $1 
                    AND p.user_id = $1
                    AND (
                        (i.due_date >= $2 AND i.due_date < $3) OR
                        (i.paid = true AND i.paid_date >= $2 AND i.paid_date < $3)
                    )
            ),
            sale_totals AS (
                SELECT 
                    sale_id,
                    sale_total,
                    SUM(product_total) as total_products_value,
                    SUM(product_profit) as total_profit,
                    SUM(installment_value) as total_installments_value
                FROM installment_profits
                GROUP BY sale_id, sale_total
            ),
            paid_installments AS (
                SELECT 
                    ip.sale_id,
                    ip.installment_value,
                    ip.paid,
                    st.total_profit,
                    st.total_installments_value,
                    (st.total_profit * (ip.installment_value / st.total_installments_value)) as installment_profit
                FROM installment_profits ip
                JOIN sale_totals st ON ip.sale_id = st.sale_id
                WHERE ip.paid = true
            )
            SELECT COALESCE(SUM(installment_profit), 0) as monthly_profit
            FROM paid_installments
        `;
        
        const { rows } = await pool.query(sql, [userId, start, end]);
        return parseFloat(rows[0].monthly_profit || 0);
    } catch (error) {
        console.error('Error calculating monthly profit:', error);
        return 0;
    }
}

// ========== AUTHENTICATION ROUTES ==========
app.get("/register", (req, res) => {
    res.render("register", { title: "Registro" });
});

app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        validateRequired(['username', 'email', 'password'], req.body);
        
        const hash = await bcrypt.hash(password, 12);
        const { rows } = await pool.query(
            `INSERT INTO users (username, email, password) VALUES($1, $2, $3) RETURNING id`,
            [username, email, hash]
        );
        
        req.session.userId = rows[0].id;
        res.redirect("/");
    } catch (error) {
        handleError(res, error, 'Erro no registro');
    }
});

app.get("/login", (req, res) => {
    res.render("login", { title: "Login" });
});

app.post("/login", async (req, res) => {
    try {
        const { login, password } = req.body;
        
        // Check if login is empty
        if (!login || !password) {
            return res.render("login", { 
                error: "Usuário/email e senha são obrigatórios", 
                title: "Login" 
            });
        }
        
        // Query to find user by either username or email
        const { rows } = await pool.query(
            `SELECT id, username, email, password FROM users WHERE username = $1 OR email = $1`, 
            [login]
        );
        
        if (rows.length === 0) {
            return res.render("login", { 
                error: "Usuário ou email não encontrado", 
                title: "Login" 
            });
        }
        
        const user = rows[0];
        const passwordValid = await bcrypt.compare(password, user.password);
        
        if (passwordValid) {
            req.session.userId = user.id;
            req.session.username = user.username;
            return res.redirect("/");
        }
        
        res.render("login", { 
            error: "Senha incorreta", 
            title: "Login" 
        });
    } catch (error) {
        console.error('Login error:', error);
        handleError(res, error, 'Erro no login');
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
});

// ========== DASHBOARD ROUTES ==========
app.get("/", requireAuth, async (req, res) => {
    try {
        const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
        res.render("index", { 
            monthlyProfit: monthlyProfit, 
            title: "Dashboard" 
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render("error", { 
            error: "Erro ao carregar dashboard" 
        });
    }
});

app.get("/api/dashboard-data", requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Get basic statistics in parallel
        const [statsResult, pendingResult, overdueResult, recentSalesResult, topProductsResult] = await Promise.all([
            pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM clients WHERE user_id = $1) as total_clients,
                    (SELECT COUNT(*) FROM products WHERE user_id = $1) as total_products,
                    (SELECT COUNT(*) FROM sales WHERE user_id = $1) as total_sales,
                    (SELECT COUNT(*) FROM products WHERE user_id = $1 AND stock <= 10) as low_stock_products
            `, [userId]),
            
            pool.query(`
                SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as amount
                FROM installments
                WHERE user_id = $1 AND paid = false
            `, [userId]),
            
            pool.query(`
                SELECT COUNT(*) as count, COALESCE(SUM(value), 0) as amount
                FROM installments
                WHERE user_id = $1 AND paid = false AND due_date < CURRENT_DATE
            `, [userId]),
            
            pool.query(`
                SELECT s.sale_date, s.total, c.name as client_name,
                       STRING_AGG(p.name, ', ' ORDER BY p.name) as product_names
                FROM sales s
                JOIN clients c ON s.client_id = c.id
                JOIN sale_products sp ON s.id = sp.sale_id
                JOIN products p ON sp.product_id = p.id
                WHERE s.user_id = $1
                GROUP BY s.id, s.sale_date, s.total, c.name
                ORDER BY s.sale_date DESC
                LIMIT 5
            `, [userId]),
            
            pool.query(`
                SELECT p.name, b.name as brand_name,
                       SUM(sp.quantity) as total_sales,
                       SUM(sp.quantity * sp.unit_price) as total_revenue
                FROM products p
                JOIN sale_products sp ON p.id = sp.product_id
                JOIN brands b ON p.brand = b.id
                WHERE p.user_id = $1
                GROUP BY p.id, p.name, b.name
                ORDER BY total_revenue DESC
                LIMIT 5
            `, [userId])
        ]);
        
        const stats = statsResult.rows[0];
        const pending = pendingResult.rows[0];
        const overdue = overdueResult.rows[0];
        
        const dashboardData = {
            stats: {
                totalClients: parseInt(stats.total_clients),
                totalProducts: parseInt(stats.total_products),
                totalSales: parseInt(stats.total_sales),
                pendingInstallments: { 
                    count: parseInt(pending.count), 
                    amount: parseFloat(pending.amount) 
                },
                overdueInstallments: { 
                    count: parseInt(overdue.count), 
                    amount: parseFloat(overdue.amount) 
                },
                lowStockProducts: parseInt(stats.low_stock_products),
            },
            recentSales: recentSalesResult.rows.map(sale => ({
                client: sale.client_name,
                product: sale.product_names,
                value: parseFloat(sale.total),
                date: sale.sale_date.toISOString().split('T')[0]
            })),
            topProducts: topProductsResult.rows.map(product => ({
                name: product.name,
                brand: product.brand_name,
                sales: parseInt(product.total_sales),
                revenue: parseFloat(product.total_revenue)
            }))
        };
        
        res.json(dashboardData);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar dados do dashboard');
    }
});

// ========== CLIENTS ROUTES ==========
app.get("/clientes", requireAuth, async (req, res) => {
    try {
        const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
        
        // Get clients with last purchase info
        const [clientsResult, lastPurchasesResult, monthlyClientsResult] = await Promise.all([
            pool.query(`
                SELECT id, name, debt, phone, created_date
                FROM clients 
                WHERE user_id = $1
                ORDER BY name
            `, [req.session.userId]),
            
            pool.query(`
                SELECT 
                    s.client_id,
                    STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) AS product_names
                FROM sales s
                INNER JOIN (
                    SELECT client_id, MAX(sale_date) AS max_date
                    FROM sales
                    WHERE user_id = $1
                    GROUP BY client_id
                ) latest ON s.client_id = latest.client_id AND s.sale_date = latest.max_date
                LEFT JOIN sale_products sp ON sp.sale_id = s.id AND sp.user_id = $1
                LEFT JOIN products p ON p.id = sp.product_id AND p.user_id = $1
                WHERE s.user_id = $1
                GROUP BY s.client_id
            `, [req.session.userId]),
            
            pool.query(`
                SELECT COUNT(*) as clients_this_month
                FROM clients 
                WHERE user_id = $1 
                AND EXTRACT(MONTH FROM created_date) = EXTRACT(MONTH FROM CURRENT_DATE)
                AND EXTRACT(YEAR FROM created_date) = EXTRACT(YEAR FROM CURRENT_DATE)
            `, [req.session.userId])
        ]);

        // Map last purchases to clients
        const lastPurchasesMap = {};
        lastPurchasesResult.rows.forEach(row => {
            lastPurchasesMap[row.client_id] = row.product_names;
        });

        const clients = clientsResult.rows.map(client => ({
            ...client,
            product_name: lastPurchasesMap[client.id] || null
        }));

        const clientsMonth = parseInt(monthlyClientsResult.rows[0].clients_this_month);

        res.render("clients.ejs", { 
            clients: clients, 
            monthlyProfit: monthlyProfit,
            numberOfClients: clients.length,
            clientsMonth: clientsMonth
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar clientes');
    }
});

app.get("/api/clientes", requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT c.*, STRING_AGG(DISTINCT p.name, ', ') as last_products
            FROM clients c
            LEFT JOIN sales s ON c.id = s.client_id AND s.user_id = $1
            LEFT JOIN sale_products sp ON s.id = sp.sale_id
            LEFT JOIN products p ON sp.product_id = p.id
            WHERE c.user_id = $1
            GROUP BY c.id
            ORDER BY c.name
        `, [req.session.userId]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar clientes');
    }
});

app.post("/clientes", requireAuth, async (req, res) => {
    try {
        const { name, phone } = req.body;
        validateRequired(['name'], req.body);
        
        const date = new Date();
        await pool.query(
            `INSERT INTO clients(name, phone, created_date, user_id) VALUES($1, $2, $3, $4)`,
            [name, phone, date, req.session.userId]
        );
        
        res.redirect("/clientes");
    } catch (error) {
        handleError(res, error, 'Erro ao criar cliente');
    }
});

app.get('/clientes/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
            [req.params.id, req.session.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar cliente');
    }
});

app.put('/clientes/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, debt } = req.body;
        validateRequired(['name'], req.body);

        await pool.query(
            `UPDATE clients SET name = $1, phone = $2, debt = $3 WHERE id = $4 AND user_id = $5`,
            [name, phone, debt || 0, id, req.session.userId]
        );

        res.sendStatus(200);
    } catch (error) {
        handleError(res, error, 'Erro ao atualizar cliente');
    }
});

app.post("/clientes/:id/debito", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        
        await pool.query(
            `UPDATE clients SET debt = debt + $1 WHERE id = $2 AND user_id = $3`,
            [parseFloat(amount), id, req.session.userId]
        );
        
        res.redirect("/clientes");
    } catch (error) {
        handleError(res, error, 'Erro ao atualizar débito');
    }
});

app.delete("/clientes/:id", requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const clientId = req.params.id;
        const { deleteReason = 'user_request' } = req.body;
        
        // Check if client exists
        const clientCheck = await client.query(
            'SELECT id, name, phone FROM clients WHERE id = $1 AND user_id = $2',
            [clientId, req.session.userId]
        );
        
        if (clientCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }

        // Check for sales associated with this client
        const salesCheck = await client.query(
            'SELECT COUNT(*) as sales_count FROM sales WHERE client_id = $1 AND user_id = $2',
            [clientId, req.session.userId]
        );
        
        const salesCount = parseInt(salesCheck.rows[0].sales_count);
        
        if (salesCount > 0) {
            // LGPD-compliant approach: Anonymize the client instead of transferring sales
            await client.query(`
                UPDATE clients 
                SET 
                    name = 'Cliente Anonimizado',
                    phone = NULL,
                    deleted = TRUE
                WHERE id = $1 AND user_id = $2
            `, [clientId, req.session.userId]);
            
            await client.query('COMMIT');
            return res.json({ 
                success: true, 
                message: `Dados pessoais do cliente foram anonimizados em conformidade com a LGPD. Registros fiscais foram preservados.`,
                preservedSales: salesCount,
                anonymized: true
            });
        }
        
        // If no sales, completely delete the client (LGPD compliant - full removal)
        await client.query(
            'DELETE FROM clients WHERE id = $1 AND user_id = $2', 
            [clientId, req.session.userId]
        );
        
        await client.query('COMMIT');
        res.json({ 
            success: true, 
            message: 'Cliente excluído completamente conforme solicitado (LGPD)'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        handleError(res, error, 'Erro ao excluir cliente');
    } finally {
        client.release();
    }
});


// ========== PRODUCTS ROUTES ==========
app.get("/produtos", requireAuth, async (req, res) => {
    try {
        const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
        
        // Clean up expired campaigns
        await pool.query(`
            UPDATE products SET current_campaign_id = NULL 
            WHERE current_campaign_id IN (
                SELECT id FROM campaigns WHERE end_date < CURRENT_DATE AND user_id = $1
            ) AND user_id = $1
        `, [req.session.userId]);
        
        await pool.query(
            'DELETE FROM campaigns WHERE end_date < CURRENT_DATE AND user_id = $1', 
            [req.session.userId]
        );
        
        const [productsResult, brandsResult, categoriesResult] = await Promise.all([
            pool.query(`
                SELECT p.*, c.promo_price, c.start_date, c.end_date, b.name as brand_name
                FROM products p
                LEFT JOIN campaigns c ON p.current_campaign_id = c.id
                LEFT JOIN brands b ON p.brand = b.id
                WHERE p.user_id = $1
            `, [req.session.userId]),
            
            pool.query(
                "SELECT id, name FROM brands WHERE user_id = $1 ORDER BY name", 
                [req.session.userId]
            ),
            
            pool.query(`
                SELECT DISTINCT category 
                FROM products 
                WHERE user_id = $1 AND category IS NOT NULL 
                ORDER BY category
            `, [req.session.userId])
        ]);

        res.render("products.ejs", {
            title: "Produtos",
            products: productsResult.rows,
            brands: brandsResult.rows,
            categories: categoriesResult.rows,
            monthlyProfit: monthlyProfit
        });
    } catch (error) {
        handleError(res, error, 'Erro ao carregar produtos');
    }
});

app.get('/api/produtos', requireAuth, async (req, res) => {
    try {
        const { search, brand, category, minPrice, maxPrice, lowStock, onSale, sortBy, sortOrder } = req.query;
        
        let query = `
            SELECT 
                p.id, p.name, p.brand, p.price as original_price, p.stock, p.image, 
                p.category, p.current_campaign_id, p.created_date, p.profit_percent,
                c.promo_price, c.start_date, c.end_date,
                b.name as brand_name,
                COALESCE(c.promo_price, p.price) as current_price,
                CASE 
                    WHEN c.promo_price IS NOT NULL 
                    AND c.start_date <= CURRENT_DATE 
                    AND c.end_date >= CURRENT_DATE 
                    THEN true 
                    ELSE false 
                END as has_active_promo
            FROM products p
            LEFT JOIN brands b ON p.brand = b.id
            LEFT JOIN campaigns c ON p.current_campaign_id = c.id
            WHERE p.user_id = $1
        `;

        const params = [req.session.userId];
        let paramIndex = 2;

        // Apply filters
        if (search) {
            query += ` AND (p.name ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (brand && brand !== 'all') {
            query += ` AND p.brand = $${paramIndex}`;
            params.push(parseInt(brand));
            paramIndex++;
        }

        if (category && category !== 'all') {
            query += ` AND p.category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (minPrice || maxPrice) {
            query += ` AND COALESCE(c.promo_price, p.price) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(minPrice ? parseFloat(minPrice) : 0);
            params.push(maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER);
            paramIndex += 2;
        }

        if (lowStock === 'true') {
            query += ` AND p.stock <= 5`;
        }

        if (onSale === 'true') {
            query += ` AND c.promo_price IS NOT NULL AND c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE`;
        }

        // Apply sorting
        const validSortFields = ['name', 'current_price', 'stock', 'created_date', 'brand_name'];
        const validSortOrders = ['ASC', 'DESC'];
        
        if (sortBy && validSortFields.includes(sortBy)) {
            const order = (sortOrder && validSortOrders.includes(sortOrder.toUpperCase())) ? sortOrder.toUpperCase() : 'ASC';
            query += ` ORDER BY ${sortBy} ${order}`;
        } else {
            query += ` ORDER BY name ASC`;
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar produtos');
    }
});

app.get('/api/produtos/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT p.*, b.name as brand_name 
            FROM products p 
            LEFT JOIN brands b ON p.brand = b.id 
            WHERE p.id = $1 AND p.user_id = $2
        `, [req.params.id, req.session.userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar produto');
    }
});

app.post('/api/produtos', upload.single('image'), requireAuth, async (req, res) => {
    try {
        const { name, price, stock, profit_percentual, brand, category } = req.body;
        validateRequired(['name', 'price', 'stock', 'brand'], req.body);
       
        // Validate brand exists
        const brandResult = await pool.query(
            `SELECT id FROM brands WHERE id = $1 AND user_id = $2`, 
            [brand, req.session.userId]
        );
        
        if (brandResult.rows.length === 0) {
            return res.status(400).json({ error: "Marca não encontrada" });
        }
        
        const imagePath = req.file ? 
            `/images/products/${req.file.filename}` : 
            '/images/default-product.jpg';

        const result = await pool.query(
            `INSERT INTO products (name, brand, price, stock, image, profit_percent, category, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, brand, parseFloat(price), parseInt(stock), imagePath, 
             parseFloat(profit_percentual || 0), category || null, req.session.userId]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao criar produto');
    }
});

app.put('/api/produtos/:id', upload.single('image'), requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, brand, price, stock, currentImage, profit_percentual, category } = req.body;
        validateRequired(['name', 'price', 'stock', 'brand'], req.body);

        // Validate brand exists
        const brandResult = await pool.query(
            `SELECT id FROM brands WHERE id = $1 AND user_id = $2`, 
            [brand, req.session.userId]
        );
        
        if (brandResult.rows.length === 0) {
            return res.status(400).json({ error: "Marca não encontrada" });
        }
        
        let imagePath = currentImage;
        if (req.file) {
            imagePath = `/images/products/${req.file.filename}`;
        }

        const result = await pool.query(
            `UPDATE products SET
                name = $1, brand = $2, price = $3, stock = $4, image = $5,
                profit_percent = $6, category = $7
             WHERE id = $8 AND user_id = $9 RETURNING *`,
            [name, brand, parseFloat(price), parseInt(stock), imagePath, 
             parseFloat(profit_percentual || 0), category || null, id, req.session.userId]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao atualizar produto');
    }
});

app.delete('/produtos/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const productId = req.params.id;
        
        // Check if product exists
        const productCheck = await client.query(
            'SELECT id, name FROM products WHERE id = $1 AND user_id = $2',
            [productId, req.session.userId]
        );
        
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // Check for sales associated with this product
        const salesCheck = await client.query(
            'SELECT COUNT(*) as sales_count FROM sale_products WHERE product_id = $1 AND user_id = $2',
            [productId, req.session.userId]
        );
        
        const salesCount = parseInt(salesCheck.rows[0].sales_count);
        
        if (salesCount > 0) {
            // Create a "deleted product" record in the system if it doesn't exist
            const productName = productCheck.rows[0].name;
            
            // Update product instead of deleting
            await client.query(
                "UPDATE products SET name = $1, deleted = TRUE WHERE id = $2 AND user_id = $3",
                [`Produto Removido (${productName})`, productId, req.session.userId]
            );
            
            await client.query('COMMIT');
            return res.json({ 
                success: true, 
                message: `Produto removido do catálogo. ${salesCount} registros de venda foram preservados.`,
                preservedSales: salesCount 
            });
        }
        
        // If no sales, simply delete the product
        await client.query(
            'DELETE FROM products WHERE id = $1 AND user_id = $2', 
            [productId, req.session.userId]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Produto excluído com sucesso' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        handleError(res, error, 'Erro ao excluir produto');
    } finally {
        client.release();
    }
});

// ========== BRANDS ROUTES ==========
app.get('/api/marcas', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT b.*, COUNT(p.id) as product_count 
            FROM brands b 
            LEFT JOIN products p ON b.id = p.brand AND p.user_id = b.user_id
            WHERE b.user_id = $1 
            GROUP BY b.id 
            ORDER BY b.name
        `, [req.session.userId]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar marcas');
    }
});

app.post('/api/marcas', requireAuth, async (req, res) => {
    try {
        const { name, description } = req.body;
        validateRequired(['name'], req.body);
        
        // Check if brand already exists
        const existingBrand = await pool.query(
            'SELECT id FROM brands WHERE name = $1 AND user_id = $2', 
            [name, req.session.userId]
        );
        
        if (existingBrand.rows.length > 0) {
            return res.status(400).json({ error: 'Marca já existe' });
        }
        
        const { rows } = await pool.query(
            'INSERT INTO brands (name, user_id) VALUES ($1, $2) RETURNING *', 
            [name, req.session.userId]
        );
        
        res.status(201).json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao criar marca');
    }
});

app.put('/api/marcas/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        validateRequired(['name'], req.body);
        
        const { rows } = await pool.query(
            'UPDATE brands SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *', 
            [name, description || null, id, req.session.userId]
        );
        
        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao atualizar marca');
    }
});

app.delete('/api/marcas/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;
        
        // Check for products using this brand
        const productCheck = await pool.query(
            'SELECT COUNT(*) as count FROM products WHERE brand = $1 AND user_id = $2', 
            [id, req.session.userId]
        );
        
        const productCount = parseInt(productCheck.rows[0].count);
        
        if (productCount > 0 && force !== 'true') {
            return res.status(400).json({ 
                error: 'Não é possível excluir esta marca pois existem produtos associados',
                productCount: productCount,
                requiresForce: true
            });
        }
        
        if (force === 'true') {
            // Delete products first
            await pool.query(
                'DELETE FROM products WHERE brand = $1 AND user_id = $2', 
                [id, req.session.userId]
            );
        }
        
        await pool.query(
            'DELETE FROM brands WHERE id = $1 AND user_id = $2', 
            [id, req.session.userId]
        );
        
        res.json({ 
            message: 'Marca excluída com sucesso',
            deletedProducts: force === 'true' ? productCount : 0
        });
    } catch (error) {
        handleError(res, error, 'Erro ao excluir marca');
    }
});

// ========== CAMPAIGNS ROUTES ==========
app.post('/campanhas', requireAuth, async (req, res) => {
    try {
        const { product_id, start_date, end_date, promo_price, profit_percentual } = req.body;
        validateRequired(['product_id', 'start_date', 'end_date', 'promo_price'], req.body);
        
        const product = await pool.query(
            'SELECT price FROM products WHERE id = $1 AND user_id = $2', 
            [product_id, req.session.userId]
        );
        
        if (product.rows.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }
        
        const price = product.rows[0].price;
        
        if (new Date(start_date) >= new Date(end_date)) {
            return res.status(400).json({ error: "Data final deve ser após a inicial" });
        }
        
        if (parseFloat(promo_price) >= price) {
            return res.status(400).json({ error: "Preço promocional deve ser menor que o original" });
        }
        
        const result = await pool.query(
            `INSERT INTO campaigns (product_id, start_date, end_date, promo_price, campaign_profit_percent, user_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [product_id, start_date, end_date, parseFloat(promo_price), 
             parseFloat(profit_percentual || 0), req.session.userId]
        );

        await pool.query(
            `UPDATE products SET current_campaign_id = $1 WHERE id = $2 AND user_id = $3`,
            [result.rows[0].id, product_id, req.session.userId]
        );

        res.redirect('/produtos');
    } catch (error) {
        handleError(res, error, 'Erro ao criar campanha');
    }
});

app.get('/api/campanhas', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT c.*, 
                   p.name as product_name, 
                   p.price as original_price,
                   b.name as brand_name
            FROM campaigns c
            JOIN products p ON c.product_id = p.id
            LEFT JOIN brands b ON p.brand = b.id
            WHERE c.end_date >= CURRENT_DATE AND c.user_id = $1
            ORDER BY c.start_date ASC
        `, [req.session.userId]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar campanhas');
    }
});

app.get('/api/campanhas/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT c.*,
                   p.name as product_name,
                   p.price as original_price
            FROM campaigns c
            JOIN products p ON c.product_id = p.id
            WHERE c.id = $1 AND c.user_id = $2
        `, [req.params.id, req.session.userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar campanha');
    }
});

// Add endpoint to update a campaign
app.put('/api/campanhas/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const { product_id, start_date, end_date, promo_price, profit_percentual } = req.body;
        
        // Validate input
        validateRequired(['product_id', 'start_date', 'end_date', 'promo_price'], req.body);
        
        // Check if campaign exists and belongs to user
        const campaignCheck = await client.query(
            'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
            [id, req.session.userId]
        );
        
        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }
        
        // Get product price for validation
        const productCheck = await client.query(
            'SELECT price FROM products WHERE id = $1 AND user_id = $2',
            [product_id, req.session.userId]
        );
        
        if (productCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        const price = productCheck.rows[0].price;
        
        // Validate dates
        if (new Date(start_date) >= new Date(end_date)) {
            return res.status(400).json({ error: 'Data final deve ser após a inicial' });
        }
        
        // Validate price
        if (parseFloat(promo_price) >= price) {
            return res.status(400).json({ error: 'Preço promocional deve ser menor que o original' });
        }
        
        // Update campaign
        await client.query(`
            UPDATE campaigns 
            SET product_id = $1, start_date = $2, end_date = $3, 
                promo_price = $4, campaign_profit_percent = $5
            WHERE id = $6 AND user_id = $7
        `, [
            product_id, 
            start_date, 
            end_date, 
            parseFloat(promo_price),
            parseFloat(profit_percentual || 0),
            id,
            req.session.userId
        ]);
        
        // Update product's current campaign if needed
        await client.query(`
            UPDATE products 
            SET current_campaign_id = $1 
            WHERE id = $2 AND user_id = $3
        `, [id, product_id, req.session.userId]);
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Campanha atualizada com sucesso' });
    } catch (error) {
        await client.query('ROLLBACK');
        handleError(res, error, 'Erro ao atualizar campanha');
    } finally {
        client.release();
    }
});

// Add endpoint to delete a campaign
app.delete('/api/campanhas/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        
        // Get the campaign's product_id before deleting
        const campaignCheck = await client.query(
            'SELECT product_id FROM campaigns WHERE id = $1 AND user_id = $2',
            [id, req.session.userId]
        );
        
        if (campaignCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }
        
        const productId = campaignCheck.rows[0].product_id;
        
        // Remove campaign reference from product
        await client.query(`
            UPDATE products 
            SET current_campaign_id = NULL 
            WHERE id = $1 AND current_campaign_id = $2 AND user_id = $3
        `, [productId, id, req.session.userId]);
        
        // Delete the campaign
        await client.query(
            'DELETE FROM campaigns WHERE id = $1 AND user_id = $2',
            [id, req.session.userId]
        );
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Campanha excluída com sucesso' });
    } catch (error) {
        await client.query('ROLLBACK');
        handleError(res, error, 'Erro ao excluir campanha');
    } finally {
        client.release();
    }
});

// ========== SALES ROUTES (OPTIMIZED) ==========
app.get("/vendas", requireAuth, async (req, res) => {
    try {
        const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
        
        const [clients, paymentMethods] = await Promise.all([
            pool.query("SELECT id, name FROM clients WHERE user_id = $1 ORDER BY name", [req.session.userId]),
            pool.query("SELECT id, method FROM payment_methods ORDER BY method")
        ]);

        res.render("sales.ejs", {
            title: "Vendas",
            clients: clients.rows,
            paymentMethods: paymentMethods.rows,
            monthlyProfit: monthlyProfit
        });
    } catch (error) {
        handleError(res, error, 'Erro ao carregar página de vendas');
    }
});

// Update the GET /api/vendas endpoint in Server.js to fix pagination response
app.get('/api/vendas', requireAuth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 15,
            search,
            clientId,
            startDate,
            endDate,
            status,
            sortBy = 'sale_date',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['s.user_id = $1'];
        let params = [req.session.userId];
        let paramIndex = 2;

        // Apply filters
        if (search) {
            conditions.push(`(LOWER(c.name) LIKE LOWER($${paramIndex}) OR s.id::text = $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (clientId) {
            conditions.push(`s.client_id = $${paramIndex}`);
            params.push(parseInt(clientId));
            paramIndex++;
        }

        if (startDate) {
            conditions.push(`s.sale_date >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }

        if (endDate) {
            conditions.push(`s.sale_date <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }

        const whereClause = conditions.join(' AND ');

        // Get total count for pagination
        const { rows: countRows } = await pool.query(`
            SELECT COUNT(DISTINCT s.id) as total
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE ${whereClause}
        `, params);
        
        const totalSales = parseInt(countRows[0].total);
        const totalPages = Math.ceil(totalSales / parseInt(limit));
        const currentPageInt = parseInt(page);

        // Get sales data with proper payment status calculation
        const salesQuery = `
            SELECT 
                s.id, s.total, s.sale_date, s.installments,
                c.name as client_name, c.phone as client_phone,
                CASE 
                    WHEN NOT EXISTS (
                        SELECT 1 FROM sale_payments sp 
                        JOIN installments i ON sp.id = i.sale_payments_id 
                        WHERE sp.sale_id = s.id AND sp.user_id = s.user_id
                    ) THEN 'Pago'
                    WHEN EXISTS (
                        SELECT 1 FROM sale_payments sp 
                        JOIN installments i ON sp.id = i.sale_payments_id 
                        WHERE sp.sale_id = s.id AND i.paid = false AND sp.user_id = s.user_id
                    ) THEN 'Pendente'
                    ELSE 'Pago'
                END as payment_status,
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'name', p.name,
                            'quantity', sp.quantity,
                            'unit_price', sp.unit_price
                        )
                    )
                    FROM sale_products sp
                    JOIN products p ON sp.product_id = p.id
                    WHERE sp.sale_id = s.id AND sp.user_id = s.user_id
                ) as products,
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'method', pm.method,
                            'amount', spm.amount,
                            'installments', spm.installments,
                            'paid', CASE 
                                WHEN NOT EXISTS (
                                    SELECT 1 FROM installments i 
                                    WHERE i.sale_payments_id = spm.id AND i.paid = false
                                ) THEN true 
                                ELSE false 
                            END,
                            'parcels', COALESCE(
                                (
                                    SELECT jsonb_agg(
                                        jsonb_build_object(
                                            'id', i.id,
                                            'number', i.number,
                                            'value', i.value,
                                            'due_date', i.due_date,
                                            'paid', i.paid
                                        )
                                        ORDER BY i.number
                                    )
                                    FROM installments i
                                    WHERE i.sale_payments_id = spm.id AND i.user_id = s.user_id
                                ),
                                '[]'::jsonb
                            )
                        )
                    )
                    FROM sale_payments spm
                    JOIN payment_methods pm ON spm.payment_method_id = pm.id
                    WHERE spm.sale_id = s.id AND spm.user_id = s.user_id
                ) as payment_methods
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE ${whereClause}
            ORDER BY s.${sortBy} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit), offset);
        const { rows: sales } = await pool.query(salesQuery, params);

        // Apply status filter after query (since it's computed)
        let filteredSales = sales;
        if (status) {
            const statusMap = {
                'paid': 'Pago',
                'pending': 'Pendente',
                'pagos': 'Pago',
                'pendentes': 'Pendente'
            };
            
            const targetStatus = statusMap[status.toLowerCase()] || status;
            filteredSales = sales.filter(sale => 
                sale.payment_status === targetStatus
            );
        }

        // Enhanced pagination info
        const paginationInfo = {
            currentPage: currentPageInt,
            totalPages,
            totalSales,
            itemsPerPage: parseInt(limit),
            hasNextPage: currentPageInt < totalPages,
            hasPreviousPage: currentPageInt > 1,
            startItem: offset + 1,
            endItem: Math.min(offset + parseInt(limit), totalSales),
            limitPerPage: parseInt(limit)
        };

        res.json({
            sales: filteredSales,
            pagination: paginationInfo
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar vendas');
    }
});

app.get('/api/vendas/:id', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                s.*,
                c.name as client_name, c.phone as client_phone,
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', p.id, 'name', p.name,
                            'quantity', sp.quantity, 'unit_price', sp.unit_price
                        )
                    )
                    FROM sale_products sp
                    JOIN products p ON sp.product_id = p.id
                    WHERE sp.sale_id = s.id AND sp.user_id = s.user_id
                ) as products,
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'method', pm.method, 'amount', spm.amount,
                            'installments', spm.installments,
                            'parcels', (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', i.id, 'number', i.number,
                                        'value', i.value, 'due_date', i.due_date, 'paid', i.paid
                                    )
                                    ORDER BY i.number
                                )
                                FROM installments i
                                WHERE i.sale_payments_id = spm.id AND i.user_id = s.user_id
                            )
                        )
                    )
                    FROM sale_payments spm
                    JOIN payment_methods pm ON spm.payment_method_id = pm.id
                    WHERE spm.sale_id = s.id AND spm.user_id = s.user_id
                ) as payment_methods
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            WHERE s.id = $1 AND s.user_id = $2
        `, [req.params.id, req.session.userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar venda');
    }
});

app.post('/api/vendas', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { clientId, saleDate, products, payments } = req.body;
        
        validateRequired(['clientId', 'saleDate', 'products', 'payments'], req.body);
        
        if (!products.length || !payments.length) {
            return res.status(400).json({ error: "Produtos e pagamentos são obrigatórios" });
        }
        
        await client.query('BEGIN');
        
        // Calculate totals
        const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        let totalInterest = 0;
        
        const processedPayments = payments.map(payment => {
            const interestAmount = payment.isCredit ? payment.amount * (payment.interest / 100) : 0;
            totalInterest += interestAmount;
            
            return {
                method: parseInt(payment.method),
                amount: parseFloat(payment.amount),
                installments: parseInt(payment.installments || 1),
                interest: parseFloat(payment.interest || 0),
                interestAmount: parseFloat(interestAmount)
            };
        });
        
        const total = subtotal + totalInterest;
        const maxInstallments = Math.max(...processedPayments.map(p => p.installments));
        
        // Insert sale
        const { rows: saleRows } = await client.query(`
            INSERT INTO sales (client_id, total, sale_date, user_id, interest, installments) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id
        `, [clientId, subtotal, saleDate, req.session.userId, totalInterest, maxInstallments]);
        
        const saleId = saleRows[0].id;
        
        // Process products
        for (const product of products) {
            // Check stock
            const stockCheck = await client.query(
                'SELECT stock FROM products WHERE id = $1 AND user_id = $2',
                [product.productId, req.session.userId]
            );
            
            if (stockCheck.rows.length === 0) {
                throw new Error(`Produto ${product.productId} não encontrado`);
            }
            
            if (stockCheck.rows[0].stock < product.quantity) {
                throw new Error(`Estoque insuficiente para produto ${product.productId}`);
            }
            
            // Update stock
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2 AND user_id = $3',
                [product.quantity, product.productId, req.session.userId]
            );
            
            // Insert sale product
            await client.query(`
                INSERT INTO sale_products (sale_id, product_id, quantity, unit_price, user_id) 
                VALUES ($1, $2, $3, $4, $5)
            `, [saleId, product.productId, product.quantity, product.price, req.session.userId]);
        }
        
        // Process payments
        for (const payment of processedPayments) {
            const { rows: paymentRows } = await client.query(`
                INSERT INTO sale_payments (payment_method_id, sale_id, amount, interest, installments, user_id) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING id
            `, [payment.method, saleId, payment.amount, payment.interestAmount, payment.installments, req.session.userId]);
            
            const paymentId = paymentRows[0].id;
            
            // Create installments
            const totalPaymentValue = payment.amount + payment.interestAmount;
            const installmentValue = totalPaymentValue / payment.installments;
            
            for (let i = 1; i <= payment.installments; i++) {
                const dueDate = new Date(saleDate);
                dueDate.setMonth(dueDate.getMonth() + i - 1);
                
                await client.query(`
                    INSERT INTO installments (sale_payments_id, number, value, due_date, user_id) 
                    VALUES ($1, $2, $3, $4, $5)
                `, [paymentId, i, installmentValue, dueDate, req.session.userId]);
            }
        }
        
        // Update client debt
        await client.query(
            'UPDATE clients SET debt = debt + $1 WHERE id = $2 AND user_id = $3',
            [total, clientId, req.session.userId]
        );
        
        await client.query('COMMIT');
        
        res.status(201).json({
            message: 'Venda registrada com sucesso',
            saleId,
            subtotal,
            totalInterest,
            total
        });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Erro ao criar venda');
    } finally {
        client.release();
    }
});

app.delete('/api/vendas/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const saleId = req.params.id;
        
        // Get sale info
        const { rows: saleInfo } = await client.query(`
            SELECT client_id, total FROM sales WHERE id = $1 AND user_id = $2
        `, [saleId, req.session.userId]);
        
        if (saleInfo.length === 0) {
            return res.status(404).json({ error: 'Venda não encontrada' });
        }
        
        // Restore stock
        const { rows: products } = await client.query(`
            SELECT product_id, quantity FROM sale_products WHERE sale_id = $1 AND user_id = $2
        `, [saleId, req.session.userId]);
        
        for (const product of products) {
            await client.query(
                'UPDATE products SET stock = stock + $1 WHERE id = $2 AND user_id = $3',
                [product.quantity, product.product_id, req.session.userId]
            );
        }
        
        // Get unpaid installments
        const { rows: installments } = await client.query(`
            SELECT SUM(i.value) as unpaid_total
            FROM installments i
            JOIN sale_payments sp ON i.sale_payments_id = sp.id
            WHERE sp.sale_id = $1 AND i.paid = false AND i.user_id = $2
        `, [saleId, req.session.userId]);
        
        const unpaidTotal = installments[0]?.unpaid_total || 0;
        
        // Delete in reverse order
        await client.query(`
            DELETE FROM installments 
            WHERE sale_payments_id IN (
                SELECT id FROM sale_payments WHERE sale_id = $1 AND user_id = $2
            ) AND user_id = $2
        `, [saleId, req.session.userId]);
        
        await client.query('DELETE FROM sale_payments WHERE sale_id = $1 AND user_id = $2', [saleId, req.session.userId]);
        await client.query('DELETE FROM sale_products WHERE sale_id = $1 AND user_id = $2', [saleId, req.session.userId]);
        await client.query('DELETE FROM sales WHERE id = $1 AND user_id = $2', [saleId, req.session.userId]);
        
        // Update client debt
        if (unpaidTotal > 0) {
            await client.query(
                'UPDATE clients SET debt = GREATEST(debt - $1, 0) WHERE id = $2 AND user_id = $3',
                [unpaidTotal, saleInfo[0].client_id, req.session.userId]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({ message: 'Venda excluída com sucesso' });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Erro ao excluir venda');
    } finally {
        client.release();
    }
});

// Bulk delete sales endpoint
app.post('/api/vendas/bulk-delete', requireAuth, async (req, res) => {
    const { saleIds } = req.body;
    
    // Validate input
    if (!saleIds || !Array.isArray(saleIds) || saleIds.length === 0) {
        return res.status(400).json({ error: 'Nenhuma venda selecionada para exclusão' });
    }
    
    // For extremely large operations, use a background job approach
    const BATCH_SIZE = 20; // Process 20 sales at a time to avoid long transactions
    let successCount = 0;
    let failedCount = 0;
    let processedClientIds = new Set();
    
    try {
        // Process in batches for better performance and to avoid long-running transactions
        for (let i = 0; i < saleIds.length; i += BATCH_SIZE) {
            const batch = saleIds.slice(i, i + BATCH_SIZE);
            const batchResult = await processSalesBatch(batch, req.session.userId);
            
            successCount += batchResult.successCount;
            failedCount += batchResult.failedCount;
            
            // Track unique client IDs that were affected
            batchResult.affectedClientIds.forEach(id => processedClientIds.add(id));
        }

        await scheduleMonthlyProfitRefresh(req.session.userId);
        
        return res.json({
            success: true,
            message: `${successCount} vendas excluídas com sucesso${failedCount > 0 ? ` (${failedCount} falhas)` : ''}`,
            deletedCount: successCount,
            failedCount: failedCount,
            clientsUpdated: processedClientIds.size
        });
    } catch (error) {
        console.error('Bulk delete sales error:', error);
        return res.status(500).json({ 
            error: 'Erro ao excluir vendas em lote', 
            message: error.message,
            successCount,
            failedCount
        });
    }
    async function scheduleMonthlyProfitRefresh(userId) {
        try {
            // Force calculation refresh
            console.log(`Scheduling profit refresh for user ${userId}`);
            setTimeout(async () => {
                try {
                    await calculateMonthlyProfit(userId, true);
                    console.log(`Profit refreshed for user ${userId}`);
                } catch (err) {
                    console.error('Error in scheduled profit refresh:', err);
                }
            }, 2000);
        } catch (error) {
            console.error('Error scheduling profit refresh:', error);
        }
    }
});

// Helper function to process a batch of sales
async function processSalesBatch(saleIds, userId) {
    let successCount = 0;
    let failedCount = 0;
    const affectedClientIds = new Set();
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Step 1: Verify all sales belong to this user
        const salesQuery = await client.query(`
            SELECT s.id, s.client_id 
            FROM sales s 
            WHERE s.id = ANY($1::int[]) AND s.user_id = $2
        `, [saleIds, userId]);
        
        const validSaleIds = salesQuery.rows.map(row => row.id);
        
        // Track which clients need debt updates
        const clientDebtUpdates = new Map();
        
        // Process each valid sale
        for (const saleId of validSaleIds) {
            try {
                // Get sale products for stock restoration
                const productsQuery = await client.query(`
                    SELECT product_id, quantity 
                    FROM sale_products 
                    WHERE sale_id = $1 AND user_id = $2
                `, [saleId, userId]);
                
                // Restore stock for each product
                for (const product of productsQuery.rows) {
                    await client.query(
                        'UPDATE products SET stock = stock + $1 WHERE id = $2 AND user_id = $3',
                        [product.quantity, product.product_id, userId]
                    );
                }
                
                // Get unpaid installments to update client debt
                const { rows } = await client.query(`
                    SELECT s.client_id, COALESCE(SUM(i.value), 0) as unpaid_amount
                    FROM sales s
                    LEFT JOIN sale_payments sp ON s.id = sp.sale_id
                    LEFT JOIN installments i ON sp.id = i.sale_payments_id AND i.paid = FALSE
                    WHERE s.id = $1 AND s.user_id = $2
                    GROUP BY s.client_id
                `, [saleId, userId]);
                
                if (rows.length > 0 && rows[0].client_id) {
                    const { client_id, unpaid_amount } = rows[0];
                    
                    // Track debt changes by client
                    const currentDebt = clientDebtUpdates.get(client_id) || 0;
                    clientDebtUpdates.set(client_id, currentDebt + parseFloat(unpaid_amount || 0));
                    
                    affectedClientIds.add(client_id);
                }
                
                // Delete cascade: installments -> sale_payments -> sale_products -> sales
                await client.query(`
                    DELETE FROM installments 
                    WHERE sale_payments_id IN (
                        SELECT id FROM sale_payments WHERE sale_id = $1 AND user_id = $2
                    ) AND user_id = $2
                `, [saleId, userId]);
                
                await client.query(
                    'DELETE FROM sale_payments WHERE sale_id = $1 AND user_id = $2', 
                    [saleId, userId]
                );
                
                await client.query(
                    'DELETE FROM sale_products WHERE sale_id = $1 AND user_id = $2', 
                    [saleId, userId]
                );
                
                await client.query(
                    'DELETE FROM sales WHERE id = $1 AND user_id = $2', 
                    [saleId, userId]
                );
                
                successCount++;
            } catch (error) {
                console.error(`Error processing sale ${saleId}:`, error);
                failedCount++;
            }
        }
        
        // Update client debts
        for (const [clientId, debtReduction] of clientDebtUpdates.entries()) {
            if (debtReduction > 0) {
                await client.query(
                    'UPDATE clients SET debt = GREATEST(debt - $1, 0) WHERE id = $2 AND user_id = $3',
                    [debtReduction, clientId, userId]
                );
            }
        }
        
        await client.query('COMMIT');
        
        return { 
            successCount, 
            failedCount, 
            affectedClientIds: Array.from(affectedClientIds) 
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Batch processing error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ========== INSTALLMENTS ROUTES ==========
app.patch('/api/installments/:id/pay', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get installment details with full join data for profit calculation
        const { rows } = await client.query(`
            SELECT 
                i.id, i.value, i.paid, i.due_date, 
                s.client_id, s.id as sale_id, s.sale_date,
                sp.product_id, sp.quantity, sp.unit_price,
                p.profit_percent, 
                c.campaign_profit_percent,
                c.start_date as campaign_start,
                c.end_date as campaign_end
            FROM installments i
            JOIN sale_payments spm ON i.sale_payments_id = spm.id
            JOIN sales s ON spm.sale_id = s.id
            JOIN sale_products sp ON s.id = sp.sale_id
            JOIN products p ON sp.product_id = p.id
            LEFT JOIN campaigns c ON p.id = c.product_id 
                AND s.sale_date >= c.start_date 
                AND s.sale_date <= c.end_date
            WHERE i.id = $1 AND i.user_id = $2
        `, [req.params.id, req.session.userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada' });
        }
        
        const { value, paid, client_id } = rows[0];
        
        if (paid) {
            return res.status(400).json({ error: 'Parcela já está paga' });
        }
        
        // Mark installment as paid with current timestamp
        const now = new Date();
        await client.query(`
            UPDATE installments SET paid = true, paid_date = $3 
            WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.session.userId, now]);
        
        // Update client debt
        await client.query(`
            UPDATE clients SET debt = GREATEST(debt - $1, 0) 
            WHERE id = $2 AND user_id = $3
        `, [value, client_id, req.session.userId]);
        
        // Commit the transaction
        await client.query('COMMIT');
        
        // Return additional data for client-side profit calculation
        const installmentDetails = {
            id: req.params.id,
            value: value,
            client_id: client_id,
            paid: true,
            paid_date: now,
            sale_details: rows.map(row => ({
                product_id: row.product_id,
                quantity: row.quantity,
                unit_price: row.unit_price,
                profit_percent: row.campaign_profit_percent || row.profit_percent
            }))
        };
        
        res.json({ 
            message: 'Parcela paga com sucesso',
            installment: installmentDetails
        });
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Erro ao marcar parcela como paga');
    } finally {
        client.release();
    }
});

// ========== BULK ACTIONS ==========
app.post('/api/acoes-lote/marcar-parcelas', requireAuth, async (req, res) => {
    const client = await pool.connect();
    const { saleIds, action } = req.body;
    
    try {
        if (!saleIds || !Array.isArray(saleIds) || saleIds.length === 0) {
            return res.status(400).json({ error: 'IDs de vendas são obrigatórios' });
        }
        
        await client.query('BEGIN');
        
        if (action === 'pay') {
            const installmentsQuery = `
                SELECT i.id, i.value, s.client_id, i.paid
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
                WHERE s.id = ANY($1::int[]) AND s.user_id = $2 AND i.user_id = $2 AND i.paid = false
            `;
            
            const { rows: installments } = await client.query(installmentsQuery, [saleIds, req.session.userId]);
            
            let processedCount = 0;
            
            for (const installment of installments) {
                await client.query(`
                    UPDATE installments 
                    SET paid = TRUE, paid_date = CURRENT_DATE
                    WHERE id = $1 AND user_id = $2
                `, [installment.id, req.session.userId]);
                
                await client.query(`
                    UPDATE clients 
                    SET debt = GREATEST(debt - $1, 0)
                    WHERE id = $2 AND user_id = $3
                `, [installment.value, installment.client_id, req.session.userId]);
                
                processedCount++;
            }
            
            await client.query('COMMIT');
            res.json({ 
                message: `${processedCount} parcela${processedCount !== 1 ? 's' : ''} processada${processedCount !== 1 ? 's' : ''}`,
                processedInstallments: processedCount,
                processedSales: saleIds.length
            });
        } else {
            await client.query('ROLLBACK');
            res.status(400).json({ error: 'Ação não suportada' });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        handleError(res, err, 'Erro ao processar ações em lote');
    } finally {
        client.release();
    }
});

// ========== PAYMENT METHODS ==========
app.get('/api/payment-methods', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM payment_methods ORDER BY method');
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar métodos de pagamento');
    }
});

// ========== NOTIFICATIONS ==========
app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const today = new Date();
        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(today.getDate() + 7);

        const todayStr = today.toISOString().split('T')[0];
        const oneWeekStr = oneWeekFromNow.toISOString().split('T')[0];

        const [overdueResult, dueThisWeekResult, dueTodayResult] = await Promise.all([
            pool.query(`
                SELECT COUNT(*) as count 
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
                WHERE i.user_id = $1 
                AND i.due_date < $2 
                AND i.paid = false
                AND s.user_id = $1
            `, [req.session.userId, todayStr]),
            
            pool.query(`
                SELECT COUNT(*) as count 
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
                WHERE i.user_id = $1 
                AND i.due_date BETWEEN $2 AND $3 
                AND i.paid = false
                AND s.user_id = $1
            `, [req.session.userId, todayStr, oneWeekStr]),
            
            pool.query(`
                SELECT COUNT(*) as count 
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
                WHERE i.user_id = $1 
                AND i.due_date = $2 
                AND i.paid = false
                AND s.user_id = $1
            `, [req.session.userId, todayStr])
        ]);

        const overdueCount = parseInt(overdueResult.rows[0].count);
        const dueThisWeekCount = parseInt(dueThisWeekResult.rows[0].count);
        const dueTodayCount = parseInt(dueTodayResult.rows[0].count);

        let notification = null;

        if (overdueCount > 0) {
            notification = {
                type: 'danger',
                icon: 'bi-exclamation-triangle',
                message: `Atenção! Você tem ${overdueCount} parcela${overdueCount > 1 ? 's' : ''} em atraso.`,
                priority: 3
            };
        } else if (dueTodayCount > 0) {
            notification = {
                type: 'warning',
                icon: 'bi-clock',
                message: `Hoje vencem ${dueTodayCount} parcela${dueTodayCount > 1 ? 's' : ''}!`,
                priority: 2
            };
        } else if (dueThisWeekCount > 0) {
            notification = {
                type: 'info',
                icon: 'bi-bell',
                message: `Você tem ${dueThisWeekCount} parcela${dueThisWeekCount > 1 ? 's' : ''} vencendo esta semana.`,
                priority: 1
            };
        } else {
            notification = {
                type: 'success',
                icon: 'bi-check-circle',
                message: 'Todas as parcelas estão em dia!',
                priority: 0
            };
        }

        res.json(notification);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ 
            type: 'info',
            icon: 'bi-info-circle',
            message: 'Bem-vindo ao sistema de vendas!',
            priority: 0
        });
    }
});

// ========== ANALYTICS ROUTES ==========

app.get('/api/sales/statistics', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        let filterConditions = ['user_id = $1'];
        let params = [req.session.userId];
        let paramIndex = 2;
        
        // Add any filters that might be applied
        if (startDate) {
            filterConditions.push(`sale_date >= $${paramIndex}`);
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            filterConditions.push(`sale_date <= $${paramIndex}`);
            params.push(endDate);
            paramIndex++;
        }
        
        const filterClause = filterConditions.length > 0 ? 'WHERE ' + filterConditions.join(' AND ') : '';
        
        // Get complete statistics in one query for efficiency
        const { rows } = await pool.query(`
            WITH sales_data AS (
                SELECT 
                    COUNT(*) as total_sales,
                    SUM(total) as total_revenue,
                    COUNT(CASE WHEN NOT EXISTS (
                        SELECT 1 FROM installments i 
                        JOIN sale_payments sp ON i.sale_payments_id = sp.id 
                        WHERE sp.sale_id = s.id AND i.paid = false AND i.user_id = $1
                    ) THEN 1 END) as paid_sales,
                    COUNT(CASE WHEN EXISTS (
                        SELECT 1 FROM installments i 
                        JOIN sale_payments sp ON i.sale_payments_id = sp.id 
                        WHERE sp.sale_id = s.id AND i.paid = false AND i.user_id = $1
                    ) THEN 1 END) as pending_sales
                FROM sales s
                ${filterClause}
            )
            SELECT * FROM sales_data
        `, params);
        
        if (rows.length === 0) {
            return res.json({
                totalSales: 0,
                totalRevenue: 0,
                paidSales: 0,
                pendingSales: 0
            });
        }
        
        const stats = rows[0];
        res.json({
            totalSales: parseInt(stats.total_sales),
            totalRevenue: parseFloat(stats.total_revenue || 0),
            paidSales: parseInt(stats.paid_sales || 0),
            pendingSales: parseInt(stats.pending_sales || 0)
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar estatísticas de vendas');
    }
});

app.get('/api/analytics/sales-today', requireAuth, async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        const { rows } = await pool.query(`
            SELECT 
                COUNT(*) as sales_count,
                COALESCE(SUM(total), 0) as total_revenue,
                COALESCE(AVG(total), 0) as avg_ticket,
                COUNT(DISTINCT client_id) as unique_clients
            FROM sales 
            WHERE user_id = $1 
            AND sale_date >= $2 
            AND sale_date < $3
        `, [req.session.userId, startOfDay, endOfDay]);

        const stats = rows[0];
        
        // Calculate comparison with yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        
        const { rows: yesterdayRows } = await pool.query(`
            SELECT 
                COUNT(*) as sales_count,
                COALESCE(SUM(total), 0) as total_revenue
            FROM sales 
            WHERE user_id = $1 
            AND sale_date >= $2 
            AND sale_date < $3
        `, [req.session.userId, startOfYesterday, startOfDay]);

        const yesterdayStats = yesterdayRows[0];
        
        const salesChange = yesterdayStats.sales_count > 0 
            ? ((stats.sales_count - yesterdayStats.sales_count) / yesterdayStats.sales_count * 100).toFixed(1)
            : stats.sales_count > 0 ? 100 : 0;
            
        const revenueChange = yesterdayStats.total_revenue > 0 
            ? ((stats.total_revenue - yesterdayStats.total_revenue) / yesterdayStats.total_revenue * 100).toFixed(1)
            : stats.total_revenue > 0 ? 100 : 0;

        res.json({
            sales_count: parseInt(stats.sales_count),
            total_revenue: parseFloat(stats.total_revenue),
            avg_ticket: parseFloat(stats.avg_ticket),
            unique_clients: parseInt(stats.unique_clients),
            sales_change: parseFloat(salesChange),
            revenue_change: parseFloat(revenueChange)
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar analytics de vendas');
    }
});

app.get('/api/analytics/conversion', requireAuth, async (req, res) => {
    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const { rows } = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM clients WHERE user_id = $1) as total_clients,
                COUNT(DISTINCT s.client_id) as clients_with_purchases,
                COUNT(DISTINCT s.id) as total_sales
            FROM sales s
            WHERE s.user_id = $1 
            AND s.sale_date >= $2
        `, [req.session.userId, startOfMonth]);

        const stats = rows[0];
        const conversionRate = stats.total_clients > 0 
            ? ((stats.clients_with_purchases / stats.total_clients) * 100).toFixed(1)
            : 0;

        const target = 70;
        const targetDiff = (conversionRate - target).toFixed(1);

        res.json({
            conversion_rate: parseFloat(conversionRate),
            total_clients: parseInt(stats.total_clients),
            clients_with_purchases: parseInt(stats.clients_with_purchases),
            target_diff: parseFloat(targetDiff),
            performance: conversionRate >= target ? 'above' : 'below'
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar analytics de conversão');
    }
});

app.get('/api/analytics/top-products', requireAuth, async (req, res) => {
    try {
        const { limit = 5, period = '30' } = req.query;
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(period));

        const { rows } = await pool.query(`
            SELECT 
                p.name as product_name,
                b.name as brand_name,
                SUM(sp.quantity) as total_quantity,
                SUM(sp.quantity * sp.unit_price) as total_revenue,
                COUNT(DISTINCT sp.sale_id) as sales_count,
                AVG(sp.unit_price) as avg_price
            FROM sale_products sp
            JOIN products p ON sp.product_id = p.id
            LEFT JOIN brands b ON p.brand = b.id
            JOIN sales s ON sp.sale_id = s.id
            WHERE sp.user_id = $1 
            AND s.sale_date >= $2
            GROUP BY p.id, p.name, b.name
            ORDER BY total_quantity DESC
            LIMIT $3
        `, [req.session.userId, daysAgo, parseInt(limit)]);

        res.json(rows.map(row => ({
            product_name: row.product_name,
            brand_name: row.brand_name || 'Sem marca',
            total_quantity: parseInt(row.total_quantity),
            total_revenue: parseFloat(row.total_revenue),
            sales_count: parseInt(row.sales_count),
            avg_price: parseFloat(row.avg_price)
        })));
    } catch (error) {
        handleError(res, error, 'Erro ao buscar produtos mais vendidos');
    }
});

app.get('/api/analytics/revenue-trend', requireAuth, async (req, res) => {
    try {
        const { days = 7, filter = '' } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Note: The filter parameter should be applied to filter data,
        // but we don't apply pagination limits here
        let filterCondition = 'user_id = $1 AND sale_date >= $2 AND sale_date <= CURRENT_DATE';
        let params = [req.session.userId, startDate];
        
        if (filter) {
            // Apply any additional filters here based on the filter parameter
            // But don't limit the results to a specific page
        }

        const { rows } = await pool.query(`
            SELECT 
                DATE(sale_date) as date,
                COUNT(*) as sales_count,
                COALESCE(SUM(total), 0) as revenue,
                COALESCE(AVG(total), 0) as avg_ticket
            FROM sales
            WHERE ${filterCondition}
            GROUP BY DATE(sale_date)
            ORDER BY date ASC
        `, params);

        // Fill missing dates with zero values
        const result = [];
        const currentDate = new Date(startDate);
        const today = new Date();
        
        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const existing = rows.find(row => {
                if (!row.date) return false;
                const rowDate = new Date(row.date);
                return rowDate.toISOString().split('T')[0] === dateStr;
            });
            
            result.push({
                date: dateStr,
                sales_count: existing ? parseInt(existing.sales_count) : 0,
                revenue: existing ? parseFloat(existing.revenue) : 0,
                avg_ticket: existing ? parseFloat(existing.avg_ticket) : 0
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }

        res.json(result);
    } catch (error) {
        console.error('Revenue trend error:', error);
        res.json([]);
    }
});

app.get('/api/debug/user-data', requireAuth, async (req, res) => {
    try {
        const [clients, sales, installments] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM clients WHERE user_id = $1', [req.session.userId]),
            pool.query('SELECT COUNT(*) as count FROM sales WHERE user_id = $1', [req.session.userId]),
            pool.query('SELECT COUNT(*) as count FROM installments WHERE user_id = $1', [req.session.userId])
        ]);

        res.json({
            user_id: req.session.userId,
            clients_count: clients.rows[0].count,
            sales_count: sales.rows[0].count,
            installments_count: installments.rows[0].count
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.json({ error: error.message });
    }
});

app.get('/api/analytics/payment-methods', requireAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const { rows } = await pool.query(`
            SELECT 
                pm.method as payment_method,
                COUNT(sp.id) as usage_count,
                SUM(sp.amount) as total_amount,
                AVG(sp.amount) as avg_amount
            FROM sale_payments sp
            JOIN payment_methods pm ON sp.payment_method_id = pm.id
            JOIN sales s ON sp.sale_id = s.id
            WHERE sp.user_id = $1 
            AND s.sale_date >= $2
            GROUP BY pm.id, pm.method
            ORDER BY usage_count DESC
        `, [req.session.userId, startDate]);

        const total = rows.reduce((sum, row) => sum + parseInt(row.usage_count), 0);

        res.json(rows.map(row => ({
            method: row.payment_method,
            count: parseInt(row.usage_count),
            total_amount: parseFloat(row.total_amount),
            avg_amount: parseFloat(row.avg_amount),
            percentage: total > 0 ? ((parseInt(row.usage_count) / total) * 100).toFixed(1) : 0
        })));
    } catch (error) {
        handleError(res, error, 'Erro ao buscar métodos de pagamento');
    }
});

app.get('/api/analytics/client-insights', requireAuth, async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Simplified query to avoid complex joins that might cause timeouts
        const [clientsResult, activeClientsResult, debtClientsResult, statsResult] = await Promise.all([
            pool.query('SELECT COUNT(*) as total FROM clients WHERE user_id = $1', [req.session.userId]),
            
            pool.query(`
                SELECT COUNT(DISTINCT client_id) as active 
                FROM sales 
                WHERE user_id = $1 AND sale_date >= $2
            `, [req.session.userId, thirtyDaysAgo]),
            
            pool.query('SELECT COUNT(*) as debt FROM clients WHERE user_id = $1 AND debt > 0', [req.session.userId]),
            
            pool.query(`
                SELECT 
                    COUNT(*) as total_purchases,
                    COALESCE(SUM(total), 0) as total_spent,
                    COUNT(DISTINCT client_id) as clients_with_purchases
                FROM sales 
                WHERE user_id = $1
            `, [req.session.userId])
        ]);

        const totalClients = parseInt(clientsResult.rows[0].total || 0);
        const activeClients = parseInt(activeClientsResult.rows[0].active || 0);
        const clientsWithDebt = parseInt(debtClientsResult.rows[0].debt || 0);
        const stats = statsResult.rows[0];

        const activityRate = totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(1) : 0;
        const avgPurchases = stats.clients_with_purchases > 0 ? (stats.total_purchases / stats.clients_with_purchases).toFixed(1) : 0;
        const avgSpent = stats.clients_with_purchases > 0 ? (stats.total_spent / stats.clients_with_purchases) : 0;

        res.json({
            total_clients: totalClients,
            active_clients: activeClients,
            clients_with_debt: clientsWithDebt,
            activity_rate: parseFloat(activityRate),
            avg_purchases_per_client: parseFloat(avgPurchases),
            avg_spent_per_client: parseFloat(avgSpent)
        });
    } catch (error) {
        console.error('Client insights error:', error);
        res.json({
            total_clients: 0,
            active_clients: 0,
            clients_with_debt: 0,
            activity_rate: 0,
            avg_purchases_per_client: 0,
            avg_spent_per_client: 0
        });
    }
});

// ========== REPORTS ROUTES ==========
app.get('/api/relatorios/vendas-detalhado', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;
        
        let dateFormat;
        switch (groupBy) {
            case 'month':
                dateFormat = "DATE_TRUNC('month', s.sale_date)";
                break;
            case 'week':
                dateFormat = "DATE_TRUNC('week', s.sale_date)";
                break;
            default:
                dateFormat = "DATE(s.sale_date)";
        }
        
        let query = `
            SELECT 
                ${dateFormat} as period,
                COUNT(DISTINCT s.id) as total_sales,
                SUM(s.total) as total_revenue,
                AVG(s.total) as average_ticket,
                COUNT(DISTINCT s.client_id) as unique_clients,
                array_agg(DISTINCT pm.method) as payment_methods_used
            FROM sales s
            LEFT JOIN sale_payments sp ON s.id = sp.sale_id
            LEFT JOIN payment_methods pm ON sp.payment_method_id = pm.id
            WHERE s.user_id = $1
        `;
        
        const params = [req.session.userId];
        let paramIndex = 2;
        
        if (startDate) {
            query += ` AND s.sale_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND s.sale_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        query += `
            GROUP BY ${dateFormat}
            ORDER BY period DESC
        `;
        
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao gerar relatório detalhado');
    }
});

app.get('/api/relatorios/produtos-mais-vendidos', requireAuth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const { rows } = await pool.query(`
            SELECT 
                p.id, p.name, p.price,
                b.name as brand_name,
                SUM(sp.quantity) as total_sold,
                SUM(sp.quantity * sp.unit_price) as total_revenue,
                COUNT(DISTINCT sp.sale_id) as sales_count
            FROM sale_products sp
            JOIN products p ON sp.product_id = p.id
            JOIN brands b ON p.brand = b.id
            JOIN sales s ON sp.sale_id = s.id
            WHERE sp.user_id = $1 AND s.user_id = $1 AND p.user_id = $1
            GROUP BY p.id, p.name, p.price, b.name
            ORDER BY total_sold DESC
            LIMIT $2
        `, [req.session.userId, parseInt(limit)]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar produtos mais vendidos');
    }
});

app.get('/api/relatorios/clientes-devedores', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                c.id, c.name, c.phone, c.debt,
                COUNT(DISTINCT s.id) as total_purchases,
                SUM(s.total) as total_spent,
                MAX(s.sale_date) as last_purchase_date,
                COUNT(DISTINCT i.id) as pending_installments,
                SUM(CASE WHEN i.due_date < CURRENT_DATE AND i.paid = FALSE THEN i.value ELSE 0 END) as overdue_amount
            FROM clients c
            LEFT JOIN sales s ON c.id = s.client_id AND s.user_id = $1
            LEFT JOIN sale_payments spm ON s.id = spm.sale_id AND spm.user_id = $1
            LEFT JOIN installments i ON spm.id = i.sale_payments_id AND i.user_id = $1 AND i.paid = FALSE
            WHERE c.user_id = $1 AND c.debt > 0
            GROUP BY c.id, c.name, c.phone, c.debt
            ORDER BY c.debt DESC
        `, [req.session.userId]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar clientes devedores');
    }
});

app.get('/api/relatorios/lucro-mensal', requireAuth, async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.query;
        
        const { rows } = await pool.query(`
            SELECT 
                EXTRACT(MONTH FROM i.due_date) as month,
                TO_CHAR(DATE_TRUNC('month', i.due_date), 'Month') as month_name,
                SUM(CASE WHEN i.paid THEN 
                    i.value * (p.profit_percent / 100.0) 
                    ELSE 0 
                END) as profit_paid,
                SUM(i.value * (p.profit_percent / 100.0)) as profit_total,
                COUNT(DISTINCT CASE WHEN i.paid THEN i.id END) as installments_paid,
                COUNT(DISTINCT i.id) as installments_total
            FROM installments i
            JOIN sale_payments spm ON i.sale_payments_id = spm.id
            JOIN sales s ON spm.sale_id = s.id
            JOIN sale_products sp ON s.id = sp.sale_id
            JOIN products p ON sp.product_id = p.id
            WHERE EXTRACT(YEAR FROM i.due_date) = $1
                AND i.user_id = $2
                AND s.user_id = $2
                AND sp.user_id = $2
                AND p.user_id = $2
            GROUP BY EXTRACT(MONTH FROM i.due_date), TO_CHAR(DATE_TRUNC('month', i.due_date), 'Month')
            ORDER BY month
        `, [year, req.session.userId]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao calcular lucro mensal');
    }
});

// ========== COMMISSION CALCULATOR ==========
app.get('/api/comissoes/calcular', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate, productId } = req.query;
        
        let query = `
            SELECT 
                p.id as product_id,
                p.name as product_name,
                p.profit_percent,
                SUM(sp.quantity) as total_quantity_sold,
                SUM(sp.quantity * sp.unit_price) as total_revenue,
                SUM(sp.quantity * sp.unit_price * p.profit_percent / 100) as total_commission
            FROM sale_products sp
            JOIN products p ON sp.product_id = p.id
            JOIN sales s ON sp.sale_id = s.id
            WHERE s.user_id = $1
        `;
        
        const params = [req.session.userId];
        let paramIndex = 2;
        
        if (startDate) {
            query += ` AND s.sale_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND s.sale_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (productId) {
            query += ` AND p.id = $${paramIndex}`;
            params.push(productId);
            paramIndex++;
        }
        
        query += `
            GROUP BY p.id, p.name, p.profit_percent
            ORDER BY total_commission DESC
        `;
        
        const { rows } = await pool.query(query, params);
        
        const totalCommission = rows.reduce((sum, row) => sum + parseFloat(row.total_commission), 0);
        
        res.json({
            commissions: rows,
            totalCommission: totalCommission,
            period: { startDate, endDate }
        });
    } catch (error) {
        handleError(res, error, 'Erro ao calcular comissões');
    }
});

// ========== CUSTOMER INSIGHTS ==========
app.get('/api/insights/clientes', requireAuth, async (req, res) => {
    try {
        const { rows: topClients } = await pool.query(`
            SELECT 
                c.id, c.name, c.phone, c.debt,
                COUNT(s.id) as total_purchases,
                SUM(s.total) as total_spent,
                AVG(s.total) as average_purchase,
                MAX(s.sale_date) as last_purchase_date,
                CASE 
                    WHEN MAX(s.sale_date) >= CURRENT_DATE - INTERVAL '30 days' THEN 'Ativo'
                    WHEN MAX(s.sale_date) >= CURRENT_DATE - INTERVAL '90 days' THEN 'Inativo'
                    ELSE 'Perdido'
                END as status
            FROM clients c
            LEFT JOIN sales s ON c.id = s.client_id AND s.user_id = $1
            WHERE c.user_id = $1
            GROUP BY c.id, c.name, c.phone, c.debt
            ORDER BY total_spent DESC NULLS LAST
            LIMIT 20
        `, [req.session.userId]);
        
        const { rows: productPreferences } = await pool.query(`
            SELECT 
                c.id as client_id, c.name as client_name,
                p.name as product_name, p.category,
                SUM(sp.quantity) as total_quantity,
                COUNT(DISTINCT s.id) as purchase_frequency
            FROM clients c
            JOIN sales s ON c.id = s.client_id
            JOIN sale_products sp ON s.id = sp.sale_id
            JOIN products p ON sp.product_id = p.id
            WHERE c.user_id = $1 AND s.user_id = $1 AND sp.user_id = $1
            GROUP BY c.id, c.name, p.name, p.category
            ORDER BY c.id, total_quantity DESC
        `, [req.session.userId]);
        
        // Group preferences by client
        const clientPreferences = {};
        productPreferences.forEach(row => {
            if (!clientPreferences[row.client_id]) {
                clientPreferences[row.client_id] = [];
            }
            clientPreferences[row.client_id].push({
                product: row.product_name,
                category: row.category,
                quantity: row.total_quantity,
                frequency: row.purchase_frequency
            });
        });
        
        res.json({
            topClients: topClients.map(client => ({
                ...client,
                preferences: clientPreferences[client.id] || []
            })),
            summary: {
                totalClients: topClients.length,
                activeClients: topClients.filter(c => c.status === 'Ativo').length,
                inactiveClients: topClients.filter(c => c.status === 'Inativo').length,
                lostClients: topClients.filter(c => c.status === 'Perdido').length
            }
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar insights de clientes');
    }
});

// ========== STATISTICS ROUTES ==========
app.get('/api/estatisticas', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                COUNT(DISTINCT p.id) as total_products,
                COUNT(DISTINCT b.id) as total_brands,
                COUNT(DISTINCT p.category) as total_categories,
                COUNT(DISTINCT c.id) as active_campaigns,
                SUM(p.stock) as total_stock,
                COUNT(CASE WHEN p.stock <= 5 THEN 1 END) as low_stock_count,
                AVG(p.price) as avg_price,
                SUM(CASE WHEN c.promo_price IS NOT NULL 
                         AND c.start_date <= CURRENT_DATE 
                         AND c.end_date >= CURRENT_DATE 
                         THEN 1 ELSE 0 END) as products_on_sale
            FROM products p
            LEFT JOIN brands b ON p.brand = b.id
            LEFT JOIN campaigns c ON p.current_campaign_id = c.id
            WHERE p.user_id = $1
        `, [req.session.userId]);
        
        res.json(rows[0]);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar estatísticas');
    }
});

// ========== EXPORT FUNCTIONS ==========
app.get('/api/exportar/vendas', requireAuth, async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        let query = `
            SELECT 
                s.id, s.sale_date, s.total,
                c.name as client_name, c.phone as client_phone,
                array_agg(DISTINCT p.name) as products,
                array_agg(DISTINCT pm.method) as payment_methods,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM installments i 
                        JOIN sale_payments sp ON i.sale_payments_id = sp.id 
                        WHERE sp.sale_id = s.id AND i.paid = false AND i.user_id = $1
                    ) THEN 'Pendente'
                    ELSE 'Pago'
                END as payment_status
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id AND c.user_id = $1
            LEFT JOIN sale_products sp ON s.id = sp.sale_id AND sp.user_id = $1
            LEFT JOIN products p ON sp.product_id = p.id AND p.user_id = $1
            LEFT JOIN sale_payments spm ON s.id = spm.sale_id AND spm.user_id = $1
            LEFT JOIN payment_methods pm ON spm.payment_method_id = pm.id
            WHERE s.user_id = $1
        `;
        
        const params = [req.session.userId];
        let paramIndex = 2;
        
        if (startDate) {
            query += ` AND s.sale_date >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            query += ` AND s.sale_date <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        query += `
            GROUP BY s.id, s.sale_date, s.total, c.name, c.phone
            ORDER BY s.sale_date DESC
        `;
        
        const { rows } = await pool.query(query, params);
        
        if (format === 'csv') {
            const csvData = rows.map(row => ({
                ID: row.id,
                Data: new Date(row.sale_date).toLocaleDateString('pt-BR'),
                Total: `R$ ${parseFloat(row.total).toFixed(2)}`,
                Cliente: row.client_name || '',
                Telefone: row.client_phone || '',
                Produtos: row.products ? row.products.filter(p => p).join(', ') : '',
                'Métodos de Pagamento': row.payment_methods ? row.payment_methods.filter(m => m).join(', ') : '',
                Status: row.payment_status
            }));
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=vendas.csv');
            
            const headers = Object.keys(csvData[0] || {});
            const csvContent = '\uFEFF' + [
                headers.join(','),
                ...csvData.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(','))
            ].join('\n');
            
            res.send(csvContent);
        } else {
            const formattedRows = rows.map(row => ({
                ...row,
                sale_date: new Date(row.sale_date).toLocaleDateString('pt-BR'),
                total: parseFloat(row.total),
                products: row.products ? row.products.filter(p => p) : [],
                payment_methods: row.payment_methods ? row.payment_methods.filter(m => m) : []
            }));
            
            res.json(formattedRows);
        }
    } catch (error) {
        handleError(res, error, 'Erro ao exportar dados');
    }
});

// ========== CLIENT HISTORY ==========
app.get('/clientes/:id/historico', requireAuth, async (req, res) => {
    try {
        // Get client info
        const clientResult = await pool.query(`
            SELECT id, name, phone, debt
            FROM clients 
            WHERE id = $1 AND user_id = $2
        `, [req.params.id, req.session.userId]);

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: "Cliente não encontrado" });
        }

        // Get sales history with installment details
        const historyResult = await pool.query(`
            SELECT 
                s.id as sale_id,
                s.sale_date, 
                s.total, 
                s.installments as total_installments,
                ARRAY_AGG(DISTINCT p.name) as products,
                COALESCE(
                    (SELECT COUNT(DISTINCT i.id)
                     FROM sale_payments spm
                     JOIN installments i ON spm.id = i.sale_payments_id
                     WHERE spm.sale_id = s.id 
                     AND i.paid = true 
                     AND i.user_id = $2), 0
                ) as paid_installments,
                COALESCE(
                    (SELECT SUM(i.value)
                     FROM sale_payments spm
                     JOIN installments i ON spm.id = i.sale_payments_id
                     WHERE spm.sale_id = s.id 
                     AND i.paid = true 
                     AND i.user_id = $2), 0
                ) as paid_amount,
                s.total - COALESCE(
                    (SELECT SUM(i.value)
                     FROM sale_payments spm
                     JOIN installments i ON spm.id = i.sale_payments_id
                     WHERE spm.sale_id = s.id 
                     AND i.paid = true 
                     AND i.user_id = $2), 0
                ) as remaining_amount,
                s.installments - COALESCE(
                    (SELECT COUNT(DISTINCT i.id)
                     FROM sale_payments spm
                     JOIN installments i ON spm.id = i.sale_payments_id
                     WHERE spm.sale_id = s.id 
                     AND i.paid = true 
                     AND i.user_id = $2), 0
                ) as remaining_installments,
                (s.total / GREATEST(s.installments, 1)) as installment_value
            FROM sales s
            LEFT JOIN sale_products spr ON s.id = spr.sale_id
            LEFT JOIN products p ON spr.product_id = p.id
            WHERE s.client_id = $1 AND s.user_id = $2
            GROUP BY s.id, s.sale_date, s.total, s.installments
            ORDER BY s.sale_date DESC
        `, [req.params.id, req.session.userId]);

        res.json({
            client: clientResult.rows[0],
            history: historyResult.rows
        });
    } catch (error) {
        handleError(res, error, "Erro ao buscar histórico");
    }
});

// ========== BACKUP & MAINTENANCE ==========
app.get('/api/backup/export', requireAuth, async (req, res) => {
    try {
        const [clients, products, sales, brands] = await Promise.all([
            pool.query('SELECT * FROM clients WHERE user_id = $1', [req.session.userId]),
            pool.query('SELECT * FROM products WHERE user_id = $1', [req.session.userId]),
            pool.query(`
                SELECT s.*, 
                       json_agg(DISTINCT sp) as products,
                       json_agg(DISTINCT spm) as payments
                FROM sales s
                LEFT JOIN sale_products sp ON s.id = sp.sale_id AND sp.user_id = $1
                LEFT JOIN sale_payments spm ON s.id = spm.sale_id AND spm.user_id = $1
                WHERE s.user_id = $1
                GROUP BY s.id
            `, [req.session.userId]),
            pool.query('SELECT * FROM brands WHERE user_id = $1', [req.session.userId])
        ]);

        const backupData = {
            exportDate: new Date().toISOString(),
            userId: req.session.userId,
            data: {
                clients: clients.rows,
                products: products.rows,
                sales: sales.rows,
                brands: brands.rows
            }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=backup_${new Date().toISOString().split('T')[0]}.json`);
        res.json(backupData);
    } catch (error) {
        handleError(res, error, 'Erro ao gerar backup');
    }
});

// ========== DASHBOARD SPECIFIC ROUTES ==========
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
        const [
            totalClientsResult,
            totalProductsResult,
            totalSalesResult,
            pendingInstallmentsResult,
            lowStockResult,
            overdueResult
        ] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM clients WHERE user_id = $1', [req.session.userId]),
            pool.query('SELECT COUNT(*) as count FROM products WHERE user_id = $1', [req.session.userId]),
            pool.query('SELECT COUNT(*) as count, SUM(total) as revenue FROM sales WHERE user_id = $1', [req.session.userId]),
            pool.query(`
                SELECT COUNT(*) as count, SUM(value) as total_amount 
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
                WHERE i.paid = FALSE AND i.user_id = $1 AND s.user_id = $1
            `, [req.session.userId]),
            pool.query('SELECT COUNT(*) as count FROM products WHERE stock <= 10 AND user_id = $1', [req.session.userId]),
            pool.query(`
                SELECT COUNT(*) as count, SUM(value) as total_amount 
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON smp.sale_id = s.id
                WHERE i.due_date < CURRENT_DATE 
                    AND i.paid = FALSE 
                    AND i.user_id = $1 
                    AND s.user_id = $1
            `, [req.session.userId])
        ]);

        const monthlyProfit = await calculateMonthlyProfit(req.session.userId);

        res.json({
            totalClients: parseInt(totalClientsResult.rows[0].count),
            totalProducts: parseInt(totalProductsResult.rows[0].count),
            totalSales: parseInt(totalSalesResult.rows[0].count),
            totalRevenue: parseFloat(totalSalesResult.rows[0].revenue || 0),
            pendingInstallments: parseInt(pendingInstallmentsResult.rows[0].count),
            pendingAmount: parseFloat(pendingInstallmentsResult.rows[0].total_amount || 0),
            lowStockProducts: parseInt(lowStockResult.rows[0].count),
            overdueInstallments: parseInt(overdueResult.rows[0].count),
            overdueAmount: parseFloat(overdueResult.rows[0].total_amount || 0),
            monthlyProfit: monthlyProfit
        });
    } catch (error) {
        handleError(res, error, 'Erro ao buscar estatísticas do dashboard');
    }
});

app.get('/api/sales/recent', requireAuth, async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        const { rows } = await pool.query(`
            SELECT 
                s.id, s.total, s.sale_date,
                c.name as client_name,
                CASE 
                    WHEN COUNT(sp.product_id) = 1 THEN MAX(p.name)
                    WHEN COUNT(sp.product_id) > 1 THEN CONCAT(MAX(p.name), ' +', COUNT(sp.product_id) - 1, ' outros')
                    ELSE 'Produtos não encontrados'
                END as product_name
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN sale_products sp ON s.id = sp.sale_id
            LEFT JOIN products p ON sp.product_id = p.id
            WHERE s.user_id = $1
            GROUP BY s.id, s.total, s.sale_date, c.name
            ORDER BY s.sale_date DESC
            LIMIT $2
        `, [req.session.userId, parseInt(limit)]);
        
        res.json(rows);
    } catch (error) {
        handleError(res, error, 'Erro ao buscar vendas recentes');
    }
});

// ========== 404 & ERROR HANDLERS ==========
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
    handleError(res, err);
});

// ========== SERVER STARTUP ==========
const server = app.listen(port, () => {
    console.log(`🚀 Servidor FinHelp rodando na porta ${port}`);
    console.log(`📱 Acesse: http://localhost:${port}`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Banco: PostgreSQL`);
    console.log(`🔐 Sessões: Configuradas`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Server closed.');
        pool.end();
        process.exit(0);
    });
});

export default app;
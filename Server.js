import express from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import pool from "./database.js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const app = express();
const port = 3000;

// --- Sessões em Postgres
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
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 dia
}));

app.use(express.static("public"));
app.use("/images", express.static("public/images"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");

// --- Configuração Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/images/products"),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({ 
  storage, 
  fileFilter: (req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Apenas imagens!"), false),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// --- Middleware de autenticação
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        // For API requests, return 401 instead of redirecting
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        // For web requests, redirect to login
        return res.redirect('/login');
    }
    next();
};

// --- Registro
app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (username,email,password) VALUES($1,$2,$3) RETURNING id`,
    [username, email, hash]
  );
  req.session.userId = rows[0].id;
  res.redirect("/");
});

// --- Login / Logout
app.get("/login", (req, res) => res.render("login", { title: "login" }));
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const { rows } = await pool.query(`SELECT id,password FROM users WHERE username=$1`, [username]);
  if (rows[0] && await bcrypt.compare(password, rows[0].password)) {
    req.session.userId = rows[0].id;
    return res.redirect("/");
  }
  res.render("login", { error: "Credenciais inválidas", title: "Login" });
});
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// --- Cálculo de lucro mensal (FIXED)
async function calculateMonthlyProfit(userId) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const sql = `
    WITH sale_stats AS (
      SELECT sp.sale_id,
        SUM(sp.unit_price * sp.quantity) AS gross,
        SUM(sp.unit_price * sp.quantity * (p.profit_percent / 100.0)) AS profit
      FROM sale_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN sales s ON s.id = sp.sale_id
      WHERE s.user_id = $1
      GROUP BY sp.sale_id
    )
    SELECT spm.sale_id, ss.profit, i.value, i.paid
    FROM sale_stats ss
    JOIN sale_payments spm ON spm.sale_id = ss.sale_id AND spm.user_id = $1
    JOIN installments i ON i.sale_payments_id = spm.id AND i.user_id = $1
    WHERE i.due_date >= $2 AND i.due_date < $3
  `;
  
  const { rows } = await pool.query(sql, [userId, start, end]);
  const map = new Map();
  let total = 0;
  
  for (let r of rows) {
    if (!map.has(r.sale_id)) map.set(r.sale_id, { profit: r.profit, parts: [] });
    map.get(r.sale_id).parts.push({ value: +r.value, paid: r.paid });
  }
  
  for (let { profit, parts } of map.values()) {
    const rev = parts.reduce((s, p) => s + p.value, 0);
    if (!rev) continue;
    for (let p of parts) if (p.paid) total += profit * (p.value / rev);
  }
  
  return +total.toFixed(2);
}

// --- Home
app.get("/", requireAuth, async (req, res) => {
  try {
      const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
      res.render("index", { monthlyProfit: monthlyProfit, title: "Dashboard" });
  } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).render("error", { error: "Erro ao carregar dashboard" });
  }
});

app.get("/api/dashboard-data", requireAuth, async (req, res) => {
  try {
      const userId = req.session.userId;
      
      // Get basic statistics
      const statsQuery = `
          SELECT 
              (SELECT COUNT(*) FROM clients WHERE user_id = $1) as total_clients,
              (SELECT COUNT(*) FROM products WHERE user_id = $1) as total_products,
              (SELECT COUNT(*) FROM sales WHERE user_id = $1) as total_sales,
              (SELECT COUNT(*) FROM products WHERE user_id = $1 AND stock <= 10) as low_stock_products
      `;
      
      const { rows: statsRows } = await pool.query(statsQuery, [userId]);
      const stats = statsRows[0];
      
      // Get pending installments (not paid)
      const pendingInstallmentsQuery = `
          SELECT 
              COUNT(*) as count,
              COALESCE(SUM(value), 0) as amount
          FROM installments
          WHERE user_id = $1 AND paid = false
      `;
      
      const { rows: pendingInstallmentsRows } = await pool.query(pendingInstallmentsQuery, [userId]);
      const pendingInstallments = pendingInstallmentsRows[0];
      
      // Get overdue installments (not paid and due date passed)
      const overdueInstallmentsQuery = `
          SELECT 
              COUNT(*) as count,
              COALESCE(SUM(value), 0) as amount
          FROM installments
          WHERE user_id = $1 AND paid = false AND due_date < CURRENT_DATE
      `;
      
      const { rows: overdueInstallmentsRows } = await pool.query(overdueInstallmentsQuery, [userId]);
      const overdueInstallments = overdueInstallmentsRows[0];
      
      // Get recent sales with client and product information
      const recentSalesQuery = `
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
      `;
      
      const { rows: recentSalesRows } = await pool.query(recentSalesQuery, [userId]);
      
      // Get top products by revenue
      const topProductsQuery = `
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
      `;
      
      const { rows: topProductsRows } = await pool.query(topProductsQuery, [userId]);
      
      // Format the response
      const dashboardData = {
          stats: {
              totalClients: parseInt(stats.total_clients),
              totalProducts: parseInt(stats.total_products),
              totalSales: parseInt(stats.total_sales),
              pendingInstallments: { 
                  count: parseInt(pendingInstallments.count), 
                  amount: parseFloat(pendingInstallments.amount) 
              },
              overdueInstallments: { 
                  count: parseInt(overdueInstallments.count), 
                  amount: parseFloat(overdueInstallments.amount) 
              },
              lowStockProducts: parseInt(stats.low_stock_products),
          },
          recentSales: recentSalesRows.map(sale => ({
              client: sale.client_name,
              product: sale.product_names,
              value: parseFloat(sale.total),
              date: sale.sale_date.toISOString().split('T')[0]
          })),
          topProducts: topProductsRows.map(product => ({
              name: product.name,
              brand: product.brand_name,
              sales: parseInt(product.total_sales),
              revenue: parseFloat(product.total_revenue)
          }))
      };
      
      res.json(dashboardData);
  } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
});

// ========== Clientes ==========
app.get("/clientes", requireAuth, async (req, res) => {
  try {
    const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
    
    // Get all clients with their basic info
    const clientsResult = await pool.query(`
      SELECT 
        c.id, 
        c.name, 
        c.debt, 
        c.phone,
        c.created_date
      FROM clients c
      WHERE c.user_id = $1
      ORDER BY c.name
    `, [req.session.userId]);

    // Get last purchase info for each client
    const lastPurchasesResult = await pool.query(`
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
    `, [req.session.userId]);

    // Create a map of client_id -> product_names
    const lastPurchasesMap = {};
    lastPurchasesResult.rows.forEach(row => {
      lastPurchasesMap[row.client_id] = row.product_names;
    });

    // Combine the data
    const clients = clientsResult.rows.map(client => ({
      ...client,
      product_name: lastPurchasesMap[client.id] || null
    }));

    const monthlyClientsResult = await pool.query(`
      SELECT COUNT(*) as clients_this_month
      FROM clients 
      WHERE user_id = $1 
      AND EXTRACT(MONTH FROM created_date) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM created_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  `, [req.session.userId]);
  
    const customersMonth = parseInt(monthlyClientsResult.rows[0].clients_this_month);

    res.render("clients.ejs", { 
      clients: clients, 
      monthlyProfit: monthlyProfit,
      numberOfClients: clients.length,
      clientsMonth: customersMonth
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao buscar clientes");
  }
});

app.get("/api/clientes", requireAuth, async (req, res) => {
  try {
      const { rows } = await pool.query(
          `SELECT c.*, STRING_AGG(DISTINCT p.name, ', ') as last_products
           FROM clients c
           LEFT JOIN sales s ON c.id = s.client_id AND s.user_id = $1
           LEFT JOIN sale_products sp ON s.id = sp.sale_id
           LEFT JOIN products p ON sp.product_id = p.id
           WHERE c.user_id = $1
           GROUP BY c.id
           ORDER BY c.name`,
          [req.session.userId]
      );
      res.json(rows);
  } catch (error) {
      console.error('Get clients API error:', error);
      res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

app.post("/clientes", requireAuth, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const date = new Date()
    await pool.query(
      `INSERT INTO clients(name,phone,created_date,user_id) VALUES($1,$2,$3,$4)`,
      [name, phone, date, req.session.userId]
    );
    res.redirect("/clientes");
  } catch (err) {
    console.error(err);
    res.status(400).send("Dados inválidos");
  }
});

app.post("/clientes/:id/debito", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    try {
      await pool.query(
        `UPDATE clients SET debt = debt + $1 WHERE id = $2 AND user_id = $3`,
        [parseFloat(amount), id, req.session.userId]
      );
      res.redirect("/clientes");
    } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao atualizar débito");
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
  } catch (err) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

app.put('/clientes/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, phone, debt } = req.body;

  await pool.query(
    `UPDATE clients 
     SET name = $1, phone = $2, debt = $3 
     WHERE id = $4 AND user_id = $5`,
    [name, phone, debt, id, req.session.userId]
  );

  res.sendStatus(200);
});

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
        COUNT(sp.id) as paid_installments,
        COALESCE(SUM(sp.amount), 0) as paid_amount,
        s.total - COALESCE(SUM(sp.amount), 0) as remaining_amount,
        s.installments - COUNT(sp.id) as remaining_installments,
        (s.total / s.installments) as installment_value
      FROM sales s
      LEFT JOIN sale_products spr ON s.id = spr.sale_id
      LEFT JOIN products p ON spr.product_id = p.id
      LEFT JOIN sale_payments sp ON s.id = sp.sale_id
      WHERE s.client_id = $1 AND s.user_id = $2
      GROUP BY s.id, s.sale_date, s.total, s.installments
      ORDER BY s.sale_date DESC
    `, [req.params.id, req.session.userId]);

    res.json({
      client: clientResult.rows[0],
      history: historyResult.rows
    });
  } catch (error) {
    console.error('Error fetching client history:', error);
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

app.delete("/clientes/:id", requireAuth, async (req, res) => {
  await pool.query('DELETE FROM clients WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  res.sendStatus(200);
});

// ========== PRODUTOS ========== (FIXED - removed duplicates)
// ========== PRODUTOS ==========
app.get("/produtos", requireAuth, async (req, res) => {
  try {
    const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
    
    // Clean up expired campaigns
    const campaigns = await pool.query("SELECT * FROM campaigns WHERE user_id = $1", [req.session.userId]);
    for (const row of campaigns.rows) {
      if (row.end_date < new Date()) {
        await pool.query("UPDATE products SET current_campaign_id = NULL WHERE current_campaign_id = $1 AND user_id = $2", [row.id, req.session.userId]);
        await pool.query("DELETE FROM campaigns WHERE id = $1", [row.id]);
      }
    }
    
    const [productsResult, brandsResult, categoriesResult] = await Promise.all([
      pool.query(`
        SELECT p.*, c.promo_price, c.start_date, c.end_date, b.name as brand_name
        FROM products p
        LEFT JOIN campaigns c ON p.current_campaign_id = c.id
        LEFT JOIN brands b ON p.brand = b.id
        WHERE p.user_id = $1
      `, [req.session.userId]),
      pool.query("SELECT id, name FROM brands WHERE user_id = $1 ORDER BY name", [req.session.userId]),
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

  } catch (err) {
    res.status(500).render('error', { error: err.message });
  }
});

app.get('/api/produtos', requireAuth, async (req, res) => {
  try {
    const { search, brand, category, minPrice, maxPrice, lowStock, onSale, sortBy, sortOrder } = req.query;
    
    let query = `
      WITH filtered_products AS (
        SELECT 
          p.id,
          p.name,
          p.brand,
          p.price as original_price,
          p.stock,
          p.image,
          p.category,
          p.current_campaign_id,
          p.created_date,
          c.promo_price,
          c.start_date,
          c.end_date,
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

    query += `) SELECT * FROM filtered_products`;

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

  } catch (err) {
    console.error('Erro na query:', err);
    res.status(500).json({ 
      error: 'Erro interno no servidor',
      details: err.message
    });
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
    
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/produtos', upload.single('image'), requireAuth, async (req, res) => {
  try {
    const { name, price, stock, profit_percentual, brand, category } = req.body;
   
    // Validate brand exists
    const brandResult = await pool.query(
      `SELECT id FROM brands WHERE id = $1 AND user_id = $2`, [brand, req.session.userId]
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
      [name, brand, price, stock, imagePath, profit_percentual, category || null, req.session.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/produtos/:id', upload.single('image'), requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, price, stock, currentImage, profit_percentual, category } = req.body;

    // Validate brand exists
    const brandResult = await pool.query(
      `SELECT id FROM brands WHERE id = $1 AND user_id = $2`, [brand, req.session.userId]
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
        name = $1,
        brand = $2,
        price = $3,
        stock = $4,
        image = $5,
        profit_percent = $6,
        category = $7
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [name, brand, price, stock, imagePath, profit_percentual, category || null, id, req.session.userId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/produtos/:id', requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id = $1 AND user_id = $2", [req.params.id, req.session.userId]);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ========== MARCAS ==========
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/marcas/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, COUNT(p.id) as product_count 
      FROM brands b 
      LEFT JOIN products p ON b.id = p.brand AND p.user_id = b.user_id
      WHERE b.id = $1 AND b.user_id = $2 
      GROUP BY b.id
    `, [req.params.id, req.session.userId]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Marca não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/marcas', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if brand already exists
    const existingBrand = await pool.query(
      'SELECT id FROM brands WHERE name = $1 AND user_id = $2', 
      [name, req.session.userId]
    );
    
    if (existingBrand.rows.length > 0) {
      return res.status(400).json({ error: 'Marca já existe' });
    }
    
    const { rows } = await pool.query(
      'INSERT INTO brands (name, description, user_id) VALUES ($1, $2, $3) RETURNING *', 
      [name, description || null, req.session.userId]
    );
    
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/marcas/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    // Check if brand exists and belongs to user
    const brandCheck = await pool.query(
      'SELECT id FROM brands WHERE id = $1 AND user_id = $2', 
      [id, req.session.userId]
    );
    
    if (brandCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Marca não encontrada' });
    }
    
    // Check if name already exists for another brand
    const existingBrand = await pool.query(
      'SELECT id FROM brands WHERE name = $1 AND user_id = $2 AND id != $3', 
      [name, req.session.userId, id]
    );
    
    if (existingBrand.rows.length > 0) {
      return res.status(400).json({ error: 'Já existe uma marca com este nome' });
    }
    
    const { rows } = await pool.query(
      'UPDATE brands SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *', 
      [name, description || null, id, req.session.userId]
    );
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/marcas/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    
    // Check if brand exists and belongs to user
    const brandCheck = await pool.query(
      'SELECT id FROM brands WHERE id = $1 AND user_id = $2', 
      [id, req.session.userId]
    );
    
    if (brandCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Marca não encontrada' });
    }
    
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
      // Delete products first (and their campaigns)
      await pool.query('DELETE FROM campaigns WHERE product_id IN (SELECT id FROM products WHERE brand = $1 AND user_id = $2)', [id, req.session.userId]);
      await pool.query('DELETE FROM products WHERE brand = $1 AND user_id = $2', [id, req.session.userId]);
    }
    
    // Delete brand
    await pool.query('DELETE FROM brands WHERE id = $1 AND user_id = $2', [id, req.session.userId]);
    
    res.json({ 
      message: 'Marca excluída com sucesso',
      deletedProducts: force === 'true' ? productCount : 0
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CAMPANHAS ==========
app.post('/campanhas', requireAuth, async (req, res) => {
  const { product_id, start_date, end_date, promo_price, profit_percentual } = req.body;
  try {
    const product = await pool.query('SELECT price FROM products WHERE id = $1 AND user_id = $2', [product_id, req.session.userId]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }
    
    const price = product.rows[0].price;
    
    const existingCampaign = await pool.query(
      `SELECT * FROM campaigns 
       WHERE product_id = $1 AND user_id = $2
       AND (start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE)`,
      [product_id, req.session.userId]
    );
    
    if (existingCampaign.rows.length > 0) {
      return res.status(400).json({ error: "Já existe uma campanha ativa para este produto" });
    }
    
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({ error: "Data final deve ser após a inicial" });
    } else if (promo_price >= price) {
      return res.status(400).json({ error: "Preço promocional deve ser menor que o original" });
    } else {
      const result = await pool.query(
        `INSERT INTO campaigns (product_id, start_date, end_date, promo_price, campaign_profit_percent, user_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [product_id, start_date, end_date, promo_price, profit_percentual, req.session.userId]
      );

      await pool.query(
        `UPDATE products SET current_campaign_id = $1 WHERE id = $2 AND user_id = $3`,
        [result.rows[0].id, product_id, req.session.userId]
      );

      res.redirect('/produtos');
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/campanhas', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, p.name as product_name, b.name as brand_name
      FROM campaigns c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN brands b ON p.brand = b.id
      WHERE c.end_date >= CURRENT_DATE AND c.user_id = $1
      ORDER BY c.start_date DESC
    `, [req.session.userId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ESTATÍSTICAS ==========
app.get('/api/estatisticas', requireAuth, async (req, res) => {
  try {
    const [statsResult] = await Promise.all([
      pool.query(`
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
      `, [req.session.userId])
    ]);
    
    res.json(statsResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== VENDAS ========== (FIXED debt calculation)
app.get("/vendas", requireAuth, async (req, res) => {
  try {
    const monthlyProfit = await calculateMonthlyProfit(req.session.userId);
    const [clients, products, recentSales] = await Promise.all([
      pool.query("SELECT id, name FROM clients WHERE user_id = $1", [req.session.userId]),
      pool.query(`
        SELECT 
          p.id,
          p.name,
          p.brand,
          COALESCE(c.promo_price, p.price) as price,
          p.stock,
          p.image
        FROM products p
        LEFT JOIN campaigns c ON p.current_campaign_id = c.id
        WHERE p.stock > 0 AND p.user_id = $1
      `, [req.session.userId]),
      pool.query(`
        SELECT
          s.id,
          s.total,
          s.sale_date,
          c.name AS client_name,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', spm.id,
                  'method', (SELECT method FROM payment_methods WHERE id = spm.payment_method_id),
                  'amount', spm.amount,
                  'interest', spm.interest,
                  'installments', spm.installments,
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
                      WHERE i.sale_payments_id = spm.id
                      AND i.user_id = $1
                    ),
                    '[]'::jsonb
                  ),
                  'paid', (
                    SELECT bool_and(i.paid)
                    FROM installments i
                    WHERE i.sale_payments_id = spm.id
                    AND i.user_id = $1
                  )
                )
              )
              FROM sale_payments spm
              WHERE spm.sale_id = s.id
              AND spm.user_id = $1
            ),
            '[]'::jsonb
          ) AS payment_methods,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'name', p2.name,
                  'quantity', sp.quantity
                )
              )
              FROM sale_products sp
              JOIN products p2 ON sp.product_id = p2.id
              WHERE sp.sale_id = s.id
              AND sp.user_id = $1
            ),
            '[]'::jsonb
          ) AS products
        FROM sales s
        LEFT JOIN clients c ON s.client_id = c.id AND c.user_id = $1
        WHERE s.user_id = $1
        ORDER BY s.sale_date DESC
      `, [req.session.userId])
    ]);

    res.render("sales.ejs", {
      title: "Vendas",
      clients: clients.rows,
      products: products.rows,
      recentSales: recentSales.rows,
      monthlyProfit: monthlyProfit
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar dados");
  }
});

app.get('/api/notifications', async (req, res) => {
    try {
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(401).json({ error: 'Não autorizado' });
        }

        const today = new Date();
        const oneWeekFromNow = new Date(today);
        oneWeekFromNow.setDate(today.getDate() + 7);

        // Format dates for SQL query (YYYY-MM-DD)
        const todayStr = today.toISOString().split('T')[0];
        const oneWeekStr = oneWeekFromNow.toISOString().split('T')[0];

        // Check for overdue installments
        const overdueQuery = `
            SELECT COUNT(*) as count 
            FROM installments 
            WHERE user_id = ? 
            AND due_date < ? 
            AND paid = 0
        `;

        // Check for installments due this week
        const dueThisWeekQuery = `
            SELECT COUNT(*) as count 
            FROM installments 
            WHERE user_id = ? 
            AND due_date BETWEEN ? AND ? 
            AND paid = 0
        `;

        // Check for installments due today
        const dueTodayQuery = `
            SELECT COUNT(*) as count 
            FROM installments 
            WHERE user_id = ? 
            AND due_date = ? 
            AND paid = 0
        `;

        // Execute queries
        const [overdueResult] = await db.query(overdueQuery, [userId, todayStr]);
        const [dueThisWeekResult] = await db.query(dueThisWeekQuery, [userId, todayStr, oneWeekStr]);
        const [dueTodayResult] = await db.query(dueTodayQuery, [userId, todayStr]);

        const overdueCount = overdueResult[0].count;
        const dueThisWeekCount = dueThisWeekResult[0].count;
        const dueTodayCount = dueTodayResult[0].count;

        // Determine notification message and type
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
        res.status(500).json({ error: 'Erro interno do servidor' });
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
        
    } catch (err) {
        console.error('Erro ao calcular comissões:', err);
        res.status(500).json({ error: 'Erro ao calcular comissões' });
    }
});

// ========== CUSTOMER INSIGHTS ==========
app.get('/api/insights/clientes', requireAuth, async (req, res) => {
    try {
        const { rows: topClients } = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.phone,
                c.debt,
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
                c.id as client_id,
                c.name as client_name,
                p.name as product_name,
                p.category,
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
        
    } catch (err) {
        console.error('Erro ao buscar insights de clientes:', err);
        res.status(500).json({ error: 'Erro ao buscar insights de clientes' });
    }
});

// ========== ADVANCED REPORTS ==========
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
        
        const { rows } = await pool.query(`
            SELECT 
                ${dateFormat} as period,
                COUNT(DISTINCT s.id) as total_sales,
                SUM(s.total) as total_revenue,
                AVG(s.total) as average_ticket,
                COUNT(DISTINCT s.client_id) as unique_clients,
                SUM(
                    CASE WHEN EXISTS (
                        SELECT 1 FROM installments i 
                        JOIN sale_payments sp ON i.sale_payments_id = sp.id 
                        WHERE sp.sale_id = s.id AND i.paid = false
                    ) THEN s.total ELSE 0 END
                ) as pending_amount,
                array_agg(DISTINCT pm.method) as payment_methods_used
            FROM sales s
            LEFT JOIN sale_payments sp ON s.id = sp.sale_id
            LEFT JOIN payment_methods pm ON sp.payment_method_id = pm.id
            WHERE s.user_id = $1
            ${startDate ? 'AND s.sale_date >= $2' : ''}
            ${endDate ? `AND s.sale_date <= $${startDate ? '3' : '2'}` : ''}
            GROUP BY ${dateFormat}
            ORDER BY period DESC
        `, [
            req.session.userId,
            ...(startDate ? [startDate] : []),
            ...(endDate ? [endDate] : [])
        ]);
        
        res.json(rows);
        
    } catch (err) {
        console.error('Erro ao gerar relatório detalhado:', err);
        res.status(500).json({ error: 'Erro ao gerar relatório detalhado' });
    }
});

// ========== BULK ACTIONS ==========
app.post('/api/acoes-lote/marcar-parcelas', requireAuth, async (req, res) => {
    const client = await pool.connect();
    const { installmentIds, action } = req.body; // action: 'pay' or 'unpay'
    
    try {
        await client.query('BEGIN');
        
        for (const installmentId of installmentIds) {
            if (action === 'pay') {
                // Get installment details
                const { rows } = await client.query(`
                    SELECT i.value, i.paid, s.client_id
                    FROM installments i
                    JOIN sale_payments spm ON i.sale_payments_id = spm.id
                    JOIN sales s ON spm.sale_id = s.id
                    WHERE i.id = $1 AND i.user_id = $2 AND s.user_id = $2
                `, [installmentId, req.session.userId]);
                
                if (rows.length > 0 && !rows[0].paid) {
                    // Mark as paid
                    await client.query(`
                        UPDATE installments 
                        SET paid = TRUE, paid_date = CURRENT_DATE
                        WHERE id = $1 AND user_id = $2
                    `, [installmentId, req.session.userId]);
                    
                    // Update client debt
                    await client.query(`
                        UPDATE clients 
                        SET debt = GREATEST(debt - $1, 0)
                        WHERE id = $2 AND user_id = $3
                    `, [rows[0].value, rows[0].client_id, req.session.userId]);
                }
            } else if (action === 'unpay') {
                // Get installment details
                const { rows } = await client.query(`
                    SELECT i.value, i.paid, s.client_id
                    FROM installments i
                    JOIN sale_payments spm ON i.sale_payments_id = smp.id
                    JOIN sales s ON spm.sale_id = s.id
                    WHERE i.id = $1 AND i.user_id = $2 AND s.user_id = $2
                `, [installmentId, req.session.userId]);
                
                if (rows.length > 0 && rows[0].paid) {
                    // Mark as unpaid
                    await client.query(`
                        UPDATE installments 
                        SET paid = FALSE, paid_date = NULL
                        WHERE id = $1 AND user_id = $2
                    `, [installmentId, req.session.userId]);
                    
                    // Update client debt
                    await client.query(`
                        UPDATE clients 
                        SET debt = debt + $1
                        WHERE id = $2 AND user_id = $3
                    `, [rows[0].value, rows[0].client_id, req.session.userId]);
                }
            }
        }
        
        await client.query('COMMIT');
        res.json({ message: `${installmentIds.length} parcelas processadas com sucesso` });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro em ações em lote:', err);
        res.status(500).json({ error: 'Erro ao processar ações em lote' });
    } finally {
        client.release();
    }
});

// ========== EXPORT FUNCTIONS ==========
app.get('/api/exportar/vendas', requireAuth, async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;
        
        let query = `
            SELECT 
                s.id,
                s.sale_date,
                s.total,
                c.name as client_name,
                c.phone as client_phone,
                array_agg(DISTINCT p.name) as products,
                array_agg(DISTINCT pm.method) as payment_methods,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM installments i 
                        JOIN sale_payments sp ON i.sale_payments_id = sp.id 
                        WHERE sp.sale_id = s.id AND i.paid = false
                    ) THEN 'Pendente'
                    ELSE 'Pago'
                END as payment_status
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN sale_products sp ON s.id = sp.sale_id
            LEFT JOIN products p ON sp.product_id = p.id
            LEFT JOIN sale_payments spm ON s.id = spm.sale_id
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
        
        if (format === 'csv') {
            const csvData = rows.map(row => ({
                ID: row.id,
                Data: row.sale_date,
                Total: row.total,
                Cliente: row.client_name,
                Telefone: row.client_phone,
                Produtos: row.products ? row.products.join(', ') : '',
                'Métodos de Pagamento': row.payment_methods ? row.payment_methods.join(', ') : '',
                Status: row.payment_status
            }));
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=vendas.csv');
            
            // Simple CSV conversion
            const headers = Object.keys(csvData[0] || {});
            const csvContent = [
                headers.join(','),
                ...csvData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
            ].join('\n');
            
            res.send(csvContent);
        } else {
            const { rows } = await pool.query(query, params);
            res.json(rows);
        }
        
    } catch (err) {
        console.error('Erro ao exportar dados:', err);
        res.status(500).json({ error: 'Erro ao exportar dados' });
    }
});

// ========== ADVANCED FILTERS ==========
app.get('/api/vendas/filtros', requireAuth, async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            clientId, 
            productId, 
            paymentMethod, 
            paymentStatus, 
            minAmount, 
            maxAmount 
        } = req.query;
        
        let query = `
            SELECT DISTINCT
                s.id,
                s.total,
                s.sale_date,
                c.name AS client_name,
                c.phone AS client_phone,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM installments i 
                        JOIN sale_payments sp ON i.sale_payments_id = sp.id 
                        WHERE sp.sale_id = s.id AND i.paid = false
                    ) THEN 'Pendente'
                    ELSE 'Pago'
                END as payment_status,
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'name', p2.name,
                                'quantity', sp.quantity
                            )
                        )
                        FROM sale_products sp
                        JOIN products p2 ON sp.product_id = p2.id
                        WHERE sp.sale_id = s.id
                    ),
                    '[]'::jsonb
                ) AS products,
                COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'method', pm.method,
                                'amount', spm.amount
                            )
                        )
                        FROM sale_payments spm
                        JOIN payment_methods pm ON spm.payment_method_id = pm.id
                        WHERE spm.sale_id = s.id
                    ),
                    '[]'::jsonb
                ) AS payment_methods
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN sale_products sp ON s.id = sp.sale_id
            LEFT JOIN sale_payments spm ON s.id = spm.sale_id
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
        
        if (clientId) {
            query += ` AND s.client_id = $${paramIndex}`;
            params.push(clientId);
            paramIndex++;
        }
        
        if (productId) {
            query += ` AND sp.product_id = $${paramIndex}`;
            params.push(productId);
            paramIndex++;
        }
        
        if (paymentMethod) {
            query += ` AND pm.id = $${paramIndex}`;
            params.push(paymentMethod);
            paramIndex++;
        }
        
        if (minAmount) {
            query += ` AND s.total >= $${paramIndex}`;
            params.push(minAmount);
            paramIndex++;
        }
        
        if (maxAmount) {
            query += ` AND s.total <= $${paramIndex}`;
            params.push(maxAmount);
            paramIndex++;
        }
        
        query += ` ORDER BY s.sale_date DESC`;
        
        const { rows } = await pool.query(query, params);
        
        // Filter by payment status if specified
        let filteredRows = rows;
        if (paymentStatus) {
            filteredRows = rows.filter(row => row.payment_status === paymentStatus);
        }
        
        res.json(filteredRows);
        
    } catch (err) {
        console.error('Erro ao aplicar filtros:', err);
        res.status(500).json({ error: 'Erro ao aplicar filtros' });
    }
});

app.get('/api/vendas', requireAuth, async (req, res) => {
  try {
    const { rows: sales } = await pool.query(`
        SELECT
          s.id,
          s.total,
          s.sale_date,
          c.name AS client_name,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', spm.id,
                  'method', (SELECT method FROM payment_methods WHERE id = spm.payment_method_id),
                  'amount', spm.amount,
                  'interest', spm.interest,
                  'installments', spm.installments,
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
                      WHERE i.sale_payments_id = spm.id
                      AND i.user_id = $1
                    ),
                    '[]'::jsonb
                  ),
                  'paid', (
                    SELECT bool_and(i.paid)
                    FROM installments i
                    WHERE i.sale_payments_id = spm.id
                    AND i.user_id = $1
                  )
                )
              )
              FROM sale_payments spm
              WHERE spm.sale_id = s.id
              AND spm.user_id = $1
            ),
            '[]'::jsonb
          ) AS payment_methods,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'name', p2.name,
                  'quantity', sp.quantity
                )
              )
              FROM sale_products sp
              JOIN products p2 ON sp.product_id = p2.id
              WHERE sp.sale_id = s.id
              AND sp.user_id = $1
            ),
            '[]'::jsonb
          ) AS products
        FROM sales s
        LEFT JOIN clients c ON s.client_id = c.id AND c.user_id = $1
        WHERE s.user_id = $1
        ORDER BY s.sale_date DESC
      `, [req.session.userId])
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar dados");
  }
  });


// FIXED: Improved sale creation with proper debt calculation
app.post('/api/vendas', requireAuth, async (req, res) => {
    const client = await pool.connect();
    
    try {
        console.log("--- INÍCIO DA VENDA ---");
        console.log("Dados recebidos:", req.body);
        
        const { clientId, saleDate, products, payments } = req.body;
        
        // Validate required fields
        if (!clientId || !products?.length || !payments?.length) {
            return res.status(400).json({ error: "Dados incompletos" });
        }
        
        await client.query('BEGIN');
        
        // Calculate subtotal (base price without interest)
        const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        
        // Calculate total interest and validate payments
        let totalInterest = 0;
        let totalPaid = 0;
        
        const processedPayments = payments.map(payment => {
            const { method, amount, installments = 1, interest = 0 } = payment;
            
            // Calculate interest only for credit methods
            const interestAmount = ['credito', 'pix_credito'].includes(method) 
                ? amount * (interest / 100) 
                : 0;
            
            totalInterest += interestAmount;
            totalPaid += amount;
            
            return {
                method,
                amount: parseFloat(amount),
                installments: parseInt(installments),
                interest: parseFloat(interest),
                interestAmount: parseFloat(interestAmount)
            };
        });
        
        // Validate payment amount
        if (totalPaid < subtotal) {
            throw new Error(`Valor pago (${totalPaid}) é menor que o subtotal (${subtotal})`);
        }
        
        const totalWithInterest = subtotal + totalInterest;
        
        console.log("Subtotal:", subtotal);
        console.log("Total Interest:", totalInterest);
        console.log("Total with Interest:", totalWithInterest);
        console.log("Total Paid:", totalPaid);
        
        // Insert sale record
        const saleResult = await client.query(`
            INSERT INTO sales (client_id, total, sale_date, user_id, interest, installments) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id
        `, [clientId, subtotal, new Date(saleDate), req.session.userId, totalInterest, 
            Math.max(...processedPayments.map(p => p.installments))]);
        
        const saleId = saleResult.rows[0].id;
        
        // Process products and update stock
        for (const product of products) {
            // Check if product exists and has sufficient stock
            const productStock = await client.query(
                'SELECT stock FROM products WHERE id = $1 AND user_id = $2',
                [product.productId, req.session.userId]
            );
            
            if (productStock.rows.length === 0) {
                throw new Error(`Produto com ID ${product.productId} não encontrado ou não pertence ao usuário`);
            }
            
            if (productStock.rows[0].stock < product.quantity) {
                throw new Error(`Estoque insuficiente para o produto ${product.productId}. Disponível: ${productStock.rows[0].stock}, Solicitado: ${product.quantity}`);
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
            // Insert payment record with interest and installments
            const paymentResult = await client.query(`
                INSERT INTO sale_payments (payment_method_id, sale_id, amount, interest, installments, user_id) 
                VALUES ($1, $2, $3, $4, $5, $6) 
                RETURNING id
            `, [payment.method, saleId, payment.amount, payment.interestAmount, payment.installments, req.session.userId]);
            
            if (!paymentResult.rows.length) {
                throw new Error("Erro ao inserir pagamento");
            }
            
            const paymentId = paymentResult.rows[0].id;
            
            // Create installments
            const totalPaymentAmount = payment.amount + payment.interestAmount;
            const installmentValue = totalPaymentAmount / payment.installments;
            
            for (let i = 1; i <= payment.installments; i++) {
                const dueDate = new Date(saleDate);
                dueDate.setMonth(dueDate.getMonth() + i - 1);
                
                await client.query(`
                    INSERT INTO installments (sale_payments_id, number, value, due_date, user_id) 
                    VALUES ($1, $2, $3, $4, $5)
                `, [paymentId, i, installmentValue, dueDate, req.session.userId]);
            }
        }
        
        // Update client debt (including interest)
        await client.query(
            'UPDATE clients SET debt = debt + $1 WHERE id = $2 AND user_id = $3',
            [totalWithInterest, clientId, req.session.userId]
        );
        
        await client.query('COMMIT');
        
        console.log("--- VENDA REGISTRADA COM SUCESSO ---");
        console.log("Sale ID:", saleId);
        console.log("Total with Interest:", totalWithInterest);
        
        res.status(201).json({
            message: 'Venda registrada com sucesso',
            saleId: saleId,
            subtotal: subtotal,
            totalInterest: totalInterest,
            totalWithInterest: totalWithInterest,
            totalPaid: totalPaid
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("--- ERRO NA VENDA ---", err);
        res.status(500).json({
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    } finally {
        client.release();
    }
});

// Fixed installment payment endpoint
app.patch('/api/installments/:id/pay', requireAuth, async (req, res) => {
    const client = await pool.connect();
    const installmentId = req.params.id;
    
    try {
        await client.query('BEGIN');
        
        const { rows } = await client.query(`
            SELECT 
                i.value, 
                i.paid, 
                i.sale_payments_id,
                s.client_id,
                s.id as sale_id,
                sp.interest,
                sp.installments
            FROM installments i
            JOIN sale_payments sp ON i.sale_payments_id = sp.id
            JOIN sales s ON sp.sale_id = s.id
            WHERE i.id = $1 AND i.user_id = $2 AND s.user_id = $2
        `, [installmentId, req.session.userId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada' });
        }
        
        const { value, paid, sale_payments_id, client_id, sale_id, interest, installments } = rows[0];
        
        if (paid) {
            return res.status(400).json({ error: 'Parcela já está paga' });
        }
        
        // Mark installment as paid
        await client.query(`
            UPDATE installments 
            SET paid = TRUE, paid_date = CURRENT_DATE 
            WHERE id = $1 AND user_id = $2
        `, [installmentId, req.session.userId]);
        
        // Update client debt
        await client.query(`
            UPDATE clients 
            SET debt = GREATEST(debt - $1, 0) 
            WHERE id = $2 AND user_id = $3
        `, [value, client_id, req.session.userId]);
        
        await client.query('COMMIT');
        
        res.json({
            message: 'Parcela paga com sucesso',
            installmentId,
            value,
            clientId: client_id,
            saleId: sale_id,
            interest,
            installments
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao marcar parcela como paga:', err);
        res.status(500).json({ error: 'Falha ao atualizar parcela' });
    } finally {
        client.release();
    }
});

// Get installments for a specific sale
app.get('/api/vendas/:id/installments', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                i.id,
                i.number,
                i.value,
                i.due_date,
                i.paid,
                i.paid_date,
                pm.method as payment_method,
                spm.amount as payment_amount,
                spm.interest,
                spm.installments as total_installments
            FROM installments i
            JOIN sale_payments spm ON i.sale_payments_id = spm.id
            JOIN payment_methods pm ON smp.payment_method_id = pm.id
            JOIN sales s ON spm.sale_id = s.id
            WHERE s.id = $1 AND s.user_id = $2 AND i.user_id = $2
            ORDER BY i.number
        `, [req.params.id, req.session.userId]);
        
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar parcelas:', err);
        res.status(500).json({ error: 'Erro ao buscar parcelas' });
    }
});

// Get overdue installments
app.get('/api/installments/overdue', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                i.id,
                i.number,
                i.value,
                i.due_date,
                c.name as client_name,
                c.phone as client_phone,
                s.id as sale_id,
                s.sale_date,
                pm.method as payment_method,
                CURRENT_DATE - i.due_date as days_overdue
            FROM installments i
            JOIN sale_payments spm ON i.sale_payments_id = spm.id
            JOIN payment_methods pm ON spm.payment_method_id = pm.id
            JOIN sales s ON spm.sale_id = s.id
            JOIN clients c ON s.client_id = c.id
            WHERE i.due_date < CURRENT_DATE 
                AND i.paid = FALSE
                AND i.user_id = $1
                AND s.user_id = $1
                AND c.user_id = $1
            ORDER BY i.due_date ASC
        `, [req.session.userId]);
        
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar parcelas em atraso:', err);
        res.status(500).json({ error: 'Erro ao buscar parcelas em atraso' });
    }
});

// ========== PAYMENT METHODS ==========

app.get('/api/payment-methods', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM payment_methods ORDER BY method');
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar métodos de pagamento:', err);
        res.status(500).json({ error: 'Erro ao buscar métodos de pagamento' });
    }
});

// ========== REPORTS ==========

app.get('/api/relatorios/vendas-periodo', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Datas de início e fim são obrigatórias' });
        }

        const { rows } = await pool.query(`
            SELECT 
                DATE(s.sale_date) as date,
                COUNT(*) as total_sales,
                SUM(s.total) as total_revenue,
                AVG(s.total) as average_sale
            FROM sales s
            WHERE s.sale_date BETWEEN $1 AND $2
                AND s.user_id = $3
            GROUP BY DATE(s.sale_date)
            ORDER BY date DESC
        `, [startDate, endDate, req.session.userId]);

        res.json(rows);
    } catch (err) {
        console.error('Erro ao gerar relatório de vendas:', err);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

app.delete('/api/vendas/:id', requireAuth, async (req, res) => {
    const client = await pool.connect();
    const saleId = req.params.id;
    
    try {
        await client.query('BEGIN');
        
        // First, get sale details to restore client debt and product stock
        const saleResult = await client.query(`
            SELECT s.client_id, s.total, s.user_id
            FROM sales s
            WHERE s.id = $1 AND s.user_id = $2
        `, [saleId, req.session.userId]);
        
        if (saleResult.rows.length === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        const { client_id, total, user_id } = saleResult.rows[0];
        
        // Get all installments for this sale to calculate total debt to subtract
        const installmentsResult = await client.query(`
            SELECT i.value, i.paid
            FROM installments i
            JOIN sale_payments spm ON i.sale_payments_id = spm.id
            JOIN sales s ON spm.sale_id = s.id
            WHERE s.id = $1 AND s.user_id = $2
        `, [saleId, req.session.userId]);
        
        // Calculate total debt to subtract (only unpaid installments)
        const unpaidDebt = installmentsResult.rows
            .filter(row => !row.paid)
            .reduce((sum, row) => sum + parseFloat(row.value), 0);
        
        // Get products to restore stock
        const productsResult = await client.query(`
            SELECT sp.product_id, sp.quantity
            FROM sale_products sp
            WHERE sp.sale_id = $1 AND sp.user_id = $2
        `, [saleId, req.session.userId]);
        
        // Restore product stock
        for (const product of productsResult.rows) {
            await client.query(
                'UPDATE products SET stock = stock + $1 WHERE id = $2 AND user_id = $3',
                [product.quantity, product.product_id, req.session.userId]
            );
        }
        
        // Delete installments first (foreign key constraint)
        await client.query(`
            DELETE FROM installments
            WHERE sale_payments_id IN (
                SELECT id FROM sale_payments WHERE sale_id = $1 AND user_id = $2
            ) AND user_id = $2
        `, [saleId, req.session.userId]);
        
        // Delete sale payments
        await client.query(`
            DELETE FROM sale_payments
            WHERE sale_id = $1 AND user_id = $2
        `, [saleId, req.session.userId]);
        
        // Delete sale products
        await client.query(`
            DELETE FROM sale_products
            WHERE sale_id = $1 AND user_id = $2
        `, [saleId, req.session.userId]);
        
        // Delete the sale
        await client.query(`
            DELETE FROM sales
            WHERE id = $1 AND user_id = $2
        `, [saleId, req.session.userId]);
        
        // Update client debt (subtract only unpaid installments)
        if (unpaidDebt > 0) {
            await client.query(`
                UPDATE clients 
                SET debt = GREATEST(debt - $1, 0)
                WHERE id = $2 AND user_id = $3
            `, [unpaidDebt, client_id, req.session.userId]);
        }
        
        await client.query('COMMIT');
        
        res.json({ 
            message: 'Sale deleted successfully',
            saleId: saleId,
            restoredStock: productsResult.rows.length,
            debtReduction: unpaidDebt
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting sale:', err);
        res.status(500).json({ 
            error: 'Failed to delete sale',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        client.release();
    }
});

app.get('/api/relatorios/produtos-mais-vendidos', requireAuth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const { rows } = await pool.query(`
            SELECT 
                p.id,
                p.name,
                p.price,
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
    } catch (err) {
        console.error('Erro ao buscar produtos mais vendidos:', err);
        res.status(500).json({ error: 'Erro ao buscar produtos mais vendidos' });
    }
});

app.get('/api/relatorios/clientes-devedores', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.phone,
                c.debt,
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
    } catch (err) {
        console.error('Erro ao buscar clientes devedores:', err);
        res.status(500).json({ error: 'Erro ao buscar clientes devedores' });
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
    } catch (err) {
        console.error('Erro ao calcular lucro mensal:', err);
        res.status(500).json({ error: 'Erro ao calcular lucro mensal' });
    }
});

// ========== DASHBOARD ==========

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
            pool.query(`
                SELECT COUNT(*) as count 
                FROM products 
                WHERE stock <= 10 AND user_id = $1
            `, [req.session.userId]),
            pool.query(`
                SELECT COUNT(*) as count, SUM(value) as total_amount 
                FROM installments i
                JOIN sale_payments spm ON i.sale_payments_id = spm.id
                JOIN sales s ON spm.sale_id = s.id
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
    } catch (err) {
        console.error('Erro ao buscar estatísticas do dashboard:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

app.get('/api/sales/recent', requireAuth, async (req, res) => {
    try {
        const { limit = 5 } = req.query;
        
        const { rows } = await pool.query(`
            SELECT 
                s.id,
                s.total,
                s.sale_date,
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
    } catch (err) {
        console.error('Erro ao buscar vendas recentes:', err);
        res.status(500).json({ error: 'Erro ao buscar vendas recentes' });
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
    } catch (err) {
        console.error('Erro ao gerar backup:', err);
        res.status(500).json({ error: 'Erro ao gerar backup' });
    }
});

// ========== ERROR HANDLING ==========

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    
    if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Dados duplicados' });
    }
    
    if (err.code === '23503') { // Foreign key constraint violation
        return res.status(400).json({ error: 'Referência inválida' });
    }
    
    if (err.code === '23502') { // Not null constraint violation
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
    }
    
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
    });
});

// ========== SERVER STARTUP ==========

app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`📱 Acesse: http://localhost:${port}`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
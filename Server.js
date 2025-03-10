import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pool from "./database.js";
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use('/images', express.static('public/images'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json())

app.use((err, req, res, next) => {
console.error(err.stack);
    res.status(500).render('error.ejs', {
        message: "Ocorreu um erro inesperado",
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                brand VARCHAR(100) NOT NULL,
                price NUMERIC(10,2) NOT NULL,
                stock INTEGER NOT NULL,
                image VARCHAR(255),
                current_campaign_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS campaigns (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                promo_price NUMERIC(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                debt NUMERIC(10,2) DEFAULT 0,
                last_purchase DATE,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id),
                total NUMERIC(10,2) NOT NULL,
                sale_date TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS payment_methods (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                method VARCHAR(50) NOT NULL,
                amount NUMERIC(10,2) NOT NULL,
                interest NUMERIC(5,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sale_products (
                id SERIAL PRIMARY KEY,
                sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id),
                quantity INTEGER NOT NULL,
                unit_price NUMERIC(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS installments (
                id SERIAL PRIMARY KEY,
                payment_method_id INTEGER REFERENCES payment_methods(id),
                number INTEGER NOT NULL,
                value NUMERIC(10,2) NOT NULL,
                due_date DATE NOT NULL,
                paid BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS brands (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Tabelas criadas com sucesso');
    } catch (err) {
        console.error('❌ Erro ao criar tabelas:', err);
    }
};

createTables();

// Configuração do armazenamento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/images/products');
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    }
  });
  
  // Filtro para aceitar apenas imagens
  const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  };
  
  const upload = multer({ 
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  });
  
  // Criar pasta de imagens se não existir
  import fs from 'fs';
  if (!fs.existsSync('public/images/products')) {
    fs.mkdirSync('public/images/products', { recursive: true });
}

app.get("/relatorios/produtos-mais-vendidos", async (req, res) => {
    const { rows } = await pool.query(`
        SELECT p.name, SUM(sp.quantity) as total_vendido
        FROM sale_products sp
        JOIN products p ON sp.product_id = p.id
        GROUP BY p.name
        ORDER BY total_vendido DESC
        LIMIT 10
    `);
    res.json(rows);
});

let users = [
    ["saul", "123"]
]

app.get("/", async (req, res) => {
    res.render("index.ejs", { title: "Home" });
})

app.get("/login", async (req, res) => {
    res.render("login.ejs", { title: "Login" });
})

app.post("/login", async (req, res) => {
    const username = req.body["username"];
    const password = req.body["password"];

    if (users[0][0] === username && users[0][1] === password) {
        res.render("index.ejs", { title: "Home" });
    }

});

// ========== Clientes ==========

// Obter todos os clientes (com filtro de débitos)
app.get("/clientes", async (req, res) => {
    try {
        const { rows } = await pool.query(`
        SELECT id, name, phone, debt, 
                TO_CHAR(last_purchase, 'DD/MM/YYYY') as last_purchase 
        FROM clients
        WHERE debt ${req.query.debt === 'true' ? '> 0' : '>= 0'}
        `);
        res.render("clients.ejs", { clients: rows, title: "Clientes" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao buscar clientes");
    }
});

// Adicionar novo cliente
app.post("/clientes", async (req, res) => {
    const { name, phone } = req.body;
    try {
        await pool.query(
        "INSERT INTO clients (name, phone) VALUES ($1, $2)",
        [name, phone]
        );
        res.redirect("/clientes");
    } catch (err) {
        console.error(err);
        res.status(400).send("Dados inválidos");
    }
});

// Atualizar débito de cliente
app.post("/clientes/:id/debito", async (req, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    try {
      await pool.query(
        "UPDATE clients SET debt = debt + $1 WHERE id = $2",
        [parseFloat(amount), id]
      );
      res.redirect("/clientes");
    } catch (err) {
      console.error(err);
      res.status(500).send("Erro ao atualizar débito");
    }
  });

app.get('/clientes/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
        'SELECT * FROM clients WHERE id = $1', 
        [req.params.id]
        );
        
        if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado" });
        }
        
        res.json(rows[0]); // Retorna JSON
        
    } catch (err) {
        res.status(500).json({ error: "Erro no servidor" });
    }
});

  // Editar Cliente
app.put('/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, debt } = req.body;

    await pool.query(
        `UPDATE clients 
        SET name = $1, phone = $2, debt = $3 
        WHERE id = $4`,
        [name, phone, debt, id]
    );

    res.sendStatus(200);
});

// Histórico de Compras
app.get('/clientes/:id/historico', async (req, res) => {
    const { rows } = await pool.query(`
        SELECT s.sale_date, s.total, 
                ARRAY_AGG(p.name) as products
        FROM sales s
        JOIN sale_products sp ON s.id = sp.sale_id
        JOIN products p ON sp.product_id = p.id
        WHERE s.client_id = $1
        GROUP BY s.id
    `, [req.params.id]);

    res.json(rows);
});

// Excluir Cliente
app.delete('/clientes/:id', async (req, res) => {
    await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
    res.sendStatus(200);
});

// ========== PRODUTOS ==========

app.get("/produtos", async (req, res) => {
    try {
        const [productsResult, brandsResult] = await Promise.all([
            pool.query(`
                SELECT p.*, c.promo_price, c.start_date, c.end_date
                FROM products p
                LEFT JOIN campaigns c ON p.current_campaign_id = c.id
            `),
            pool.query("SELECT id, name FROM brands") // Busca as marcas
        ]);

        res.render("products.ejs", {
            title: "Produtos",
            products: productsResult.rows,
            brands: brandsResult.rows // Envia as marcas para o template
        });

    } catch (err) {
        res.status(500).render('error', { error: err.message });
    }
});

app.get('/api/produtos', async (req, res) => {
    try {
        const { search, brand, minPrice, maxPrice } = req.query;
        
        // Query base com CTE para melhor organização
        let query = `
            WITH filtered_products AS (
                SELECT 
                    p.id,
                    p.name,
                    p.brand,
                    p.price as original_price,
                    p.stock,
                    p.image,
                    p.current_campaign_id,
                    c.promo_price,
                    c.start_date,
                    c.end_date,
                    b.name as brand_name
                FROM products p
                LEFT JOIN brands b ON p.brand = b.id
                LEFT JOIN campaigns c ON p.current_campaign_id = c.id
                WHERE p.stock > 0
        `;

        const params = [];
        let paramIndex = 1;

        // Filtro de busca
        if (search) {
            query += ` AND p.name ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Filtro de marca
        if (brand && brand !== 'all') {
            query += ` AND p.brand = $${paramIndex}`;
            params.push(parseInt(brand));
            paramIndex++;
        }

        // Filtro de preço
        if (minPrice || maxPrice) {
            query += ` AND COALESCE(c.promo_price, p.price) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(minPrice ? parseFloat(minPrice) : 0);
            params.push(maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER);
            paramIndex += 2;
        }

        query += `) SELECT * FROM filtered_products ORDER BY name`;

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

app.get('/api/produtos/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

app.post('/api/produtos', upload.single('image'), async (req, res) => {
    try {
        const { name, brand, price, stock } = req.body;
        const imagePath = req.file ? 
            `/images/products/${req.file.filename}` : 
            '/images/default-product.jpg';

        const result = await pool.query(
            `INSERT INTO products (name, brand, price, stock, image)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, brand, price, stock, imagePath]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Editar produto
app.put('/api/produtos/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, brand, price, stock, currentImage } = req.body;
        
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
                image = $5
             WHERE id = $6
             RETURNING *`,
            [name, brand, price, stock, imagePath, id]
        );
        
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/produtos/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/marcas', async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM brands ORDER BY name");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/marcas', async (req, res) => {
    const { name } = req.body;
    const { rows } = await pool.query('INSERT INTO brands (name) VALUES ($1) RETURNING *', [name]);
    res.json(rows[0]);
});

app.delete('/api/marcas/:id', async (req, res) => {
    await pool.query('DELETE FROM brands WHERE id = $1', [req.params.id]);
    res.sendStatus(204);
});

// ========== CAMPANHAS ==========
// Criar campanha promocional
app.post('/campanhas', async (req, res) => {
    const { product_id, start_date, end_date, promo_price } = req.body;
    try {
        const product = await pool.query('SELECT price FROM products WHERE id = $1', [product_id]);
        const price = product.rows[0].price;
        // Verificar se já existe campanha ativa
        const existingCampaign = await pool.query(
        `SELECT * FROM campaigns 
            WHERE product_id = $1 
            AND (start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE)`,
        [product_id]
        );
        
        if (existingCampaign.rows.length > 0) {
        return res.status(400).json({ error: "Já existe uma campanha ativa para este produto" });
        }
        
        // No backend antes de inserir
        if (new Date(start_date) >= new Date(end_date)) {
            return res.status(400).json({ error: "Data final deve ser após a inicial" });
        } else if (promo_price >= price) {
            return res.status(400).json({ error: "Preço promocional deve ser menor que o original" });
        } else {
            const result = await pool.query(
                `INSERT INTO campaigns (product_id, start_date, end_date, promo_price)
                    VALUES ($1, $2, $3, $4) RETURNING *`,
                [product_id, start_date, end_date, promo_price]
            );
    
            // Atualizar produto com a campanha
            await pool.query(
            `UPDATE products SET current_campaign_id = $1 WHERE id = $2`,
            [result.rows[0].id, product_id]
            );
    
            res.redirect('/produtos');
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/campanhas', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT c.*, p.name as product_name 
            FROM campaigns c
            JOIN products p ON c.product_id = p.id
            WHERE end_date >= CURRENT_DATE
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== VENDAS ==========

  // Histórico de vendas
  app.get("/vendas", async (req, res) => {
    try {
        const [clients, products, recentSales] = await Promise.all([
            pool.query("SELECT id, name FROM clients"),
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
                WHERE p.stock > 0
            `),
            pool.query(`
                SELECT 
                    s.id,
                    s.total,
                    s.sale_date,
                    c.name as client_name,
                    COALESCE(
                        (SELECT jsonb_agg(jsonb_build_object(
                            'method', pm.method, 
                            'amount', pm.amount
                        )) 
                        FROM payment_methods pm
                        WHERE pm.sale_id = s.id),
                        '[]'::jsonb
                    ) as payment_methods,
                    COALESCE(
                        (SELECT jsonb_agg(jsonb_build_object(
                            'name', p.name,
                            'quantity', sp.quantity
                        ))
                        FROM sale_products sp
                        JOIN products p ON sp.product_id = p.id
                        WHERE sp.sale_id = s.id),
                        '[]'::jsonb
                    ) as products
                FROM sales s
                LEFT JOIN clients c ON s.client_id = c.id
                ORDER BY s.sale_date DESC
                LIMIT 10
            `)
        ]);

        res.render("sales.ejs", {
            title: "Vendas",
            clients: clients.rows,
            products: products.rows,
            recentSales: recentSales.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar dados");
    }
});

app.get('/api/vendas', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                s.id,
                s.total,
                s.sale_date,
                c.name as client_name,
                jsonb_agg(
                    jsonb_build_object(
                        'method', pm.method,
                        'amount', pm.amount,
                        'interest', pm.interest
                    )
                ) as payment_methods,
                jsonb_agg(
                    jsonb_build_object(
                        'product_id', sp.product_id,
                        'quantity', sp.quantity,
                        'price', sp.unit_price
                    )
                ) as products
            FROM sales s
            LEFT JOIN clients c ON s.client_id = c.id
            LEFT JOIN payment_methods pm ON s.id = pm.sale_id
            LEFT JOIN sale_products sp ON s.id = sp.sale_id
            GROUP BY s.id, c.name
            ORDER BY s.sale_date DESC
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vendas', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("--- INÍCIO DA VENDA ---");
        console.log("Dados recebidos:", req.body);

        const { clientId, saleDate, products, payments } = req.body;

        if (!clientId || !products?.length || !payments?.length) {
            return res.status(400).json({ error: "Dados incompletos" });
        }

        await client.query('BEGIN');

        // Cálculo do total
        const subtotal = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
        const interest = payments.reduce((sum, p) => {
            if (['credito', 'pix_credito'].includes(p.method)) {
                return sum + (p.amount * (p.interest / 100));
            }
            return sum;
        }, 0);
        const total = subtotal + interest;

        // Inserir venda
        const saleResult = await client.query(
            `INSERT INTO sales (client_id, total, sale_date)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [clientId, total, new Date(saleDate)]
        );
        const saleId = saleResult.rows[0].id;

        // Inserir produtos
        for (const product of products) {
            const productStock = await client.query(
                'SELECT stock FROM products WHERE id = $1',
                [product.productId]
            );
            if (productStock.rows[0].stock < product.quantity) {
                throw new Error(`Estoque insuficiente para o produto ${product.productId}`);
            }
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [product.quantity, product.productId]
            );
            await client.query(
                `INSERT INTO sale_products (sale_id, product_id, quantity, unit_price)
                 VALUES ($1, $2, $3, $4)`,
                [saleId, product.productId, product.quantity, product.price]
            );
        }

        // Inserir métodos de pagamento
        for (const payment of payments) {
            // Garante que installments seja pelo menos 1
            const installments = payment.installments && payment.installments > 0 ? payment.installments : 1;
            const paymentResult = await client.query(
                `INSERT INTO payment_methods (sale_id, method, amount, interest, installments)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [saleId, payment.method, payment.amount, payment.interest, installments]
            );
            if (!paymentResult.rows.length) {
                throw new Error("Erro ao inserir pagamento");
            }
            const paymentMethodId = paymentResult.rows[0].id;
            const installmentValue = (payment.amount + payment.interest) / installments;
            for (let i = 1; i <= installments; i++) {
                const dueDate = new Date(saleDate);
                dueDate.setMonth(dueDate.getMonth() + i);
                await client.query(
                    `INSERT INTO installments (payment_method_id, number, value, due_date)
                     VALUES ($1, $2, $3, $4)`,
                    [paymentMethodId, i, installmentValue, dueDate]
                );
            }
        }

        await client.query('COMMIT');
        console.log("--- VENDA REGISTRADA COM SUCESSO ---");
        res.status(201).json({ message: 'Venda registrada com sucesso' });
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

app.put('/api/vendas/:id', async (req, res) => {
    // Implementação similar ao POST com tratamento de atualização
});

app.delete('/api/vendas/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const saleId = req.params.id;
        
        await client.query('BEGIN');

        // Restaurar estoque
        const products = await client.query(
            'SELECT product_id, quantity FROM sale_products WHERE sale_id = $1',
            [saleId]
        );
        
        for (const product of products.rows) {
            await client.query(
                'UPDATE products SET stock = stock + $1 WHERE id = $2',
                [product.quantity, product.product_id]
            );
        }

        // Excluir registros relacionados
        await client.query('DELETE FROM payment_methods WHERE sale_id = $1', [saleId]);
        await client.query('DELETE FROM sale_products WHERE sale_id = $1', [saleId]);
        await client.query('DELETE FROM sales WHERE id = $1', [saleId]);

        await client.query('COMMIT');
        res.sendStatus(204);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ========== Rotas Adicionais ==========
app.get('/api/vendas/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                s.*,
                jsonb_agg(pm) as payments,
                jsonb_agg(sp) as products
            FROM sales s
            LEFT JOIN payment_methods pm ON s.id = pm.sale_id
            LEFT JOIN sale_products sp ON s.id = sp.sale_id
            WHERE s.id = $1
            GROUP BY s.id
        `, [req.params.id]);
        
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vendas/aplicar-campanha', async (req, res) => {
    try {
        const { saleId, campaignId } = req.body;
        
        const campaign = await pool.query(
            'SELECT * FROM campaigns WHERE id = $1',
            [campaignId]
        );
        
        if (campaign.rows.length === 0) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        await pool.query(
            `UPDATE sale_products 
             SET unit_price = $1, campaign_id = $2
             WHERE sale_id = $3 AND product_id = $4`,
            [campaign.rows[0].promo_price, 
             campaignId,
             saleId,
             campaign.rows[0].product_id]
        );

        res.json({ message: 'Campanha aplicada com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
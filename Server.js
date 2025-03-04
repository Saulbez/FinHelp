import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pool from "./database.js";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json())

app.use((err, req, res, next) => {
console.error(err.stack);
    res.status(500).render('error.ejs', {
        message: "Ocorreu um erro inesperado",
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

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
    const { rows } = await pool.query("SELECT * FROM products");
    res.render("products.ejs", { 
    title: "Produtos",
    products: rows 
    });
} catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar produtos");
}
});

app.post('/produtos', async (req, res) => {
    const { name, brand, price, stock } = req.body;
    try {
        const result = await pool.query(
        `INSERT INTO products (name, brand, price, stock)
            VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, brand, price, stock]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Editar produto
app.put('/produtos/:id', async (req, res) => {
    const { name, brand, price, stock } = req.body;
    try {
        const result = await pool.query(
        `UPDATE products 
            SET name = $1, brand = $2, price = $3, stock = $4 
            WHERE id = $5 RETURNING *`,
        [name, brand, price, stock, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== CAMPANHAS ==========
// Criar campanha promocional
app.post('/campanhas', async (req, res) => {
    const { product_id, start_date, end_date, promo_price } = req.body;
    try {
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
    
            res.status(201).json(result.rows[0]);
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== VENDAS ==========

// Registrar venda (atualizada para considerar campanhas)
app.post('/vendas', async (req, res) => {
    const { product_id, quantity } = req.body;
    try {
        // Verificar preço atual
        const product = await pool.query(`
        SELECT p.*, c.promo_price 
        FROM products p
        LEFT JOIN campaigns c 
            ON p.current_campaign_id = c.id
            AND CURRENT_DATE BETWEEN c.start_date AND c.end_date
        WHERE p.id = $1
        `, [product_id]);

        const currentPrice = product.rows[0].promo_price || product.rows[0].price;
        
        // Registrar venda
        const sale = await pool.query(
        `INSERT INTO sales (product_id, quantity, unit_price, total_price)
            VALUES ($1, $2, $3, $4) RETURNING *`,
        [product_id, quantity, currentPrice, quantity * currentPrice]
        );

        res.status(201).json(sale.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

  // Histórico de vendas
app.get("/vendas", async (req, res) => {
    try {
        const clients = await pool.query("SELECT id, name FROM clients");
        const products = await pool.query("SELECT id, name, price FROM products");
        
        res.render("sales.ejs", { 
        title: "Vendas",
        clients: clients.rows,
        products: products.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao carregar dados");
    }
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
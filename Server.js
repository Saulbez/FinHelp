import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

let users = [
    ["saul", "123"]
]

app.get("/", async (req, res) => {
    res.render("index.ejs", { title: "Home" });
})

app.get("/clientes", async (req, res) => {
    res.render("clients.ejs", { title: "Clientes" });
})

app.get("/produtos", async (req, res) => {
    res.render("products.ejs", { title: "Produtos" });
})

app.get("/login", async (req, res) => {
    res.render("login.ejs", { title: "Login" });
})

app.get("/vendas", async (req, res) => {
    res.render("sales.ejs", { title: "Vendas" });
})

app.post("/login", async (req, res) => {
    const username = req.body["username"];
    const password = req.body["password"];

    if (users[0][0] === username && users[0][1] === password) {
        res.render("index.ejs", { title: "Home" });
    }

});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    res.render("index.ejs", { title: "Home" });
})

app.get("/clientes", async (req, res) => {
    res.render("clients.ejs", { title: "Home" });
})

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
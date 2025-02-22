const hamburguerMenu = document.querySelector("div.hamburguer");
const navBar = document.querySelector("nav");

hamburguerMenu.addEventListener("click", function(){
    navBar.classList.toggle("active");
})
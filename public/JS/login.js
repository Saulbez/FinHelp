const container = document.querySelector('.container');
const registration = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registration.addEventListener("click", () => {
    container.classList.add('active');
})

loginBtn.addEventListener("click", () => {
    container.classList.remove('active');
})
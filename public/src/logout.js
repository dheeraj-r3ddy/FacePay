//reseting the browser storage value
let proceedFromHomeButtonOnly = false;
sessionStorage.setItem('proceedFromHomeButtonOnly', proceedFromHomeButtonOnly);

let faceVerified = false;
sessionStorage.setItem('faceVerified', faceVerified);

let payFromFacePageOnly = false;
sessionStorage.setItem('payFromFacePageOnly', payFromFacePageOnly);

//-----------------------------------------The References--------------------------------------------//
const signup = document.getElementById('signup');
const login = document.getElementById('login');
const profile = document.getElementById('profile');
const homeButton = document.getElementById('home-next-btn');
let currentUser = null;

//-----------------------------------------Functions--------------------------------------------//
function getUserName() {
    let keepLoggedIn = localStorage.getItem("keepLoggedIn");
    
    if (keepLoggedIn == "yes") {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } else {
        currentUser = JSON.parse(sessionStorage.getItem('user'));
    }
}

const redirectToLogin = () => {
    window.location.href = "./src/login.html";
}

const logout = () => {
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
    localStorage.removeItem('keepLoggedIn');
    window.location.replace("../index.html");
}

const balanceBtn = document.getElementById('balanceBtn');
const showMyQrBtn = document.getElementById('showMyQrBtn');
const viewTxnsBtn = document.getElementById('viewTxnsBtn');

//-----------------------------------------WINDOWS LOADS--------------------------------------------//
window.onload = function () {
    getUserName();
    // null is when user is not logged in
    if (currentUser == null) {
        if (profile) profile.classList.replace("profile-class", "hide");
        if (balanceBtn) balanceBtn.classList.replace("unhide", "hide");
        if (showMyQrBtn) showMyQrBtn.classList.replace("unhide", "hide");
        if (viewTxnsBtn) viewTxnsBtn.classList.replace("unhide", "hide");
        //redirecting next home button to login
        if (homeButton) homeButton.addEventListener('click', redirectToLogin);
    } else {
        if (signup) signup.classList.replace("signup-class", "hide");
        if (profile) profile.classList.replace("hide", "profile-class");
        if (balanceBtn) balanceBtn.classList.replace("hide", "unhide");
        if (showMyQrBtn) showMyQrBtn.classList.replace("hide", "unhide");
        if (viewTxnsBtn) viewTxnsBtn.classList.replace("hide", "unhide");
        if (login) {
            login.innerText = "Log Out";
            login.addEventListener('click', logout);
        }
    }
}

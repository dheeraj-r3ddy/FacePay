//In this js file, swal is a keyword in sweetalert.js used instead of alert keyword.

//reseting the browser storage value
let proceedFromHomeButtonOnly = false;
sessionStorage.setItem('proceedFromHomeButtonOnly', proceedFromHomeButtonOnly);

let faceVerified = false;
sessionStorage.setItem('faceVerified', faceVerified);

let payFromFacePageOnly = false;
sessionStorage.setItem('payFromFacePageOnly', payFromFacePageOnly);

// if already logged in avoid login again
let currentUser = null;
let keepLoggedIn = localStorage.getItem("keepLoggedIn"); 
function getUserName() {
    if (keepLoggedIn == "yes") {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } else {
        currentUser = JSON.parse(sessionStorage.getItem('user'));
    }
}
getUserName();
if (currentUser) {
    swal("Already Logged In!", "Log Out first to continue.", "warning").then(function() {
        window.location.replace('../index.html');
    });
}


//-----------------------------------------Firebase--------------------------------------------//
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyAt7cQPn2FBBMPIvU1X59pOLuznEI_BQgM",
    authDomain: "facepay-2c2a2.firebaseapp.com",
    databaseURL: "https://facepay-2c2a2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facepay-2c2a2",
    storageBucket: "facepay-2c2a2.firebasestorage.app",
    messagingSenderId: "485307834167",
    appId: "1:485307834167:web:dab077b1936d73c2bec4b2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import { getDatabase, ref, get, child, set } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-database.js";

const db = getDatabase();

//-----------------------------------------The References--------------------------------------------//

const email = document.getElementById('emailInp');
const pass = document.getElementById('passInp');
const submit = document.getElementById('submitBtn');

//-----------------------------------------VALIDATION-----------------------------------------------//
function isEmptyOrSpaces(str) {
    return str == null || str.match(/^ *$/) != null;
}

function Validation() {
    // let emailregex = /^[a-zA-Z0-9]+@(gmail|yahoo|outlook)\.com$/;
    let emailregex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    
    if (isEmptyOrSpaces(email.value) || isEmptyOrSpaces(pass.value)) {
        swal("", "You cannot leave any field empty!", "warning");
        return false;
    }

    if (!emailregex.test(email.value)) {
        swal("", "Enter a valid email!", "warning");
        return false;
    }

    return true; 
}

//---------------------------------------AUTHENTICATION PROCESS--------------------------------------//
async function AuthenticateUser() {
    if (!Validation()) return;

    let emailVal = email.value.trim();
    let emailKey = emailVal.toLowerCase().replaceAll('.', '').replaceAll('#', '').replaceAll('$', '').replaceAll('[', '').replaceAll(']', '');

    try {
        let user = null;

        // Try local backend API first
        try {
            const res = await fetch('/api/users/' + encodeURIComponent(emailVal));
            if (res.ok) {
                const data = await res.json();
                if (data && data.exists && data.user) {
                    user = data.user;
                }
            }
        } catch (apiErr) {
            console.log("API fetch failed, checking localStorage fallback:", apiErr);
        }

        // Fallback to localStorage
        if (!user) {
            const localUsers = JSON.parse(localStorage.getItem('facepay_users') || '{}');
            if (localUsers[emailKey]) {
                user = localUsers[emailKey];
            }
        }

        // Fallback to Firebase
        if (!user && db) {
            try {
                const snapshot = await get(child(ref(db), "UsersList/" + emailKey));
                if (snapshot.exists()) {
                    user = snapshot.val();
                }
            } catch (fbErr) {
                console.log("Firebase query error:", fbErr);
            }
        }

        if (user) {
            let dbpassword = decPass(user.password);
            if (dbpassword == pass.value) {
                login(user);
            } else {
                swal("", "Email or Password is invalid!", "warning");
            }
        } else {
            swal("User does not exist!", "To get started, please create an account!", "warning");
        }
    } catch (error) {
        console.error("Authentication error:", error);
        swal("Error", "Authentication encountered an error. Please try again.", "error");
    }
}   

//-------------------------------------------DECRYPT Process--------------------------------------------//
function decPass (dbpassword) {
    let pass12 = CryptoJS.AES.decrypt(dbpassword, pass.value); 
    return pass12.toString(CryptoJS.enc.Utf8);
} 

//------------------------------------------LOGIN------------------------------------------------------//
function login(user) {
    let keepLoggedIn = document.getElementById('customSwitch1').checked;
    
    if (!keepLoggedIn) {
        sessionStorage.setItem('user', JSON.stringify(user));
        window.location.replace("../index.html");
    } else {
        localStorage.setItem('keepLoggedIn','yes');
        localStorage.setItem('user', JSON.stringify(user));
        window.location.replace("../index.html");
    }
}

//------------------------------------ASSIGN THE EVENTS-----------------------------------------//
submit.addEventListener('click', AuthenticateUser);
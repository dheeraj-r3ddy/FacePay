//In this js file, swal is a keyword in sweetalert.js used instead of alert keyword.

//reseting the browser storage value
let proceedFromHomeButtonOnly = false;
sessionStorage.setItem('proceedFromHomeButtonOnly', proceedFromHomeButtonOnly);

let faceVerified = false;
sessionStorage.setItem('faceVerified', faceVerified);

let payFromFacePageOnly = false;
sessionStorage.setItem('payFromFacePageOnly', payFromFacePageOnly);

// helper functions for html
const clickSaveBtn = () => {
    window.location.href = '../index.html';
};
  
const clickLogoImg = () => {
    window.location.href = '../index.html';
};

document.getElementById('logo').addEventListener('click', clickLogoImg);
document.getElementById('save-btn').addEventListener('click', clickSaveBtn);



//-----------------------------------------script for css of profile-img-box--------------------------------------------//
const imgContainer = document.querySelector('.photo-container');
const img = document.querySelector('#photo');
const file = document.querySelector('#file');
const uploadBtn = document.querySelector('#uploadBtn');

//if user hover on imgContainer 
imgContainer.addEventListener('mouseenter', function() {
    uploadBtn.style.display = "block";
});

//if we hover out from imgContainer
imgContainer.addEventListener('mouseleave', function() {
    uploadBtn.style.display = "none";
});



let currentUser = null;
let keepLoggedIn = localStorage.getItem("keepLoggedIn");
//------------------------------fetching data from localStorage to show on profile-------------------------//
function getUserName() {
    if (keepLoggedIn == "yes") {
        currentUser = JSON.parse(localStorage.getItem('user'));
    } else {
        currentUser = JSON.parse(sessionStorage.getItem('user'));
    }
}

getUserName();

if (currentUser) {
    let name = currentUser.fullname;
    let email = currentUser.email;
    let username = currentUser.username;
    let phone = currentUser.phone;
    let payid = phone + "@facepay";
    
    document.getElementById('name').innerText = name;
    document.getElementById('email').innerText = email;
    document.getElementById('username').innerText = username;
    document.getElementById('phone').innerText = phone;
    document.getElementById('payid').innerText = payid;
} else {
    swal("Login First!", "To view profile, Please Log In!\n\nPressing 'OK' will redirect you to log in.", "warning").then(function(reply) {
        if (reply) window.location.href = "./login.html"
        else window.location.href = "../index.html"
    })
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

// Realtime Database
import { getDatabase, ref, get, child, set, update } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-database.js";

const realdb = getDatabase();



//-----------------------------------------selection of img from pc--------------------------------------------//
//when we choose an image to upload
let chosenImageToUpload = null;

file.addEventListener('change', function() {
    const imageChosen = this.files[0];
    chosenImageToUpload = imageChosen;
    if (imageChosen) {
        uploadProcess();
    }
});



//-----------------------------------------Uploading Files (Image)--------------------------------------------//
let emailString = currentUser.email;
emailString = emailString.replaceAll('.', '').replaceAll('#', '').replaceAll('$', '').replaceAll('[', '').replaceAll(']', '');

let URL = currentUser.profileImgURL;

function compressImageToDataUrl(imageFile) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The selected image could not be read."));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("The selected file is not a valid image."));
            image.onload = () => {
                const maxDimension = 512;
                const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const canvasContext = canvas.getContext('2d');
                canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(imageFile);
    });
}

const uploadProcess = async () => {
    const uploadMessage = document.getElementById('upload-text');
    uploadMessage.classList.replace('hide', 'unhide');
    uploadMessage.innerHTML = "* * Saving Photo... * *";

    try {
        const imageURL = await compressImageToDataUrl(chosenImageToUpload);
        URL = imageURL;
        setImgToLocalStorage(imageURL);
        img.setAttribute('src', imageURL);

        // Update server database
        try {
            await fetch('/api/update-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUser.email, profileImgURL: imageURL })
            });
        } catch (apiErr) {
            console.log("Server profile update error:", apiErr);
        }

        setURLtoRealDB(imageURL);

        swal("Photo uploaded successfully!", "", "success");
        document.getElementById('save-btn').classList.replace('hide', 'unhide');
    } catch (uploadError) {
        console.error("Profile image processing error:", uploadError);
        swal("Photo upload failed", uploadError.message, "error");
    } finally {
        uploadMessage.classList.replace('unhide', 'hide');
    }
}

//-----------------------------------------Setting Image URL to Firebase Realtime Database--------------------------------------------//
const setURLtoRealDB = (URL) => {
    try {
        update(ref(realdb, "UsersList/" + emailString), {
            profileImgURL: URL
        }).catch(() => {});
    } catch (e) {}
}

//-----------------------------------------Setting Image URL to Local/Session Storage--------------------------------------------//
function setImgToLocalStorage(URL) {
    currentUser.profileImgURL = URL;

    if (keepLoggedIn == "yes") {
        localStorage.setItem('user', JSON.stringify(currentUser));
    } else {
        sessionStorage.setItem('user', JSON.stringify(currentUser));
    }
}


//We can fetch user profile img either from local storage or from firebase realtime database but fetching from local storage would be faster--------------------------------------------//
//-----------------------------------------Getting Image URL from Local/Session Storage to show on profile--------------------------------------------//
function getImgFromLocalStorage(URL) {
    if (currentUser.profileImgURL != "null") {
        let photoURL = currentUser.profileImgURL;
        img.setAttribute('src', URL);
    } else {
        img.setAttribute('src', "../images/profileM.jpg");
    }
}
getImgFromLocalStorage(URL);


//-----------------------------------------Getting Image URL from Firebase Realtime Database--------------------------------------------//
const dbRef = ref(realdb);
const getURLfromRealDB = () => {
    get(child(dbRef, "UsersList/" + emailString)).then((user) => {
        if (user.exists()) {
            img.setAttribute('src', user.val().profileImgURL);
        }
    })
}


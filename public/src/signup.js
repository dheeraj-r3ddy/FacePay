//In this js file, swal is a keyword in sweetalert.js used instead of alert keyword.

//reseting the browser storage value
let proceedFromHomeButtonOnly = false;
sessionStorage.setItem('proceedFromHomeButtonOnly', proceedFromHomeButtonOnly);

let faceVerified = false;
sessionStorage.setItem('faceVerified', faceVerified);

let payFromFacePageOnly = false;
sessionStorage.setItem('payFromFacePageOnly', payFromFacePageOnly);

// if already logged in avoid signup
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
const name = document.getElementById('nameInp');
const email = document.getElementById('emailInp');
const username = document.getElementById('userInp');
const phone = document.getElementById('phoneInp');
const pass = document.getElementById('passInp');
const submit = document.getElementById('sub_btn');
const video = document.getElementById('signup-video');
const captureStatus = document.getElementById('capture-status');
const faceStatus = document.getElementById('face-status');
const captureFaceBtn = document.getElementById('capture-face-btn');
const cancelCameraBtn = document.getElementById('cancel-camera-btn');
const retryCameraBtn = document.getElementById('retry-camera-btn');
const modelsSrc = "../models";
let cameraStream = null;
let faceTemplate = null;
let modelsLoaded = false;
let captureInProgress = false;

//-----------------------------------------VALIDATION-----------------------------------------------//
function isEmptyOrSpaces(str) {
    return str == null || str.match(/^ *$/) != null;
}

function Validation() {
    let nameregex = /^[a-zA-Z\s]+$/;
    // let emailregex = /^[a-zA-Z0-9]+@(gmail|yahoo|outlook)\.com$/;
    let emailregex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    let userregex = /^[a-zA-Z0-9]{3,}$/;
    let phoneregex = /^(\+\d{1,3}[- ]?)?[0]?\d{10}$/;
    
    if (isEmptyOrSpaces(name.value) || isEmptyOrSpaces(email.value) || isEmptyOrSpaces(username.value) || isEmptyOrSpaces(phone.value) || isEmptyOrSpaces(pass.value)) {
        swal("", "You cannot leave any field empty!", "warning");
        return false;
    }

    if (!nameregex.test(name.value)) {
        swal("", "The name should only contain alphabets!", "warning");
        return false;
    }

    if (!emailregex.test(email.value)) {
        swal("", "Enter a valid email!", "warning");
        return false;
    } 

    if (!userregex.test(username.value)) {
        swal("", "Username can only be alphanumeric.\n-Username must be atleast of 3 characters.\n-Username cannot contain spaces.", "warning");
        return false;
    }

    if (!phoneregex.test(phone.value)) {
        swal("", "Enter a valid phone number!", "warning");
        return false;
    }

    return true; 
}

//----------------------------------REGISTER USER--------------------------------------//

async function RegisterUser() {
    if (!Validation()) return;

    if (!faceTemplate) {
        await startCameraCapture();
        return;
    }

    submit.disabled = true;
    submit.innerText = "Registering...";

    const userData = {
        fullname: name.value.trim(),
        username: username.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim(),
        profileImgURL: "null",
        faceTemplate: faceTemplate,
        password: encPass()
    };

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            submit.disabled = false;
            submit.innerText = "Register Securely";
            swal("", result.message || "Registration failed!", "warning");
            return;
        }

        // Also save to localStorage as backup
        let emailKey = userData.email.toLowerCase().replace(/[\.#$\[\]]/g, '');
        let localUsers = JSON.parse(localStorage.getItem('facepay_users') || '{}');
        localUsers[emailKey] = userData;
        localStorage.setItem('facepay_users', JSON.stringify(localUsers));

        // Optional Firebase RTDB sync attempt
        try {
            if (db) {
                set(ref(db, "UsersList/" + emailKey), userData).catch(() => {});
            }
        } catch (e) {
            console.log("Firebase sync skipped:", e);
        }

        stopCamera();
        swal("User added successfully!", "Before using the application, please Log In at next step.", "success").then(function() {
            window.location.replace("./login.html");
        });
    } catch (error) {
        console.error("Registration error:", error);
        // Fallback to local storage if fetch failed
        try {
            let emailKey = userData.email.toLowerCase().replace(/[\.#$\[\]]/g, '');
            let localUsers = JSON.parse(localStorage.getItem('facepay_users') || '{}');
            if (localUsers[emailKey]) {
                submit.disabled = false;
                submit.innerText = "Register Securely";
                swal("", "Account already exists!", "warning");
                return;
            }
            localUsers[emailKey] = userData;
            localStorage.setItem('facepay_users', JSON.stringify(localUsers));

            stopCamera();
            swal("User added successfully!", "Before using the application, please Log In at next step.", "success").then(function() {
                window.location.replace("./login.html");
            });
        } catch (localErr) {
            submit.disabled = false;
            submit.innerText = "Register Securely";
            swal("Error!", `${error.message || error}`, "error");
        }
    }
}

async function startCameraCapture() {
    submit.disabled = true;
    submit.innerText = "Requesting Camera...";
    captureStatus.innerText = "Please allow camera access in the browser prompt.";
    faceStatus.innerText = "Allow camera access, then keep your face inside the frame.";
    retryCameraBtn.hidden = true;

    try {
        console.log("Requesting camera permission...");
        cameraStream = await requestCamera();
        console.log("Camera permission granted.");
        captureStatus.innerText = "Camera permission granted. Loading face detection...";
        if (!modelsLoaded) {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(modelsSrc),
                faceapi.nets.faceLandmark68Net.loadFromUri(modelsSrc),
                faceapi.nets.faceRecognitionNet.loadFromUri(modelsSrc)
            ]);
            modelsLoaded = true;
        }
        video.srcObject = cameraStream;
        await video.play();
        console.log("Camera stream started.");
        faceStatus.innerText = "Position your face inside the frame.";
        captureStatus.innerText = "Camera ready. Make sure one face is visible, then capture.";
        captureFaceBtn.hidden = false;
        cancelCameraBtn.hidden = false;
        submit.hidden = true;
    } catch (error) {
        stopCamera();
        captureStatus.innerText = getCameraErrorMessage(error);
        retryCameraBtn.hidden = false;
        swal("Camera unavailable", captureStatus.innerText, "warning");
    } finally {
        submit.disabled = false;
        if (!faceTemplate) submit.innerText = "Start Face Capture";
    }
}

async function captureFaceTemplate() {
    if (captureInProgress) return;
    captureInProgress = true;
    captureFaceBtn.disabled = true;
    const descriptors = [];
    try {
        for (let frame = 1; frame <= 3; frame++) {
            captureStatus.innerText = `Detecting face ${frame}/3...`;
            const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();
            if (!detection) throw new Error("No face detected. Position your face inside the frame and try again.");
            descriptors.push(Array.from(detection.descriptor));
            if (frame < 3) await delay(400);
        }
        faceTemplate = descriptors[0].map((value, index) =>
            descriptors.reduce((sum, descriptor) => sum + descriptor[index], 0) / descriptors.length
        );
        console.log("Face capture completed.");
        captureStatus.innerText = "Face detected ✓  Face template created ✓";
        faceStatus.innerText = "Face capture complete. Register to finish.";
        captureFaceBtn.hidden = true;
        cancelCameraBtn.hidden = true;
        submit.hidden = false;
        submit.innerText = "Register Securely";
    } catch (error) {
        captureStatus.innerText = error.message;
    } finally {
        captureInProgress = false;
        captureFaceBtn.disabled = false;
    }
}

function cancelCameraCapture() {
    faceTemplate = null;
    captureFaceBtn.hidden = true;
    cancelCameraBtn.hidden = true;
    submit.hidden = false;
    submit.innerText = "Start Face Capture";
    faceStatus.innerText = "Your camera will capture three frames for your secure face template. Images are not stored.";
    captureStatus.innerText = "Camera capture cancelled.";
    stopCamera();
}

function requestCamera() {
    const constraints = { video: { facingMode: "user" }, audio: false };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        return navigator.mediaDevices.getUserMedia(constraints);
    }

    const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (legacyGetUserMedia) {
        return new Promise((resolve, reject) => legacyGetUserMedia.call(navigator, constraints, resolve, reject));
    }

    throw new Error("This browser cannot access a camera. Open FacePay in the latest Chrome, Edge, or Firefox.");
}

function getCameraErrorMessage(error) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        console.log("Camera permission denied.");
        return "Camera access was denied. Please allow camera permission in your browser settings and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        return "No camera was detected on this device.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        return "The camera is busy in another app. Close other camera tabs or apps and try again.";
    }
    if (!window.isSecureContext) {
        return "Camera access requires localhost or HTTPS. Open http://localhost:3000 and try again.";
    }
    return error.message || "Camera enrollment failed. Check browser permissions and try again.";
}

function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
        video.srcObject = null;
        console.log("Camera stream stopped.");
    }
}

async function checkCameraAccess() {
    if (!navigator.mediaDevices && !navigator.getUserMedia && !navigator.webkitGetUserMedia && !navigator.mozGetUserMedia) {
        captureStatus.innerText = "Camera access is unavailable in this browser. Use Chrome or Edge at http://localhost:3000.";
        return;
    }
    if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: "camera" }).catch(() => null);
        if (permission && permission.state === "denied") {
            captureStatus.innerText = "Camera is blocked. Click the camera/lock icon beside the address, set Camera to Allow, then refresh.";
            return;
        }
    }
    captureStatus.innerText = "Camera access is ready after you complete the form.";
}

checkCameraAccess();

//------------------------------------ENCRYPTION-----------------------------------------------//
function encPass() {
    let pass12 = CryptoJS.AES.encrypt(pass.value, pass.value); 
    return pass12.toString();
}            

//------------------------------------ASSIGN THE EVENTS-----------------------------------------//
submit.addEventListener('click', RegisterUser);
captureFaceBtn.addEventListener('click', captureFaceTemplate);
cancelCameraBtn.addEventListener('click', cancelCameraCapture);
retryCameraBtn.addEventListener('click', async () => {
    if (Validation()) await startCameraCapture();
});
window.addEventListener('pagehide', stopCamera);
window.addEventListener('beforeunload', stopCamera);

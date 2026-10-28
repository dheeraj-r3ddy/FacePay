// In this js file, swal is a keyword in sweetalert.js used instead of alert keyword.

//------------------------importing image from localStorage or RealTime Database-------------------------//
let currentUser;
let keepLoggedIn = localStorage.getItem("keepLoggedIn");
let proceedFromHomeButtonOnly = sessionStorage.getItem("proceedFromHomeButtonOnly");
let payFromFacePageOnly = sessionStorage.getItem('payFromFacePageOnly');

function getUserName() {
  if (keepLoggedIn == "yes") {
      currentUser = JSON.parse(localStorage.getItem('user'));
  } else {
      currentUser = JSON.parse(sessionStorage.getItem('user'));
  }
}
getUserName();

if (currentUser) {
  if (proceedFromHomeButtonOnly == "false") {
    swal("Before starting face verification, fill transaction details at home page.", "Pressing 'OK' will redirect you to home.", "warning", {timer: 4000}).then(function() {
      window.location.href = "../index.html";
    });
  }
} else {
  swal("Login First!", "To start face verification, Please Log In!\n\nPressing 'OK' will redirect you to log in.", "warning", {timer: 4000}).then(function(reply) {
    if (reply) window.location.href = "./login.html";
    else window.location.href = "../index.html";
  });
}

//--------------------------------------Declaration of Variables-----------------------------------------//
const message = document.getElementById('message');
const video = document.getElementById('videoElement');
const main = document.getElementById('main');
const startBtn = document.getElementById('start-btn');

const modelsSrc = "../models";

let faceMatcher;
let canvas;
let showStartBtn = true;
let showCanvas = true;
let faceLabel;
let faceScore;
let faceVerified = false;
let registeredTemplate;
const detectionStatus = document.getElementById('detection-status');
const livenessStatus = document.getElementById('liveness-status');
const matchStatus = document.getElementById('match-status');

// Transaction payload from Home / QR flow
let currentTransaction = null;
sessionStorage.setItem('paymentStatus', 'AUTHENTICATION_PENDING');
try {
  currentTransaction = JSON.parse(sessionStorage.getItem('currentTransaction') || 'null');
} catch (e) {}
if (!currentTransaction) {
  try {
    const pendingPayment = JSON.parse(sessionStorage.getItem('pendingPayment') || 'null');
    if (pendingPayment) {
      currentTransaction = {
        senderEmail: currentUser.email,
        senderName: pendingPayment.senderName,
        senderPhone: pendingPayment.senderPhone,
        recipientId: pendingPayment.receiverId || pendingPayment.receiverKey,
        recipientName: pendingPayment.receiverName,
        recipientPhone: pendingPayment.receiverPhone || '',
        amount: pendingPayment.amount,
        paymentMethod: 'FacePay QR',
        paymentType: 'bank'
      };
      sessionStorage.setItem('currentTransaction', JSON.stringify(currentTransaction));
    }
  } catch (e) {}
}

// helper function for HTML file (face-verification.html)
const clickLogoImg = () => {
  window.location.href = '../index.html';
};

const clickStartBtn = () => {
  startFaceRecognition();
};

//-----------------------------------------face-verification--------------------------------------------//
message.innerText = "Starting Camera...";

// Loading Models
Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri(modelsSrc),
  faceapi.nets.faceLandmark68Net.loadFromUri(modelsSrc),
  faceapi.nets.faceRecognitionNet.loadFromUri(modelsSrc),
]).then(startVideo);

// Getting Camera
function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then(stream => {
      video.srcObject = stream;
      matchFace();
    })
    .catch(() => {
      message.innerText = "Camera permission is required to verify payment.";
      swal("Camera unavailable", "Allow camera access and refresh the page to continue.", "warning");
    });
}

// Face Matching Setup
async function matchFace() {
  if (!currentUser.faceTemplate || currentUser.faceTemplate.length !== 128) {
    message.innerText = "No live face template is registered for this account.";
    swal("Face enrollment required", "This account was created without a live face template. Please register a new account.", "warning");
    return;
  }
  registeredTemplate = new Float32Array(currentUser.faceTemplate);

  message.innerText = "Camera & Face Engine Ready!";
  setTimeout(() => {
    const txnAmount = currentTransaction ? `₹${currentTransaction.amount}` : '';
    message.innerText = `To authorize payment ${txnAmount}, position your face and click 'Start Verification'.`;
    if (showStartBtn) startBtn.classList.replace('hide', 'unhide');
    else swal("Something went wrong!", "Please refresh the page.", "error").then(function(reply) {
      if (reply) window.location.reload();
    });
  }, 800);
}

// Face Recognition Process
async function startFaceRecognition() {
    if (canvas) canvas.remove();

    canvas = faceapi.createCanvasFromMedia(video);
    main.appendChild(canvas);
    const displaySize = { width: video.width || 400, height: video.height || 400 };
    faceapi.matchDimensions(canvas, displaySize);

    const recognizing = async () => {
      message.innerText = "Authenticating facial pattern...";
      const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

      if (!resizedDetections[0]) {
        detectionStatus.innerText = "Face detected -";
        message.innerText = "Face not detected. Center your face inside the frame.";
        return;
      }

      detectionStatus.innerText = "Face detected ✓";
      detectionStatus.classList.add('complete');
      livenessStatus.innerText = "Liveness verified ✓";
      livenessStatus.classList.add('complete');

      const descriptorResult = resizedDetections[0].descriptor;
      faceScore = faceapi.euclideanDistance(registeredTemplate, descriptorResult);
      faceLabel = faceScore <= 0.45 ? "known" : "unknown";

      if (showCanvas) {
        const box = resizedDetections[0].detection.box;
        const drawBox = new faceapi.draw.DrawBox(box, { label: faceLabel === "known" ? "Verified" : "Unverified" });
        drawBox.draw(canvas);
      }

      // Forward for payment processing
      makePayment();
    };
    recognizing();
}

//-----------------------------------------Forwarding for payment response--------------------------------------------//
async function makePayment() {
  payFromFacePageOnly = true;

  if (faceLabel === "known" && faceScore <= 0.45) {
    faceVerified = true;
    sessionStorage.setItem('paymentStatus', 'AUTHENTICATED');
    matchStatus.innerText = "Face matched ✓";
    matchStatus.classList.add('complete');

    const recipientName = currentTransaction ? currentTransaction.recipientName : "Merchant";
    const amountStr = currentTransaction ? `₹${currentTransaction.amount}` : "";

    swal(`${currentUser.fullname}, you are verified!`, `Confirming payment of ${amountStr} to ${recipientName}. Click 'Authorize & Pay' to finalize.`, "success");
    message.innerText = `Face verified! Click 'Authorize & Pay' to complete payment.`;

    startBtn.innerText = `Authorize & Pay ${amountStr}`;
    startBtn.classList.add('pay-btn');

    startBtn.onclick = async () => {
      startBtn.disabled = true;
      startBtn.innerText = "Processing Payment...";

      // Face verification is the application-level gate; Razorpay confirms the payment.
      try {
        if (!currentTransaction || !currentTransaction.amount || !currentTransaction.recipientId) {
          throw new Error('Payment details are incomplete. Return to the payment screen and try again.');
        }

        const orderRes = await fetch('/api/payment/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderEmail: currentUser.email,
            recipientId: currentTransaction.recipientId,
            recipientUpiId: currentTransaction.recipientUpiId,
            recipientPhone: currentTransaction.recipientPhone,
            recipientName: currentTransaction.recipientName,
            amount: currentTransaction.amount,
            currency: 'INR',
            description: 'FacePay payment'
          })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData.success || !orderData.keyId) {
          throw new Error(orderData.message || 'Unable to create the Razorpay order.');
        }
        sessionStorage.setItem('paymentStatus', 'RAZORPAY_ORDER_CREATED');

        const checkout = new Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'FacePay',
          description: 'FacePay Test Payment',
          order_id: orderData.orderId,
          prefill: {
            name: currentUser.fullname || currentUser.username || '',
            email: currentUser.email || '',
            contact: currentUser.phone || ''
          },
          notes: { testMode: 'true', recipient: currentTransaction.recipientId },
          theme: { color: '#0073cf' },
          handler: async response => {
            try {
              const verifyRes = await fetch('/api/payment/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(response)
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) throw new Error(verifyData.message || 'Payment verification failed.');
              sessionStorage.setItem('lastCompletedTransaction', JSON.stringify(verifyData.transaction));
              sessionStorage.setItem('paymentStatus', 'SUCCESS');
              sessionStorage.setItem('payFromFacePageOnly', 'true');
              sessionStorage.setItem('faceVerified', 'true');
              window.location.replace('./payment.html');
            } catch (error) {
              sessionStorage.setItem('paymentStatus', 'FAILED');
              sessionStorage.setItem('faceVerified', 'false');
              swal('Payment Failed', error.message, 'error');
              startBtn.disabled = false;
              startBtn.innerText = 'Retry Payment';
            }
          },
          modal: {
            ondismiss: () => {
              sessionStorage.setItem('paymentStatus', 'CANCELLED');
              startBtn.disabled = false;
              startBtn.innerText = 'Retry Payment';
              message.innerText = 'Payment cancelled. You can retry when ready.';
            }
          }
        });
        sessionStorage.setItem('paymentStatus', 'PAYMENT_PENDING');
        checkout.open();
      } catch (err) {
        console.error("Payment submission error:", err);
        startBtn.disabled = false;
        startBtn.innerText = "Retry Payment";
        swal("Payment Failed", err.message || "Unable to process payment right now. Please try again.", "error");
      }
    };
  } else if (faceLabel === "known" && faceScore > 0.45) {
    faceVerified = false;
    matchStatus.innerText = "Face matched -";
    message.innerText = `Face similarity score ${faceScore.toFixed(2)}. Please reposition face and try again.`;
  } else {
    faceVerified = false;
    matchStatus.innerText = "Face matched -";
    swal("Verification Failed!", "The face in front of the camera did not match the registered face template.", "error").then(function() {
      sessionStorage.setItem('payFromFacePageOnly', 'true');
      sessionStorage.setItem('faceVerified', 'false');
      window.location.replace('./payment.html');
    });
  }

  sessionStorage.setItem('payFromFacePageOnly', payFromFacePageOnly);
  sessionStorage.setItem('faceVerified', faceVerified);
}
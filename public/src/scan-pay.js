const database = firebase.database();

const availableBalanceElement =
    document.getElementById("available-balance");

const scannerSection =
    document.getElementById("scanner-section");

const paymentSection =
    document.getElementById("payment-section");

const scannerStatus =
    document.getElementById("scanner-status");

const restartScannerButton =
    document.getElementById("restart-scanner-button");

const merchantNameElement =
    document.getElementById("merchant-name");

const merchantIdElement =
    document.getElementById("merchant-id");

const paymentAmountInput =
    document.getElementById("payment-amount");

const amountError =
    document.getElementById("amount-error");

const continueButton =
    document.getElementById("continue-button");

let html5QrCode = null;
let currentUser = null;
let currentUserDatabaseKey = null;
let selectedMerchant = null;
let scannerRunning = false;
let qrProcessing = false;

/*
    Read logged-in user from localStorage or sessionStorage.
*/
function loadUserFromStorage() {
    const keepLoggedIn = localStorage.getItem("keepLoggedIn");

    const storedUser =
        keepLoggedIn === "yes"
            ? localStorage.getItem("user")
            : sessionStorage.getItem("user");

    if (!storedUser) {
        currentUser = null;
        return;
    }

    try {
        currentUser = JSON.parse(storedUser);
    } catch (error) {
        console.error("Unable to read logged-in user:", error);
        currentUser = null;
    }
}

/*
    Firebase user keys were created by removing invalid characters
    from the email address.
*/
function createFirebaseUserKey(email) {
    return String(email)
        .trim()
        .toLowerCase()
        .replaceAll(".", "")
        .replaceAll("#", "")
        .replaceAll("$", "")
        .replaceAll("[", "")
        .replaceAll("]", "");
}

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2
    });
}

function goBackHome() {
    stopScanner().finally(() => {
        window.location.href = "../index.html";
    });
}

/*
    Load the latest wallet balance from Firebase.
*/
async function loadCurrentUserFromFirebase() {
    if (!currentUser || !currentUser.email) {
        alert("Please log in before using Scan & Pay.");
        window.location.replace("./login.html");
        return false;
    }

    try {
        currentUserDatabaseKey =
            createFirebaseUserKey(currentUser.email);

        const snapshot = await database
            .ref(`UsersList/${currentUserDatabaseKey}`)
            .once("value");

        if (!snapshot.exists()) {
            alert("Your FacePay account was not found.");
            window.location.replace("./login.html");
            return false;
        }

        currentUser = snapshot.val();

        if (currentUser.accountStatus === "blocked") {
            alert("Your FacePay wallet is currently blocked.");
            window.location.replace("../index.html");
            return false;
        }

        availableBalanceElement.textContent =
            formatCurrency(currentUser.walletBalance);

        updateStoredUser(currentUser);

        return true;
    } catch (error) {
        console.error("Unable to load wallet:", error);

        scannerStatus.textContent =
            "Unable to load your wallet information.";

        scannerStatus.classList.add("error");

        return false;
    }
}

function updateStoredUser(user) {
    const keepLoggedIn = localStorage.getItem("keepLoggedIn");

    if (keepLoggedIn === "yes") {
        localStorage.setItem("user", JSON.stringify(user));
    } else {
        sessionStorage.setItem("user", JSON.stringify(user));
    }
}

/*
    Start the rear camera.
*/
async function startScanner() {

    if (scannerRunning) return;

    scannerStatus.innerText = "Starting Camera...";

    html5QrCode = new Html5Qrcode("qr-reader");

    const cameras = await Html5Qrcode.getCameras();

    if (cameras.length == 0) {
        alert("No camera found");
        return;
    }

    console.log(cameras);

    await html5QrCode.start(

        cameras[0].id,

        {
            fps: 5,
            qrbox: 250
        },

        (decodedText) => {

            alert("QR DETECTED");

            console.log(decodedText);

            handleQrCodeSuccess(decodedText);

        },

        (error) => {
            // ignore continuous scan failures
        }

    );

    scannerRunning = true;
}


/*
    The scanning library calls this repeatedly when no QR is found.
    We intentionally do nothing here.
*/
function handleQrCodeFailure() {
    // Keep scanning.
}

/*
    Runs after a QR code is successfully scanned.
*/
async function handleQrCodeSuccess(decodedText) {
    alert("QR DETECTED");

    alert(decodedText);

    console.log(decodedText);

    if (qrProcessing) {
        return;
    }

    qrProcessing = true;

    scannerStatus.className = "scanner-status";
    scannerStatus.textContent = "QR detected. Verifying merchant...";

    try {
        const merchantId = extractMerchantId(decodedText);

        if (!merchantId) {
            throw new Error(
                "This is not a valid FacePay merchant QR."
            );
        }

        const merchant = await getMerchantFromFirebase(merchantId);

        if (!merchant) {
            throw new Error(
                "Merchant is not registered in FacePay."
            );
        }

        if (merchant.accountStatus !== "active") {
            throw new Error(
                "This merchant account is currently inactive."
            );
        }

        if (merchant.qrEnabled === false) {
            throw new Error(
                "Payments for this QR code are disabled."
            );
        }

        selectedMerchant = {
            databaseKey: merchantId,
            ...merchant
        };

        await stopScanner();

        displayMerchant(selectedMerchant);
    } catch (error) {
        console.error("QR verification failed:", error);

        scannerStatus.classList.add("error");
        scannerStatus.textContent =
            error.message || "Unable to verify this QR code.";

        restartScannerButton.classList.remove("hidden");

        qrProcessing = false;
    }
}

/*
    Supported QR value:

    FACEPAY:MERCHANT:IBLOCK_CANTEEN
*/
function extractMerchantId(decodedText) {
    if (!decodedText) {
        return null;
    }

    const qrText = decodedText.trim();

    const prefix = "FACEPAY:MERCHANT:";

    if (!qrText.toUpperCase().startsWith(prefix)) {
        return null;
    }

    const merchantId =
        qrText.substring(prefix.length).trim().toUpperCase();

    if (!/^[A-Z0-9_]+$/.test(merchantId)) {
        return null;
    }

    return merchantId;
}

async function getMerchantFromFirebase(merchantId) {
    const snapshot = await database
        .ref(`Merchants/${merchantId}`)
        .once("value");

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.val();
}

async function stopScanner() {
    if (!html5QrCode) {
        scannerRunning = false;
        return;
    }

    try {
        if (scannerRunning) {
            await html5QrCode.stop();
        }

        await html5QrCode.clear();
    } catch (error) {
        console.warn("Scanner cleanup warning:", error);
    } finally {
        html5QrCode = null;
        scannerRunning = false;
    }
}

function displayMerchant(merchant) {
    scannerSection.classList.add("hidden");
    paymentSection.classList.remove("hidden");

    merchantNameElement.textContent =
        merchant.merchantName || merchant.merchantId;

    merchantIdElement.textContent =
        `Merchant ID: ${merchant.merchantId}`;

    paymentAmountInput.value = "";
    amountError.textContent = "";

    paymentAmountInput.focus();
}

async function restartScanner() {
    selectedMerchant = null;
    qrProcessing = false;

    paymentSection.classList.add("hidden");
    scannerSection.classList.remove("hidden");

    paymentAmountInput.value = "";
    amountError.textContent = "";

    await stopScanner();
    await startScanner();
}

/*
    Validate payment and redirect to face verification.
*/
async function continueToFaceVerification() {
    amountError.textContent = "";

    if (!selectedMerchant) {
        amountError.textContent =
            "Please scan a valid merchant QR first.";
        return;
    }

    const amount = Number(paymentAmountInput.value);

    const walletBalance =
        Number(currentUser.walletBalance || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
        amountError.textContent =
            "Enter a valid amount greater than ₹0.";
        return;
    }

    if (!Number.isInteger(amount)) {
        amountError.textContent =
            "Enter the amount in whole rupees.";
        return;
    }

    if (amount > walletBalance) {
        amountError.textContent =
            `Insufficient balance. Available balance is ${formatCurrency(walletBalance)}.`;
        return;
    }

    if (
        selectedMerchant.accountStatus !== "active" ||
        selectedMerchant.qrEnabled === false
    ) {
        amountError.textContent =
            "This merchant cannot currently receive payments.";
        return;
    }

    continueButton.disabled = true;
    continueButton.textContent = "Preparing Payment...";

    try {
        /*
            Recheck merchant before proceeding, so an outdated
            scanned merchant record is not used.
        */
        const latestMerchant =
            await getMerchantFromFirebase(
                selectedMerchant.merchantId
            );

        if (
            !latestMerchant ||
            latestMerchant.accountStatus !== "active" ||
            latestMerchant.qrEnabled === false
        ) {
            throw new Error(
                "Merchant is currently unavailable."
            );
        }

        const pendingPayment = {
            paymentType: "STATIC_QR",

            senderKey: currentUserDatabaseKey,
            senderAccountId:
                currentUser.accountId || currentUserDatabaseKey,

            senderName:
                currentUser.fullname ||
                currentUser.username ||
                "FacePay User",

            senderPhone: currentUser.phone || "",

            receiverType: "merchant",
            receiverKey: selectedMerchant.merchantId,
            receiverId: selectedMerchant.merchantId,
            receiverName:
                latestMerchant.merchantName ||
                selectedMerchant.merchantId,

            amount: amount,

            authenticationMethod: "FACE",
            status: "PENDING",

            createdAt: new Date().toISOString()
        };

        sessionStorage.setItem(
            "pendingPayment",
            JSON.stringify(pendingPayment)
        );

        /*
            These flags are used by the existing FacePay flow.
        */
        sessionStorage.setItem(
            "proceedFromHomeButtonOnly",
            "true"
        );

        sessionStorage.setItem(
            "faceVerified",
            "false"
        );

        sessionStorage.setItem(
            "payFromFacePageOnly",
            "false"
        );

        window.location.href = "./face-verification.html";
    } catch (error) {
        console.error("Unable to prepare payment:", error);

        amountError.textContent =
            error.message || "Unable to prepare the payment.";

        continueButton.disabled = false;
        continueButton.textContent = "Continue";
    }
}

paymentAmountInput.addEventListener("input", function () {
    amountError.textContent = "";

    if (Number(this.value) < 0) {
        this.value = "";
    }
});

/*
    Stop the camera when the user leaves the page.
*/
window.addEventListener("beforeunload", function () {
    if (html5QrCode && scannerRunning) {
        html5QrCode.stop().catch(() => {
            // Browser is closing the page.
        });
    }
});

/*
    Start page.
*/
async function initializeScanPayPage() {
    loadUserFromStorage();

    const userLoaded =
        await loadCurrentUserFromFirebase();

    if (userLoaded) {
        await startScanner();
    }
}

initializeScanPayPage();

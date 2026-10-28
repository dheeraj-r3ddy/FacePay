// DOM Elements
const login = document.getElementById("login");
const signup = document.getElementById("signup");
const profile = document.getElementById('profile');
const profileLogo = document.getElementById('profileLogo');

const walletSwitch = document.getElementById('wallet-switch');
const bankSwitch = document.getElementById('bank-switch');
const qrSwitch = document.getElementById('qr-switch');

const walletContainer = document.getElementById('wallet-transfer-container');
const bankContainer = document.getElementById('bank-transfer-container');
const qrContainer = document.getElementById('qr-scan-container');

const showMyQrBtn = document.getElementById('showMyQrBtn');
const viewTxnsBtn = document.getElementById('viewTxnsBtn');

const homeNextBtn = document.getElementById('home-next-btn');

// Form inputs
const walletPhoneInp = document.getElementById('walletPhoneInp');
const walletPayIdInp = document.getElementById('walletPayIdInp');
const walletAmountInp = document.getElementById('walletAmountInp');

const bankNameInp = document.getElementById('bankNameInp');
const bankAccInp = document.getElementById('bankAccInp');
const bankIfscInp = document.getElementById('bankIfscInp');
const bankAmountInp = document.getElementById('bankAmountInp');

// QR Scanner Elements
const qrScanStatus = document.getElementById('qr-scan-status');
const cancelQrScanBtn = document.getElementById('cancelQrScanBtn');
const retryQrScanBtn = document.getElementById('retryQrScanBtn');

// Modals
const balanceBtn = document.getElementById('balanceBtn');
const balanceModal = document.getElementById('balanceModal');
const closeBalanceModal = document.getElementById('closeBalanceModal');
const doneBalanceBtn = document.getElementById('doneBalanceBtn');
const refreshBalanceBtn = document.getElementById('refreshBalanceBtn');
const refreshSpinner = document.getElementById('refreshSpinner');

const paymentConfirmationModal = document.getElementById('paymentConfirmationModal');
const closeConfirmModal = document.getElementById('closeConfirmModal');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const proceedToFaceAuthBtn = document.getElementById('proceedToFaceAuthBtn');
const confirmRecipientName = document.getElementById('confirmRecipientName');
const confirmRecipientId = document.getElementById('confirmRecipientId');
const confirmRecipientMobile = document.getElementById('confirmRecipientMobile');
const confirmPaymentMethod = document.getElementById('confirmPaymentMethod');
const confirmAmountInput = document.getElementById('confirmAmountInput');

const myQrModal = document.getElementById('myQrModal');
const closeMyQrModal = document.getElementById('closeMyQrModal');
const closeMyQrBtn = document.getElementById('closeMyQrBtn');
const myQrCodeTarget = document.getElementById('myQrCodeTarget');
const myQrUserName = document.getElementById('myQrUserName');
const myQrUserPayId = document.getElementById('myQrUserPayId');
const myQrUserPhone = document.getElementById('myQrUserPhone');
const myQrCustomAmount = document.getElementById('myQrCustomAmount');

const transactionsModal = document.getElementById('transactionsModal');
const closeTxnsModal = document.getElementById('closeTxnsModal');
const closeTxnsBtn = document.getElementById('closeTxnsBtn');
const txnsListContainer = document.getElementById('txnsListContainer');

// Global State
let activeTab = 'wallet'; // 'wallet' | 'bank' | 'qr'
let html5QrScanner = null;
let isScannerRunning = false;
let scannedTransactionData = null;
let myQrCodeInstance = null;

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

// Reset browser navigation flags
sessionStorage.setItem('proceedFromHomeButtonOnly', 'false');
sessionStorage.setItem('faceVerified', 'false');
sessionStorage.setItem('payFromFacePageOnly', 'false');

// Profile logo setup
if (currentUser && currentUser.profileImgURL && currentUser.profileImgURL !== "null") {
    if (profileLogo) profileLogo.setAttribute('src', currentUser.profileImgURL);
} else if (profileLogo) {
    profileLogo.setAttribute('src', "./images/profileM.jpg");
}

// Helper: Format currency
function formatCurrency(amount) {
    const num = Number(amount) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Navigation Handlers
const clickLogoImg = () => { window.location.href = './index.html'; };
if (login) login.onclick = () => { window.location.href = './src/login.html'; };
if (signup) signup.onclick = () => { window.location.href = './src/signup.html'; };
if (profile) profile.onclick = () => { window.location.href = './src/profile.html'; };

//-----------------------------------TAB SWITCHING----------------------------------//
function switchTab(tab) {
    activeTab = tab;

    // Remove active class from all tabs
    walletSwitch.classList.remove('active-tab');
    bankSwitch.classList.remove('active-tab');
    qrSwitch.classList.remove('active-tab');

    // Hide all containers
    walletContainer.classList.replace('unhide', 'hide');
    bankContainer.classList.replace('unhide', 'hide');
    qrContainer.classList.replace('unhide', 'hide');

    // Stop QR scanner if switching away from QR tab
    if (tab !== 'qr' && isScannerRunning) {
        stopQrScanner();
    }

    if (tab === 'wallet') {
        walletSwitch.classList.add('active-tab');
        walletContainer.classList.replace('hide', 'unhide');
        if (homeNextBtn) homeNextBtn.style.display = 'block';
    } else if (tab === 'bank') {
        bankSwitch.classList.add('active-tab');
        bankContainer.classList.replace('hide', 'unhide');
        if (homeNextBtn) homeNextBtn.style.display = 'block';
    } else if (tab === 'qr') {
        qrSwitch.classList.add('active-tab');
        qrContainer.classList.replace('hide', 'unhide');
        if (homeNextBtn) homeNextBtn.style.display = 'none'; // QR flow uses direct scanning
        startQrScanner();
    }
}

if (walletSwitch) walletSwitch.onclick = () => switchTab('wallet');
if (bankSwitch) bankSwitch.onclick = () => switchTab('bank');
if (qrSwitch) qrSwitch.onclick = () => switchTab('qr');

//-----------------------------------QR SCANNER LOGIC----------------------------------//
async function startQrScanner() {
    getUserName();
    if (!currentUser) {
        swal("Login First!", "Please log in to scan FacePay QR codes and make payments.", "warning").then(() => {
            window.location.href = './src/login.html';
        });
        return;
    }

    if (isScannerRunning) return;

    if (qrScanStatus) qrScanStatus.innerText = "Requesting camera access...";
    if (retryQrScanBtn) retryQrScanBtn.classList.replace('unhide', 'hide');

    try {
        if (!html5QrScanner) {
            html5QrScanner = new Html5Qrcode("qr-reader");
        }

        const config = {
            fps: 15,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
        };

        await html5QrScanner.start(
            { facingMode: "environment" },
            config,
            onQrCodeScanned,
            onQrScanFailure
        );

        isScannerRunning = true;
        if (qrScanStatus) qrScanStatus.innerText = "Camera active. Position FacePay QR inside the frame.";
        if (retryQrScanBtn) retryQrScanBtn.classList.replace('unhide', 'hide');
    } catch (err) {
        console.warn("Camera start error with environment camera, trying fallback:", err);
        try {
            // Fallback for laptops/desktops without rear camera
            await html5QrScanner.start(
                { facingMode: "user" },
                { fps: 15, qrbox: { width: 220, height: 220 } },
                onQrCodeScanned,
                onQrScanFailure
            );
            isScannerRunning = true;
            if (qrScanStatus) qrScanStatus.innerText = "Camera active. Position FacePay QR inside the frame.";
        } catch (fallbackErr) {
            console.error("Camera access failed:", fallbackErr);
            isScannerRunning = false;
            if (qrScanStatus) qrScanStatus.innerText = "Camera permission is required to scan a QR code.";
            if (retryQrScanBtn) retryQrScanBtn.classList.replace('hide', 'unhide');
            swal("Camera Permission Required", "Please allow camera access in browser settings to scan QR codes.", "warning");
        }
    }
}

async function stopQrScanner() {
    if (html5QrScanner && isScannerRunning) {
        try {
            await html5QrScanner.stop();
            isScannerRunning = false;
            if (qrScanStatus) qrScanStatus.innerText = "Camera stopped.";
        } catch (err) {
            console.log("Error stopping scanner:", err);
        }
    }
}

function onQrScanFailure(error) {
    // Normal frame scanning tick - ignore noise
}

function onQrCodeScanned(decodedText) {
    console.log("QR Code scanned:", decodedText);
    stopQrScanner();

    // Process & validate scanned QR data
    let qrData = null;
    try {
        qrData = JSON.parse(decodedText);
    } catch (e) {
        // Support plain text FacePay IDs
        if (decodedText && (decodedText.startsWith("FP-") || decodedText.includes("@facepay"))) {
            qrData = {
                type: "facepay",
                version: "1.0",
                recipientId: decodedText,
                recipientName: "FacePay Merchant",
                mobile: ""
            };
        }
    }

    if (!qrData || qrData.type !== "facepay" || (!qrData.recipientId && !qrData.mobile && !qrData.recipientName)) {
        swal("Invalid FacePay QR Code", "Please scan a valid FacePay payment QR.", "error").then(() => {
            if (activeTab === 'qr') startQrScanner();
        });
        return;
    }

    // Valid FacePay QR
    openPaymentConfirmation({
        recipientId: qrData.recipientId || "FP-MERCHANT",
        recipientName: qrData.recipientName || "FacePay User",
        mobile: qrData.mobile || "",
        amount: qrData.amount || "",
        paymentMethod: "FacePay QR",
        paymentType: "bank"
    });
}

if (cancelQrScanBtn) {
    cancelQrScanBtn.onclick = () => {
        stopQrScanner();
        switchTab('wallet');
    };
}

if (retryQrScanBtn) {
    retryQrScanBtn.onclick = () => {
        startQrScanner();
    };
}

//-----------------------------PAYMENT CONFIRMATION MODAL----------------------------//
function openPaymentConfirmation(data) {
    getUserName();
    if (!currentUser) return;

    scannedTransactionData = data;

    if (confirmRecipientName) confirmRecipientName.innerText = data.recipientName || "Recipient";
    if (confirmRecipientId) confirmRecipientId.innerText = data.recipientId || (data.mobile + "@facepay");
    if (confirmRecipientMobile) confirmRecipientMobile.innerText = data.mobile || "N/A";
    if (confirmPaymentMethod) confirmPaymentMethod.innerText = data.paymentMethod || "FacePay QR";

    if (confirmAmountInput) {
        if (data.amount && Number(data.amount) > 0) {
            confirmAmountInput.value = data.amount;
        } else {
            confirmAmountInput.value = "";
            setTimeout(() => confirmAmountInput.focus(), 300);
        }
    }

    if (paymentConfirmationModal) {
        paymentConfirmationModal.classList.replace('hide', 'unhide');
    }
}

function hidePaymentConfirmation() {
    if (paymentConfirmationModal) {
        paymentConfirmationModal.classList.replace('unhide', 'hide');
    }
}

if (closeConfirmModal) closeConfirmModal.onclick = hidePaymentConfirmation;
if (cancelConfirmBtn) cancelConfirmBtn.onclick = () => {
    hidePaymentConfirmation();
    if (activeTab === 'qr') startQrScanner();
};

if (proceedToFaceAuthBtn) {
    proceedToFaceAuthBtn.onclick = async () => {
        getUserName();
        if (!currentUser) {
            swal("Session Expired", "Please log in again.", "warning");
            return;
        }

        const enteredAmount = Number(confirmAmountInput.value);
        if (isNaN(enteredAmount) || enteredAmount <= 0) {
            swal("Invalid Amount", "Please enter a valid payment amount greater than zero.", "warning");
            return;
        }

        // Prepare transaction payload for face verification page
        const txnPayload = {
            senderEmail: currentUser.email,
            senderName: currentUser.fullname || currentUser.username,
            senderPhone: currentUser.phone || '',
            recipientId: scannedTransactionData.recipientId,
            recipientName: scannedTransactionData.recipientName,
            recipientPhone: scannedTransactionData.mobile || '',
            amount: enteredAmount,
            paymentMethod: scannedTransactionData.paymentMethod || 'FacePay QR',
            paymentType: scannedTransactionData.paymentType || 'bank'
        };

        sessionStorage.setItem('currentTransaction', JSON.stringify(txnPayload));
        sessionStorage.setItem('proceedFromHomeButtonOnly', 'true');
        hidePaymentConfirmation();

        // Redirect to face verification
        window.location.href = './src/face-verification.html';
    };
}

//-----------------------------DEMO QR BADGES----------------------------//
document.querySelectorAll('.demo-qr-badge').forEach(badge => {
    badge.addEventListener('click', () => {
        const recipientId = badge.getAttribute('data-id');
        const recipientName = badge.getAttribute('data-name');
        const mobile = badge.getAttribute('data-mobile');
        const amount = badge.getAttribute('data-amount');

        stopQrScanner();

        openPaymentConfirmation({
            recipientId,
            recipientName,
            mobile,
            amount: amount ? Number(amount) : '',
            paymentMethod: 'FacePay QR (Demo)',
            paymentType: 'bank'
        });
    });
});

//-----------------------------MY QR / RECEIVE MONEY MODAL----------------------------//
function renderMyQrCode() {
    getUserName();
    if (!currentUser) return;

    if (myQrUserName) myQrUserName.innerText = currentUser.fullname || currentUser.username || "User";
    const payId = currentUser.facepayId || (currentUser.phone ? currentUser.phone + "@facepay" : "user@facepay");
    if (myQrUserPayId) myQrUserPayId.innerText = payId;
    if (myQrUserPhone) myQrUserPhone.innerText = currentUser.phone ? "+91 " + currentUser.phone : "";

    const customAmt = myQrCustomAmount ? Number(myQrCustomAmount.value) : 0;

    const qrPayload = {
        type: "facepay",
        version: "1.0",
        recipientId: payId,
        recipientName: currentUser.fullname || currentUser.username,
        mobile: currentUser.phone || ""
    };

    if (customAmt > 0) {
        qrPayload.amount = customAmt;
    }

    if (myQrCodeTarget) {
        myQrCodeTarget.innerHTML = "";
        try {
            myQrCodeInstance = new QRCode(myQrCodeTarget, {
                text: JSON.stringify(qrPayload),
                width: 180,
                height: 180,
                colorDark: "#002447",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (e) {
            console.error("Error creating QR Code:", e);
        }
    }
}

if (showMyQrBtn) {
    showMyQrBtn.onclick = () => {
        getUserName();
        if (!currentUser) {
            swal("Login First!", "Please log in to view your FacePay QR.", "warning");
            return;
        }
        renderMyQrCode();
        if (myQrModal) myQrModal.classList.replace('hide', 'unhide');
    };
}

if (myQrCustomAmount) {
    myQrCustomAmount.addEventListener('input', () => {
        renderMyQrCode();
    });
}

const hideMyQrModal = () => {
    if (myQrModal) myQrModal.classList.replace('unhide', 'hide');
};

if (closeMyQrModal) closeMyQrModal.onclick = hideMyQrModal;
if (closeMyQrBtn) closeMyQrBtn.onclick = hideMyQrModal;

//-----------------------------TRANSACTION HISTORY MODAL----------------------------//
async function loadTransactionHistory() {
    getUserName();
    if (!currentUser || !currentUser.email) return;

    if (txnsListContainer) {
        txnsListContainer.innerHTML = '<p style="text-align: center; color: #64748b; font-size: 13px; padding: 20px 0;">Loading transactions...</p>';
    }

    try {
        const res = await fetch('/api/transactions/' + encodeURIComponent(currentUser.email));
        const data = await res.json();

        if (!data.success || !data.transactions || data.transactions.length === 0) {
            txnsListContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 13px; padding: 25px 0;">No transactions recorded yet.</p>';
            return;
        }

        const userCleanEmail = currentUser.email.toLowerCase().replace(/[\.#$\[\]]/g, '');

        txnsListContainer.innerHTML = data.transactions.map(t => {
            const isSender = t.senderEmail && t.senderEmail.toLowerCase().replace(/[\.#$\[\]]/g, '') === userCleanEmail;
            const amountPrefix = isSender ? '-' : '+';
            const amountClass = isSender ? 'sent' : 'received';
            const iconClass = isSender ? 'sent' : 'received';
            const iconSymbol = isSender ? '↗' : '↙';
            const counterparty = isSender ? `Paid to: ${t.recipientName || t.recipientId}` : `Received from: ${t.senderName || t.senderEmail}`;

            return `
                <div class="txn-card-item">
                    <div class="txn-item-left">
                        <div class="txn-icon-pill ${iconClass}">${iconSymbol}</div>
                        <div>
                            <span class="txn-meta-name">${counterparty}</span>
                            <span class="txn-meta-sub">${t.formattedDate || t.timestamp.slice(0,10)} &bull; ${t.paymentMethod || 'FacePay'}</span>
                        </div>
                    </div>
                    <div class="txn-item-right">
                        <span class="txn-amount-text ${amountClass}">${amountPrefix}${formatCurrency(t.amount)}</span>
                        <div class="txn-id-sub">${t.transactionId}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error("Error fetching transactions:", e);
        txnsListContainer.innerHTML = '<p style="text-align: center; color: #ef4444; font-size: 13px; padding: 20px 0;">Failed to load transactions.</p>';
    }
}

if (viewTxnsBtn) {
    viewTxnsBtn.onclick = () => {
        getUserName();
        if (!currentUser) {
            swal("Login First!", "Please log in to view transaction history.", "warning");
            return;
        }
        loadTransactionHistory();
        if (transactionsModal) transactionsModal.classList.replace('hide', 'unhide');
    };
}

const hideTxnsModal = () => {
    if (transactionsModal) transactionsModal.classList.replace('unhide', 'hide');
};

if (closeTxnsModal) closeTxnsModal.onclick = hideTxnsModal;
if (closeTxnsBtn) closeTxnsBtn.onclick = hideTxnsModal;

//-----------------------------HOME "NEXT" BUTTON (WALLET / BANK)----------------------------//
const clickHomeNextBtn = () => {
    getUserName();
    if (!currentUser) {
        window.location.href = "./src/login.html";
        return;
    }

    if (activeTab === 'wallet') {
        const phone = walletPhoneInp ? walletPhoneInp.value.trim() : '';
        const payId = walletPayIdInp ? walletPayIdInp.value.trim() : '';
        const amount = walletAmountInp ? Number(walletAmountInp.value) : 0;

        if (!phone && !payId) {
            swal("Missing Recipient", "Please enter a recipient Mobile Number or FacePay-ID.", "warning");
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            swal("Invalid Amount", "Please enter a valid amount greater than zero.", "warning");
            return;
        }

        openPaymentConfirmation({
            recipientId: payId || (phone + "@facepay"),
            recipientName: payId ? payId.split('@')[0] : "FacePay User",
            mobile: phone,
            amount: amount,
            paymentMethod: "FacePay Wallet Transfer",
            paymentType: "wallet"
        });
    } else if (activeTab === 'bank') {
        const name = bankNameInp ? bankNameInp.value.trim() : '';
        const acc = bankAccInp ? bankAccInp.value.trim() : '';
        const ifsc = bankIfscInp ? bankIfscInp.value.trim() : '';
        const amount = bankAmountInp ? Number(bankAmountInp.value) : 0;

        if (!name || !acc || !ifsc) {
            swal("Missing Details", "Please fill beneficiary name, account number, and IFSC code.", "warning");
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            swal("Invalid Amount", "Please enter a valid amount greater than zero.", "warning");
            return;
        }

        openPaymentConfirmation({
            recipientId: "ACC:" + acc.slice(-4),
            recipientName: name,
            mobile: "",
            amount: amount,
            paymentMethod: "Bank Transfer",
            paymentType: "bank"
        });
    }
};

//-----------------------------------BALANCE MODAL CONTROLLER----------------------------------//
const modalAccNumber = document.getElementById('modalAccNumber');
const modalAccHolder = document.getElementById('modalAccHolder');
const modalFacePayId = document.getElementById('modalFacePayId');
const modalBankBalance = document.getElementById('modalBankBalance');
const modalWalletBalance = document.getElementById('modalWalletBalance');

function updateBalanceUI(user) {
    if (!user) return;
    if (modalAccHolder) modalAccHolder.innerText = user.fullname || user.username || 'User';
    if (modalFacePayId) modalFacePayId.innerText = user.facepayId || ((user.phone || '9876543210') + '@facepay');

    const rawAcc = user.accountNumber || ("50100" + (user.phone ? user.phone.replace(/\D/g, '').slice(-6) : "489210"));
    const maskedAcc = "•••• •••• " + rawAcc.slice(-4);
    if (modalAccNumber) modalAccNumber.innerText = maskedAcc;

    const bankBal = user.bankBalance !== undefined ? user.bankBalance : 50000;
    const walletBal = user.walletBalance !== undefined ? user.walletBalance : 5000;

    if (modalBankBalance) modalBankBalance.innerText = formatCurrency(bankBal);
    if (modalWalletBalance) modalWalletBalance.innerText = formatCurrency(walletBal);
}

async function fetchLatestUserData() {
    getUserName();
    if (!currentUser || !currentUser.email) return currentUser;

    try {
        const res = await fetch('/api/users/' + encodeURIComponent(currentUser.email));
        if (res.ok) {
            const data = await res.json();
            if (data && data.exists && data.user) {
                currentUser = data.user;
                if (keepLoggedIn == "yes") {
                    localStorage.setItem('user', JSON.stringify(currentUser));
                } else {
                    sessionStorage.setItem('user', JSON.stringify(currentUser));
                }
            }
        }
    } catch (e) {
        console.log("Could not fetch latest balance from server:", e);
    }
    return currentUser;
}

if (balanceBtn) {
    balanceBtn.onclick = async () => {
        getUserName();
        if (!currentUser) return;
        updateBalanceUI(currentUser);
        if (balanceModal) balanceModal.classList.replace('hide', 'unhide');
        const latestUser = await fetchLatestUserData();
        updateBalanceUI(latestUser);
    };
}

const hideBalanceModal = () => {
    if (balanceModal) balanceModal.classList.replace('unhide', 'hide');
};

if (closeBalanceModal) closeBalanceModal.onclick = hideBalanceModal;
if (doneBalanceBtn) doneBalanceBtn.onclick = hideBalanceModal;

if (balanceModal) {
    balanceModal.onclick = (e) => {
        if (e.target === balanceModal) hideBalanceModal();
    };
}

if (refreshBalanceBtn) {
    refreshBalanceBtn.onclick = async () => {
        if (refreshSpinner) refreshSpinner.classList.add('rotating');
        const latestUser = await fetchLatestUserData();
        updateBalanceUI(latestUser);
        setTimeout(() => {
            if (refreshSpinner) refreshSpinner.classList.remove('rotating');
        }, 600);
    };
}

// Auto-open transactions modal if redirected from receipt page
if (sessionStorage.getItem('openTransactionsOnHome') === 'true') {
    sessionStorage.removeItem('openTransactionsOnHome');
    setTimeout(() => {
        if (viewTxnsBtn) viewTxnsBtn.click();
    }, 300);
}

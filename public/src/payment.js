sessionStorage.setItem('proceedFromHomeButtonOnly', 'false');

const clickHomeBtn = () => {
    window.location.replace('../index.html');
};

const clickTxnsBtn = () => {
    sessionStorage.setItem('openTransactionsOnHome', 'true');
    window.location.replace('../index.html');
};

const payFromFacePageOnly = sessionStorage.getItem('payFromFacePageOnly');
if (payFromFacePageOnly === "false") {
    window.location.href = "../index.html";
}

const faceVerified = sessionStorage.getItem('faceVerified');
const paymentStatus = sessionStorage.getItem('paymentStatus');

const successView = document.getElementById('success-view');
const failureView = document.getElementById('failure-view');

const receiptAmount = document.getElementById('receipt-amount');
const receiptRecipient = document.getElementById('receipt-recipient');
const receiptPayId = document.getElementById('receipt-payid');
const receiptTxnId = document.getElementById('receipt-txnid');
const receiptMethod = document.getElementById('receipt-method');
const receiptTimestamp = document.getElementById('receipt-timestamp');

if (faceVerified === "false" || (paymentStatus && paymentStatus !== "SUCCESS")) {
    if (successView) successView.classList.add('hide');
    if (failureView) failureView.classList.remove('hide');
} else {
    if (successView) successView.classList.remove('hide');
    if (failureView) failureView.classList.add('hide');

    let txn = null;
    try {
        txn = JSON.parse(sessionStorage.getItem('lastCompletedTransaction') || 'null');
    } catch (e) {}

    if (txn) {
        const numAmt = Number(txn.amount) || 0;
        if (receiptAmount) receiptAmount.innerText = '₹' + numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (receiptRecipient) receiptRecipient.innerText = txn.recipientName || 'Merchant';
        if (receiptPayId) receiptPayId.innerText = txn.recipientId || (txn.recipientPhone ? txn.recipientPhone + '@facepay' : 'FP-MERCHANT');
        if (receiptTxnId) receiptTxnId.innerText = txn.transactionId || ('FP-TXN-' + Date.now());
        if (receiptMethod) receiptMethod.innerText = txn.paymentMethod || 'RAZORPAY TEST MODE + FACE';
        if (receiptTimestamp) receiptTimestamp.innerText = txn.formattedDate || new Date().toLocaleString('en-IN');
    }
}
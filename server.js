const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret_placeholder'
});

// Keep the raw body so the Razorpay webhook signature can be verified safely.
// Middleware for parsing JSON and urlencoded requests
app.use(express.json({
    limit: '50mb',
    verify: (req, res, buffer) => {
        req.rawBody = Buffer.from(buffer);
    }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving
const basePath = path.join(__dirname, './public');
app.use(express.static(basePath));

// Data storage setup
const dataDir = path.join(__dirname, './data');
const usersFilePath = path.join(dataDir, 'users.json');
const txnsFilePath = path.join(dataDir, 'transactions.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function cleanEmail(email) {
    if (!email) return '';
    return email.toLowerCase()
        .replaceAll('.', '')
        .replaceAll('#', '')
        .replaceAll('$', '')
        .replaceAll('[', '')
        .replaceAll(']', '')
        .trim();
}

function getSeedMerchants() {
    return {
        "iblock-canteen@facepay.invalid": {
            fullname: "I-Block Canteen",
            username: "iblock-canteen",
            email: "iblock-canteen@facepay.invalid",
            merchantId: "IBLOCK_CANTEEN",
            upiId: "IBLOCK_CANTEEN@facepay",
            facepayId: "IBLOCK_CANTEEN@facepay",
            walletBalance: 0,
            profileImgURL: "null",
            isMerchant: true,
            createdAt: new Date().toISOString()
        },
        "dblock-canteen@facepay.invalid": {
            fullname: "D-Block Canteen",
            username: "dblock-canteen",
            email: "dblock-canteen@facepay.invalid",
            merchantId: "DBLOCK_CANTEEN",
            upiId: "DBLOCK_CANTEEN@facepay",
            facepayId: "DBLOCK_CANTEEN@facepay",
            walletBalance: 0,
            profileImgURL: "null",
            isMerchant: true,
            createdAt: new Date().toISOString()
        },
        "readers@facepay.invalid": {
            fullname: "Readers",
            username: "readers",
            email: "readers@facepay.invalid",
            merchantId: "READERS",
            upiId: "READERS@facepay",
            facepayId: "READERS@facepay",
            walletBalance: 0,
            profileImgURL: "null",
            isMerchant: true,
            createdAt: new Date().toISOString()
        },
        "canteen@campusedu": {
            fullname: "Campus Canteen",
            username: "canteen",
            email: "canteen@campus.edu",
            phone: "9876543210",
            upiId: "FP-CANTEEN-001",
            facepayId: "FP-CANTEEN-001", // Backward compatibility alias
            bankBalance: 25000.00,
            walletBalance: 10000.00,
            accountNumber: "50100987654",
            profileImgURL: "null",
            isMerchant: true,
            createdAt: new Date().toISOString()
        },
        "bookstore@campusedu": {
            fullname: "Campus Book Store",
            username: "bookstore",
            email: "bookstore@campus.edu",
            phone: "9876543211",
            upiId: "FP-BOOKSTORE-002",
            facepayId: "FP-BOOKSTORE-002", // Backward compatibility alias
            bankBalance: 15000.00,
            walletBalance: 8000.00,
            accountNumber: "50100987655",
            profileImgURL: "null",
            isMerchant: true,
            createdAt: new Date().toISOString()
        }
    };
}

function loadUsers() {
    try {
        if (!fs.existsSync(usersFilePath)) {
            const seed = getSeedMerchants();
            fs.writeFileSync(usersFilePath, JSON.stringify(seed, null, 2));
            return seed;
        }
        const data = fs.readFileSync(usersFilePath, 'utf8');
        const users = JSON.parse(data || '{}');

        let updated = false;

        // Auto-migration: ensure all users have upiId and backward-compatible facepayId
        for (const [key, user] of Object.entries(users)) {
            if (!user.upiId) {
                user.upiId = user.facepayId || (user.phone ? user.phone.replace(/\D/g, '') + "@facepay" : "FP" + Math.floor(100000 + Math.random() * 900000) + "@facepay");
                updated = true;
            }
            if (!user.facepayId) {
                user.facepayId = user.upiId;
                updated = true;
            }
        }

        // Ensure default merchants exist in database
        const seed = getSeedMerchants();
        for (const [key, merchant] of Object.entries(seed)) {
            if (!users[key]) {
                users[key] = merchant;
                updated = true;
            }
        }
        if (updated) {
            saveUsers(users);
        }
        return users;
    } catch (err) {
        console.error('Error reading users database:', err);
        return getSeedMerchants();
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing to users database:', err);
        return false;
    }
}

function loadTransactions() {
    try {
        if (!fs.existsSync(txnsFilePath)) {
            fs.writeFileSync(txnsFilePath, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(txnsFilePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('Error reading transactions:', err);
        return [];
    }
}

function saveTransactions(transactions) {
    try {
        fs.writeFileSync(txnsFilePath, JSON.stringify(transactions, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing transactions:', err);
        return false;
    }
}

function findUserByIdOrEmail(query, users) {
    if (!query) return null;
    const cleanQ = cleanEmail(query);
    if (users[cleanQ]) return users[cleanQ];

    const rawQ = query.trim().toLowerCase();
    for (const user of Object.values(users)) {
        if (user.email && user.email.toLowerCase() === rawQ) return user;
        if (user.merchantId && user.merchantId.toLowerCase() === rawQ) return user;
        if (user.upiId && user.upiId.toLowerCase() === rawQ) return user;
        if (user.facepayId && user.facepayId.toLowerCase() === rawQ) return user;
        if (user.fullname && user.fullname.toLowerCase() === rawQ) return user;
        if (user.phone && user.phone.replace(/\D/g, '') === rawQ.replace(/\D/g, '')) return user;
        if (user.username && user.username.toLowerCase() === rawQ) return user;
        if (user.phone && `${user.phone}@facepay`.toLowerCase() === rawQ) return user;
    }
    return null;
}

const MAX_RAZORPAY_AMOUNT_INR = 100000;

function hasRazorpayCredentials() {
    return Boolean(
        process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET &&
        !process.env.RAZORPAY_KEY_ID.startsWith('your_') &&
        !process.env.RAZORPAY_KEY_SECRET.startsWith('your_')
    );
}

function getPaymentUser(email, users) {
    if (!email) return null;
    return users[cleanEmail(email)] || null;
}

function resolvePaymentRecipient(recipientId, recipientUpiId, recipientPhone, recipientName, users) {
    for (const identifier of [recipientUpiId, recipientId, recipientPhone, recipientName]) {
        const recipient = findUserByIdOrEmail(identifier, users);
        if (recipient) return recipient;
    }
    return null;
}

function makeTransactionId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `FP-RZP-${dateStr}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function findTransactionByOrderId(orderId, transactions) {
    return transactions.find(transaction => transaction.razorpayOrderId === orderId);
}

function updateTransaction(transactionId, changes) {
    const transactions = loadTransactions();
    const index = transactions.findIndex(transaction => transaction.transactionId === transactionId);
    if (index === -1) return null;
    transactions[index] = { ...transactions[index], ...changes, updatedAt: new Date().toISOString() };
    if (!saveTransactions(transactions)) return null;
    return transactions[index];
}

async function saveTransactionToFirebase(transaction) {
    const databaseUrl = process.env.FIREBASE_DATABASE_URL || 'https://facepay-2c2a2-default-rtdb.asia-southeast1.firebasedatabase.app';
    const endpoint = `${databaseUrl.replace(/\/$/, '')}/Transactions/${encodeURIComponent(transaction.transactionId)}.json`;

    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
        });
        return response.ok;
    } catch (error) {
        console.error('Firebase transaction sync failed:', error.message);
        return false;
    }
}

function verifySignature(orderId, paymentId, signature, secret) {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    const actualBuffer = Buffer.from(String(signature || ''), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    const actualBuffer = Buffer.from(String(signature), 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Demo merchants
app.get('/api/demo-merchants', (req, res) => {
    const users = loadUsers();
    const merchants = Object.values(users).filter(u => u.isMerchant);
    res.json({ merchants });
});

// Create a Razorpay test order after validating the existing FacePay user and recipient.
app.post('/api/payment/create-order', async (req, res) => {
    const {
        senderEmail,
        recipientId,
        recipientUpiId,
        recipientPhone,
        recipientName,
        amount,
        currency = 'INR',
        description = 'FacePay payment'
    } = req.body;
    const numAmount = Number(amount);

    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > MAX_RAZORPAY_AMOUNT_INR) {
        return res.status(400).json({ success: false, message: `Enter an amount between ₹1 and ₹${MAX_RAZORPAY_AMOUNT_INR.toLocaleString('en-IN')}.` });
    }
    if (currency !== 'INR') {
        return res.status(400).json({ success: false, message: 'Only INR payments are supported.' });
    }
    if (!hasRazorpayCredentials()) {
        return res.status(503).json({ success: false, message: 'Razorpay test credentials are not configured on the server.' });
    }

    const users = loadUsers();
    const sender = getPaymentUser(senderEmail, users);
    if (!sender) return res.status(401).json({ success: false, message: 'Logged-in sender account not found.' });

    const recipient = resolvePaymentRecipient(recipientId, recipientUpiId, recipientPhone, recipientName, users);
    if (!recipient) return res.status(404).json({ success: false, message: 'This recipient is not linked to a FacePay payment account.' });
    if (cleanEmail(sender.email) === cleanEmail(recipient.email)) {
        return res.status(400).json({ success: false, message: 'Cannot pay your own account.' });
    }

    try {
        const order = await razorpay.orders.create({
            amount: Math.round(numAmount * 100),
            currency: 'INR',
            receipt: makeTransactionId(),
            notes: { recipientUpiId: recipient.upiId || recipient.facepayId || '' }
        });
        const transaction = {
            transactionId: order.receipt,
            razorpayOrderId: order.id,
            senderUserId: sender.email,
            senderEmail: sender.email,
            senderName: sender.fullname || sender.username,
            recipientUserId: recipient.email,
            recipientUpiId: recipient.upiId || recipient.facepayId,
            recipientName: recipient.fullname || recipient.username,
            amount: numAmount,
            currency: 'INR',
            description,
            paymentMethod: 'RAZORPAY TEST MODE',
            authenticationMethod: 'FACE',
            status: 'RAZORPAY_ORDER_CREATED',
            timestamp: new Date().toISOString()
        };
        const transactions = loadTransactions();
        transactions.unshift(transaction);
        if (!saveTransactions(transactions)) {
            return res.status(500).json({ success: false, message: 'Unable to save payment state.' });
        }
        return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID || '',
            transactionId: transaction.transactionId,
            testMode: true
        });
    } catch (error) {
        console.error('Razorpay order creation failed:', error.message);
        return res.status(502).json({ success: false, message: 'Razorpay could not create the payment order.' });
    }
});

// Verify checkout response server-side before marking a FacePay transaction successful.
app.post('/api/payment/verify', async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
    if (!orderId || !paymentId || !signature) {
        return res.status(400).json({ success: false, message: 'Incomplete Razorpay payment response.' });
    }
    if (!hasRazorpayCredentials()) {
        return res.status(503).json({ success: false, message: 'Razorpay test credentials are not configured on the server.' });
    }
    if (!verifySignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET)) {
        return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    const existing = findTransactionByOrderId(orderId, loadTransactions());
    if (!existing) return res.status(404).json({ success: false, message: 'FacePay payment order was not found.' });
    if (existing.status === 'SUCCESS' && existing.razorpayPaymentId === paymentId) {
        return res.json({ success: true, transaction: existing, duplicate: true });
    }

    try {
        const payment = await razorpay.payments.fetch(paymentId);
        if (payment.order_id !== orderId) return res.status(400).json({ success: false, message: 'Payment does not match the FacePay order.' });
        const paymentStatus = String(payment.status || '').toLowerCase();
        if (!['captured', 'authorized'].includes(paymentStatus)) {
            const failed = updateTransaction(existing.transactionId, { razorpayPaymentId: paymentId, status: 'FAILED', failureReason: `Razorpay status: ${payment.status}` });
            return res.status(400).json({ success: false, message: 'Razorpay has not confirmed this payment.', transaction: failed });
        }

        const status = paymentStatus === 'captured' ? 'SUCCESS' : 'AUTHORIZED';
        const transaction = updateTransaction(existing.transactionId, {
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
            status,
            paymentStatus: payment.status,
            verifiedAt: new Date().toISOString()
        });
        const firebaseSynced = status === 'SUCCESS' ? await saveTransactionToFirebase(transaction) : false;
        return res.json({ success: status === 'SUCCESS', transaction, firebaseSynced });
    } catch (error) {
        console.error('Razorpay payment verification failed:', error.message);
        return res.status(502).json({ success: false, message: 'Payment verification is temporarily unavailable.' });
    }
});

// Razorpay webhook endpoint. express.json captured req.rawBody above for HMAC validation.
app.post('/api/payment/webhook', async (req, res) => {
    const signature = req.get('X-Razorpay-Signature');
    if (!verifyWebhookSignature(req.rawBody, signature)) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const eventId = req.get('x-razorpay-event-id') || req.body?.event_id;
    const paymentEntity = req.body?.payload?.payment?.entity;
    if (!paymentEntity?.order_id) return res.json({ success: true, ignored: true });

    const transactions = loadTransactions();
    const transaction = findTransactionByOrderId(paymentEntity.order_id, transactions);
    if (!transaction) return res.json({ success: true, ignored: true });
    if (eventId && transaction.webhookEventIds?.includes(eventId)) return res.json({ success: true, duplicate: true });

    const eventName = req.body?.event;
    let status = transaction.status;
    if (eventName === 'payment.authorized') status = 'AUTHORIZED';
    if (eventName === 'payment.captured') status = 'SUCCESS';
    if (eventName === 'payment.failed') status = 'FAILED';

    const webhookEventIds = eventId ? [...(transaction.webhookEventIds || []), eventId] : transaction.webhookEventIds;
    const updated = updateTransaction(transaction.transactionId, {
        razorpayPaymentId: paymentEntity.id,
        paymentStatus: paymentEntity.status,
        status,
        webhookEventIds
    });
    if (updated && status === 'SUCCESS') await saveTransactionToFirebase(updated);
    return res.json({ success: true });
});

// Return a safe client error for malformed JSON instead of exposing a parser stack trace.
app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Request body must contain valid JSON.' });
    }
    return next(err);
});

// Check/Get user by email, UPI ID, phone, or username
app.get('/api/users/:identifier', (req, res) => {
    const identifier = req.params.identifier;
    const users = loadUsers();
    const user = findUserByIdOrEmail(identifier, users);

    if (user) {
        if (user.bankBalance === undefined) user.bankBalance = 50000.00;
        if (user.walletBalance === undefined) user.walletBalance = 5000.00;
        if (!user.upiId) user.upiId = (user.phone ? user.phone.replace(/\D/g, '') : "FP" + Math.floor(100000 + Math.random() * 900000)) + "@facepay";
        if (!user.facepayId) user.facepayId = user.upiId;
        if (!user.accountNumber) user.accountNumber = "50100" + (user.phone ? user.phone.replace(/\D/g, '').slice(-6) : "489210");
        return res.json({ exists: true, user: user });
    }
    return res.json({ exists: false, message: 'User does not exist' });
});

// Register new user
app.post('/api/register', (req, res) => {
    const { fullname, username, email, phone, profileImgURL, faceTemplate, password, upiId } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const key = cleanEmail(email);
    const users = loadUsers();

    if (users[key]) {
        return res.status(400).json({ success: false, message: 'Account already exists!' });
    }

    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const generatedUpiId = upiId || (cleanPhone || 'FP' + Math.floor(100000 + Math.random() * 900000)) + '@facepay';

    const newUser = {
        fullname: fullname || '',
        username: username || '',
        email: email,
        phone: phone || '',
        upiId: generatedUpiId,
        facepayId: generatedUpiId, // Backward compatibility alias
        profileImgURL: profileImgURL || 'null',
        faceTemplate: faceTemplate || null,
        bankBalance: 50000.00,
        walletBalance: 5000.00,
        accountNumber: "50100" + (cleanPhone ? cleanPhone.slice(-6) : "489210"),
        password: password,
        createdAt: new Date().toISOString()
    };

    users[key] = newUser;
    if (saveUsers(users)) {
        return res.json({ success: true, message: 'User added successfully!', user: newUser });
    } else {
        return res.status(500).json({ success: false, message: 'Failed to save user data on server' });
    }
});

// Update user profile
app.post('/api/update-profile', (req, res) => {
    const { email, profileImgURL, fullname, phone, username, faceTemplate, upiId, facepayId } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const key = cleanEmail(email);
    const users = loadUsers();

    if (!users[key]) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (profileImgURL !== undefined) users[key].profileImgURL = profileImgURL;
    if (fullname !== undefined) users[key].fullname = fullname;
    if (phone !== undefined) users[key].phone = phone;
    if (username !== undefined) users[key].username = username;
    if (faceTemplate !== undefined) users[key].faceTemplate = faceTemplate;
    if (upiId !== undefined) {
        users[key].upiId = upiId;
        users[key].facepayId = upiId;
    } else if (facepayId !== undefined) {
        users[key].upiId = facepayId;
        users[key].facepayId = facepayId;
    }

    if (saveUsers(users)) {
        return res.json({ success: true, message: 'Profile updated successfully', user: users[key] });
    } else {
        return res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
});

// Atomic Process Payment
app.post('/api/process-payment', (req, res) => {
    const { senderEmail, recipientId, recipientUpiId, recipientName, recipientPhone, amount, paymentMethod, paymentType } = req.body;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid payment amount greater than zero.' });
    }

    const users = loadUsers();
    const senderKey = cleanEmail(senderEmail);
    const sender = users[senderKey];

    if (!sender) {
        return res.status(401).json({ success: false, message: 'Logged-in sender account not found.' });
    }

    // Identify recipient
    const recipient = findUserByIdOrEmail(recipientUpiId || recipientId || recipientPhone || recipientName, users);

    // Prevent paying to self
    if (recipient && cleanEmail(recipient.email) === senderKey) {
        return res.status(400).json({ success: false, message: 'Cannot transfer payment to your own account.' });
    }

    // Default balance fields if undefined
    if (sender.bankBalance === undefined) sender.bankBalance = 50000.00;
    if (sender.walletBalance === undefined) sender.walletBalance = 5000.00;

    const useWallet = (paymentType === 'wallet' || paymentMethod === 'Wallet' || paymentMethod === 'FacePay Wallet Transfer');
    const availableBalance = useWallet ? sender.walletBalance : sender.bankBalance;

    if (availableBalance < numAmount) {
        return res.status(400).json({
            success: false,
            message: 'Insufficient Balance. Your available balance is not enough to complete this payment.',
            availableBalance: availableBalance,
            requiredAmount: numAmount
        });
    }

    // Deduct from sender
    if (useWallet) {
        sender.walletBalance = Math.round((sender.walletBalance - numAmount) * 100) / 100;
    } else {
        sender.bankBalance = Math.round((sender.bankBalance - numAmount) * 100) / 100;
    }

    // Credit recipient if found
    if (recipient) {
        if (recipient.bankBalance === undefined) recipient.bankBalance = 50000.00;
        if (recipient.walletBalance === undefined) recipient.walletBalance = 5000.00;

        if (useWallet) {
            recipient.walletBalance = Math.round((recipient.walletBalance + numAmount) * 100) / 100;
        } else {
            recipient.bankBalance = Math.round((recipient.bankBalance + numAmount) * 100) / 100;
        }
    }

    // Generate unique transaction ID
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const transactionId = `FP-TXN-${dateStr}-${randomHex}`;

    const formattedDate = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const targetRecipientUpi = recipientUpiId || (recipient ? (recipient.upiId || recipient.facepayId) : (recipientId || (recipientPhone ? recipientPhone + '@facepay' : 'FP-MERCHANT')));

    const txnRecord = {
        transactionId,
        senderEmail: sender.email,
        senderUpiId: sender.upiId || sender.facepayId || (sender.phone ? sender.phone + '@facepay' : sender.email),
        senderName: sender.fullname || sender.username,
        senderPhone: sender.phone || '',
        recipientId: recipientId || targetRecipientUpi,
        recipientUpiId: targetRecipientUpi,
        recipientName: recipientName || (recipient ? recipient.fullname : 'Recipient'),
        recipientPhone: recipientPhone || (recipient ? recipient.phone : ''),
        amount: numAmount,
        paymentMethod: paymentMethod || 'QR + Face Authentication',
        paymentType: useWallet ? 'FacePay Wallet' : 'Bank Transfer',
        timestamp: now.toISOString(),
        formattedDate: formattedDate,
        status: 'SUCCESS'
    };

    // Save users and transaction
    const transactions = loadTransactions();
    transactions.unshift(txnRecord); // Newest first

    if (saveUsers(users) && saveTransactions(transactions)) {
        return res.json({
            success: true,
            message: 'Payment processed successfully!',
            transaction: txnRecord,
            updatedBalances: {
                bankBalance: sender.bankBalance,
                walletBalance: sender.walletBalance
            },
            sender: sender
        });
    } else {
        return res.status(500).json({ success: false, message: 'Server error processing transaction record.' });
    }
});

// Transaction history for user
app.get('/api/transactions/:email', (req, res) => {
    const email = req.params.email;
    const clean = cleanEmail(email);
    const transactions = loadTransactions();
    const userTxns = transactions.filter(t =>
        cleanEmail(t.senderEmail) === clean ||
        cleanEmail(t.recipientId) === clean ||
        (t.senderUpiId && cleanEmail(t.senderUpiId) === clean) ||
        (t.recipientUpiId && cleanEmail(t.recipientUpiId) === clean) ||
        (t.recipientPhone && cleanEmail(t.recipientPhone) === clean)
    );
    res.json({ success: true, transactions: userTxns });
});

app.listen(port, (err) => {
    if (err) console.log("Something went wrong!", err);
    console.log("Server is running on port " + port + "...");
});

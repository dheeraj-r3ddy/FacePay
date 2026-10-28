import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/9.8.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    get,
    child
} from "https://www.gstatic.com/firebasejs/9.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAt7cQPn2FBBMPIvU1X59pOLuznEI_BQgM",
    authDomain: "facepay-2c2a2.firebaseapp.com",
    databaseURL: "https://facepay-2c2a2-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facepay-2c2a2",
    storageBucket: "facepay-2c2a2.firebasestorage.app",
    messagingSenderId: "485307834167",
    appId: "1:485307834167:web:dab077b1936d73c2bec4b2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function createMerchant(
    merchantId,
    merchantName
) {
    const merchantRef = ref(
        db,
        `Merchants/${merchantId}`
    );

    const snapshot = await get(
        child(ref(db), `Merchants/${merchantId}`)
    );

    if (snapshot.exists()) {
        console.log(`${merchantName} already exists.`);
        return;
    }

    await set(merchantRef, {
        merchantId: merchantId,
        merchantName: merchantName,
        role: "merchant",

        walletBalance: 0,

        qrData: `FACEPAY:MERCHANT:${merchantId}`,
        qrEnabled: true,

        accountStatus: "active",
        createdAt: new Date().toISOString()
    });

    console.log(`${merchantName} created successfully.`);
}

async function seedMerchants() {
    try {
        await createMerchant(
            "IBLOCK_CANTEEN",
            "I-Block Canteen"
        );

        await createMerchant(
            "DBLOCK_CANTEEN",
            "D-Block Canteen"
        );

        await createMerchant(
            "READERS",
            "Readers"
        );

        alert("Merchant accounts created successfully.");
    } catch (error) {
        console.error("Merchant creation failed:", error);

        alert(
            error.message ||
            "Unable to create merchant accounts."
        );
    }
}

seedMerchants();
import { Client, Account, Databases, Storage, ID } from 'appwrite';

// Initialize Appwrite client
const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1') // Replace with your Appwrite endpoint
    .setProject('YOUR_APPWRITE_PROJECT_ID'); // Replace with your project ID

// Export Appwrite services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Export database constants
export const DATABASE_ID = 'facepay'; // Replace with your database ID
export const USERS_COLLECTION_ID = 'users';
export const TRANSACTIONS_COLLECTION_ID = 'transactions';
export const FACE_BUCKET_ID = 'face-images'; // Replace with your bucket ID

// Helper function for unique IDs
export const uniqueId = () => ID.unique();
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDIEdEbbJNQFJc9mFSSM7uXV4egt37Isw4",
  authDomain: "memoria-app-26.firebaseapp.com",
  projectId: "memoria-app-26",
  storageBucket: "memoria-app-26.firebasestorage.app",
  messagingSenderId: "390610627242",
  appId: "1:390610627242:web:af414bebdace5e882bbed3"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

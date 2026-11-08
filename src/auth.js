/** Google sign-in via Firebase Auth (same project as wiiwave.com, so it is the same account). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Public web config (not secrets) — identical to wiiwave.com's.
const app = initializeApp({
  apiKey: 'AIzaSyCZFEqAg_7MV--G7bDRYRJe1itUGG94-iQ',
  authDomain: 'wciivawe.firebaseapp.com',
  projectId: 'wciivawe',
});
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const onUser = (cb) => onAuthStateChanged(auth, cb);
export const currentUser = () => auth.currentUser;
export const getIdToken = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null);
export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);

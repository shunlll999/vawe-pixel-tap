/** Google sign-in via Firebase Auth (same project as wiiwave.com, so it is the same account). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
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

export const signInWithEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
/** Register with email + password and set the public display name (same flow as the wiiwave.com register page). */
export async function registerWithEmail(name, email, password) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await user.getIdToken(true); // refresh so the token carries the new name
  return user;
}

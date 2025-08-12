import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "../app.js";

const authSection = document.getElementById('auth-section');
const loginForm = document.getElementById('login-form');
const authError = document.getElementById('auth-error');
const authToggleLink = document.getElementById('auth-toggle-link');
const dashboardSection = document.getElementById('dashboard-section');

let isLoginView = true;

function toggleAuthView(showLogin) {
    isLoginView = showLogin;
    document.getElementById('auth-title').textContent = isLoginView ? 'Login' : 'Create Account';
    document.getElementById('auth-submit-btn').textContent = isLoginView ? 'Login' : 'Sign Up';
    document.getElementById('auth-toggle-prompt').textContent = isLoginView ? "No account?" : "Already have an account?";
    authToggleLink.textContent = isLoginView ? 'Create one' : 'Login';
    authError.textContent = '';
}

function handleLoginFormSubmit(e) {
    e.preventDefault();
    authError.textContent = '';
    const email = e.target['login-email'].value;
    const password = e.target['login-password'].value;
    try {
        if (isLoginView) signInWithEmailAndPassword(auth, email, password);
        else createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        authError.textContent = "Error: " + error.message;
    }
}

export function initAuth(onLogin, onLogout) {
    toggleAuthView(true);
    authToggleLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthView(!isLoginView); });
    loginForm.addEventListener('submit', handleLoginFormSubmit);

    onAuthStateChanged(auth, user => {
        if (user) {
            authSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            onLogin(user.uid);
        } else {
            authSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
            onLogout();
        }
    });
}

export function logout() {
    signOut(auth);
}
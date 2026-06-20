import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    updateProfile,
    sendEmailVerification,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    updateDoc, 
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// =====================
// Toast Notification System
// =====================
const toastContainer = document.getElementById('toast-container');

function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hiding');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// =====================
// Firebase Error Messages
// =====================
function getFriendlyError(code) {
    const messages = {
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Incorrect email or password. Please try again.',
        'auth/email-already-in-use': 'This email is already registered. Try logging in!',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/popup-closed-by-user': 'Sign-in was cancelled.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    };
    return messages[code] || 'Something went wrong. Please try again.';
}

// =====================
// DOM Elements
// =====================
const landingSection = document.getElementById('landing-section');
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const nameGroup = document.getElementById('name-group');
const authName = document.getElementById('name');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const toggleAuth = document.getElementById('toggle-auth');
const toggleText = document.getElementById('toggle-text');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const ideasList = document.getElementById('ideas-list');
const addIdeaBtn = document.getElementById('add-idea-btn');
const ideaModal = document.getElementById('idea-modal');
const ideaForm = document.getElementById('idea-form');
const modalTitle = document.getElementById('modal-title');
const backToLandingBtn = document.querySelector('.back-to-landing');
const showAuthBtns = document.querySelectorAll('.show-auth-btn');
const googleAuthBtn = document.getElementById('google-auth-btn');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const resetPasswordModal = document.getElementById('reset-password-modal');
const resetPasswordForm = document.getElementById('reset-password-form');
const resetSubmitBtn = document.getElementById('reset-submit-btn');
const verificationBanner = document.getElementById('verification-banner');
const resendVerificationBtn = document.getElementById('resend-verification-btn');

let isLogin = true;
let currentUser = null;
let unsubscribeIdeas = null;

// =====================
// Close Modal Logic (handles both modals)
// =====================
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        ideaModal.classList.add('hidden');
        resetPasswordModal.classList.add('hidden');
    });
});

window.addEventListener('click', (e) => {
    if (e.target === ideaModal) ideaModal.classList.add('hidden');
    if (e.target === resetPasswordModal) resetPasswordModal.classList.add('hidden');
});

// =====================
// Auth State Listener
// =====================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showSection('dashboard');
        userEmailSpan.textContent = user.displayName ? `${user.displayName} (${user.email})` : user.email;

        // Show verification banner if email is not verified
        if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
            verificationBanner.classList.remove('hidden');
        } else {
            verificationBanner.classList.add('hidden');
        }

        fetchIdeas();
    } else {
        currentUser = null;
        showSection('landing');
        if (unsubscribeIdeas) unsubscribeIdeas();
    }
});

// =====================
// Navigation Logic
// =====================
function showSection(sectionId) {
    [landingSection, authSection, dashboardSection].forEach(s => s.classList.add('hidden'));
    if (sectionId === 'landing') landingSection.classList.remove('hidden');
    else if (sectionId === 'auth') authSection.classList.remove('hidden');
    else if (sectionId === 'dashboard') dashboardSection.classList.remove('hidden');
}

showAuthBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setAuthMode(btn.getAttribute('data-mode') !== 'signup');
        showSection('auth');
    });
});

backToLandingBtn.addEventListener('click', () => showSection('landing'));

function setAuthMode(login) {
    isLogin = login;
    authTitle.textContent = isLogin ? 'Welcome Back' : 'Create Account';
    authSubtitle.textContent = isLogin ? 'Enter your details to access your ideas' : 'Start collecting your ideas today';
    authSubmitBtn.textContent = isLogin ? 'Login' : 'Sign Up';
    toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    toggleAuth.textContent = isLogin ? 'Sign Up' : 'Login';
    forgotPasswordLink.style.display = isLogin ? 'block' : 'none';

    if (isLogin) {
        nameGroup.classList.add('hidden');
        authName.required = false;
    } else {
        nameGroup.classList.remove('hidden');
        authName.required = true;
    }
}

toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(!isLogin);
});

// =====================
// Email/Password Auth
// =====================
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authForm.email.value;
    const password = authForm.password.value;
    const name = authName.value;

    authSubmitBtn.classList.add('loading');
    authSubmitBtn.disabled = true;

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: name });
            await sendEmailVerification(userCredential.user);
            showToast('Account created! Please check your inbox to verify your email.', 'success');
        }
        authForm.reset();
    } catch (error) {
        showToast(getFriendlyError(error.code), 'error');
    } finally {
        authSubmitBtn.classList.remove('loading');
        authSubmitBtn.disabled = false;
    }
});

// =====================
// Google Sign-In
// =====================
googleAuthBtn.addEventListener('click', async () => {
    googleAuthBtn.classList.add('loading');
    googleAuthBtn.disabled = true;
    try {
        await signInWithPopup(auth, googleProvider);
        showToast('Signed in with Google!', 'success');
    } catch (error) {
        showToast(getFriendlyError(error.code), 'error');
    } finally {
        googleAuthBtn.classList.remove('loading');
        googleAuthBtn.disabled = false;
    }
});

// =====================
// Forgot Password
// =====================
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    const emailVal = authForm.email.value;
    if (emailVal) document.getElementById('reset-email').value = emailVal;
    resetPasswordModal.classList.remove('hidden');
});

resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value;
    resetSubmitBtn.classList.add('loading');
    resetSubmitBtn.disabled = true;

    try {
        await sendPasswordResetEmail(auth, email);
        showToast(`Password reset link sent to ${email}!`, 'success');
        resetPasswordModal.classList.add('hidden');
        resetPasswordForm.reset();
    } catch (error) {
        showToast(getFriendlyError(error.code), 'error');
    } finally {
        resetSubmitBtn.classList.remove('loading');
        resetSubmitBtn.disabled = false;
    }
});

// =====================
// Resend Verification Email
// =====================
resendVerificationBtn.addEventListener('click', async () => {
    resendVerificationBtn.classList.add('loading');
    resendVerificationBtn.disabled = true;
    try {
        await sendEmailVerification(currentUser);
        showToast('Verification email resent! Check your inbox.', 'success');
    } catch (error) {
        showToast(getFriendlyError(error.code), 'error');
    } finally {
        resendVerificationBtn.classList.remove('loading');
        resendVerificationBtn.disabled = false;
    }
});

// =====================
// Logout
// =====================
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    showToast('You have been signed out.', 'info');
});

// =====================
// Fetch Ideas
// =====================
async function fetchIdeas() {
    const preferredQuery = query(
        collection(db, "ideas"), 
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    const setupListener = (q, isFallback = false) => {
        if (unsubscribeIdeas) unsubscribeIdeas();
        
        unsubscribeIdeas = onSnapshot(q, (snapshot) => {
            ideasList.innerHTML = '';
            if (snapshot.empty) {
                ideasList.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">✨</div>
                        <h3>Your collection is empty</h3>
                        <p>Every great project starts with a single spark. Add your first one!</p>
                    </div>`;
                return;
            }

            snapshot.forEach((docSnap) => {
                const idea = docSnap.data();
                const card = createIdeaCard(docSnap.id, idea);
                ideasList.appendChild(card);
            });

            if (isFallback) {
                const notice = document.createElement('div');
                notice.style.cssText = "grid-column: 1/-1; padding: 1rem; background: #fffbeb; color: #92400e; border-radius: 8px; margin-bottom: 1rem; font-size: 0.85rem; border: 1px solid #fef3c7;";
                notice.innerHTML = "<b>Note:</b> Sorting is disabled — a Firestore index is missing. <a href='https://console.firebase.google.com' target='_blank' style='color:inherit'>Create it in Firebase Console</a>.";
                ideasList.prepend(notice);
            }
        }, (error) => {
            console.error("Firestore Error:", error);
            if (error.code === 'failed-precondition' && !isFallback) {
                const fallbackQuery = query(collection(db, "ideas"), where("userId", "==", currentUser.uid));
                setupListener(fallbackQuery, true);
            } else {
                ideasList.innerHTML = `<div class="error-state"><h3>Error loading collection</h3><p>${error.message}</p></div>`;
            }
        });
    };

    setupListener(preferredQuery);
}

// =====================
// Idea Cards
// =====================
function createIdeaCard(id, idea) {
    const div = document.createElement('div');
    div.className = 'idea-card';

    const date = idea.createdAt ? new Date(idea.createdAt.seconds * 1000).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
    }) : 'Just now';

    div.innerHTML = `
        <span class="idea-tag tag-${idea.type}">${idea.type}</span>
        <h3>${escapeHtml(idea.title)}</h3>
        <p class="idea-content">${escapeHtml(idea.content || 'No description provided.')}</p>
        ${idea.url ? `<a href="${idea.url}" target="_blank" class="idea-url">🔗 ${escapeHtml(idea.url)}</a>` : ''}
        <div class="idea-footer">
            <span class="idea-date">${date}</span>
            <div class="idea-actions">
                <button class="btn btn-outline btn-sm edit-btn" data-id="${id}">Edit</button>
                <button class="btn btn-outline btn-sm btn-danger delete-btn" data-id="${id}">Delete</button>
            </div>
        </div>
    `;

    div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(id, idea));

    div.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete this spark? This action cannot be undone.')) {
            try {
                await deleteDoc(doc(db, "ideas", id));
                showToast('Spark deleted.', 'info');
            } catch (error) {
                showToast('Error deleting spark: ' + error.message, 'error');
            }
        }
    });

    return div;
}

// =====================
// Modal Logic
// =====================
addIdeaBtn.addEventListener('click', () => {
    modalTitle.textContent = 'New Spark';
    ideaForm.reset();
    document.getElementById('idea-id').value = '';
    document.querySelector('input[name="idea-type"][value="idea"]').checked = true;
    ideaModal.classList.remove('hidden');
});

function openEditModal(id, idea) {
    modalTitle.textContent = 'Edit Spark';
    document.getElementById('idea-id').value = id;
    document.getElementById('idea-title').value = idea.title;
    document.querySelector(`input[name="idea-type"][value="${idea.type}"]`).checked = true;
    document.getElementById('idea-content').value = idea.content || '';
    document.getElementById('idea-url').value = idea.url || '';
    ideaModal.classList.remove('hidden');
}

// =====================
// Save Idea
// =====================
ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('idea-id').value;
    const type = document.querySelector('input[name="idea-type"]:checked').value;
    const saveBtn = ideaForm.querySelector('button[type="submit"]');

    const ideaData = {
        title: document.getElementById('idea-title').value,
        type: type,
        content: document.getElementById('idea-content').value,
        url: document.getElementById('idea-url').value,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || 'Creator',
        updatedAt: serverTimestamp()
    };

    saveBtn.classList.add('loading');
    saveBtn.disabled = true;

    try {
        if (id) {
            await updateDoc(doc(db, "ideas", id), ideaData);
            showToast('Spark updated successfully!', 'success');
        } else {
            ideaData.createdAt = serverTimestamp();
            await addDoc(collection(db, "ideas"), ideaData);
            showToast('New spark saved!', 'success');
        }
        ideaModal.classList.add('hidden');
        ideaForm.reset();
    } catch (error) {
        showToast('Error saving: ' + error.message, 'error');
    } finally {
        saveBtn.classList.remove('loading');
        saveBtn.disabled = false;
    }
});

// =====================
// Utility
// =====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Set initial state
setAuthMode(true);

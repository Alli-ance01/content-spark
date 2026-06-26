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

// ─── Firebase Init ─────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ─── App State ─────────────────────────────────────────────────────────────────
let isLogin = true;
let currentUser = null;
let unsubscribeIdeas = null;
let allIdeas = [];          // Local cache of all Firestore docs
let activeFilter = 'all';
let activeSort = 'pinned-newest';
let searchQuery = '';
let currentTags = [];       // Tags being edited in the modal
let detailCurrentIdea = null;

// ─── DOM References ────────────────────────────────────────────────────────────
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
const confirmModal = document.getElementById('confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const sortSelect = document.getElementById('sort-select');
const exportBtn = document.getElementById('export-btn');
const exportModal = document.getElementById('export-modal');
const exportJsonBtn = document.getElementById('export-json-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportCancelBtn = document.getElementById('export-cancel-btn');
const detailModal = document.getElementById('detail-modal');
const profileModal = document.getElementById('profile-modal');
const profileForm = document.getElementById('profile-form');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileSubmitBtn = document.getElementById('profile-submit-btn');
const bulkActionsBar = document.getElementById('bulk-actions-bar');
const bulkSelectedCount = document.getElementById('bulk-selected-count');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const bulkCancelBtn = document.getElementById('bulk-cancel-btn');
let selectedIdeas = new Set();
const detailTitle = document.getElementById('detail-title');
const detailTypeTag = document.getElementById('detail-type-tag');
const detailContentText = document.getElementById('detail-content-text');
const detailUrl = document.getElementById('detail-url');
const detailTagsWrap = document.getElementById('detail-tags-wrap');
const detailDate = document.getElementById('detail-date');
const detailCopyBtn = document.getElementById('detail-copy-btn');
const detailEditBtn = document.getElementById('detail-edit-btn');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');
const userAvatar = document.getElementById('user-avatar');
const userInitials = document.getElementById('user-initials');
const titleInput = document.getElementById('idea-title');
const contentTextarea = document.getElementById('idea-content');
const titleCounter = document.getElementById('title-counter');
const contentCounter = document.getElementById('content-counter');
const tagInput = document.getElementById('tag-input');
const tagsPills = document.getElementById('tags-pills');
const toastContainer = document.getElementById('toast-container');

// ─── Toast Notifications ────────────────────────────────────────────────────────
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

// ─── Firebase Error Messages ────────────────────────────────────────────────────
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

// ─── Avatar Utilities ───────────────────────────────────────────────────────────
function getAvatarColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 42%)`;
}

function getInitials(user) {
    if (user.displayName) {
        const parts = user.displayName.trim().split(/\s+/);
        return parts.length > 1
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0].substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
}

// ─── Stats Bar ──────────────────────────────────────────────────────────────────
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function animateCount(el, target) {
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const duration = 600;
    const start = performance.now();
    const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(current + (target - current) * easeOut(progress));
        if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function updateStats() {
    animateCount(document.getElementById('stat-total'), allIdeas.length);
    animateCount(document.getElementById('stat-ideas'), allIdeas.filter(i => i.type === 'idea').length);
    animateCount(document.getElementById('stat-drafts'), allIdeas.filter(i => i.type === 'draft').length);
    animateCount(document.getElementById('stat-links'), allIdeas.filter(i => i.type === 'link').length);
    animateCount(document.getElementById('stat-pinned'), allIdeas.filter(i => i.pinned).length);
}

// ─── Rendering ──────────────────────────────────────────────────────────────────
function renderIdeas() {
    let filtered = [...allIdeas];

    // Filter by type
    if (activeFilter !== 'all') {
        filtered = filtered.filter(i => i.type === activeFilter);
    }

    // Search filter (title, content, tags)
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(i =>
            i.title.toLowerCase().includes(q) ||
            (i.content && i.content.toLowerCase().includes(q)) ||
            (i.tags && i.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    // Sort
    filtered = applySorting(filtered, activeSort);

    ideasList.innerHTML = '';

    if (filtered.length === 0) {
        const emptyHtml = (searchQuery || activeFilter !== 'all')
            ? `<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem">🔍</div><h3>No sparks found</h3><p>Try adjusting your search or filter.</p></div>`
            : `<div class="empty-state"><div style="font-size:3rem;margin-bottom:1rem">✨</div><h3>Your collection is empty</h3><p>Every great project starts with a single spark. Add your first one!</p></div>`;
        ideasList.innerHTML = emptyHtml;
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(idea => fragment.appendChild(createIdeaCard(idea.id, idea)));
    ideasList.appendChild(fragment);
}

function applySorting(ideas, sort) {
    const arr = [...ideas];
    switch (sort) {
        case 'pinned-newest':
            return arr.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
            });
        case 'newest':
            return arr.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        case 'oldest':
            return arr.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        case 'az':
            return arr.sort((a, b) => a.title.localeCompare(b.title));
        case 'za':
            return arr.sort((a, b) => b.title.localeCompare(a.title));
        default:
            return arr;
    }
}

// ─── Idea Card ──────────────────────────────────────────────────────────────────
const typeEmoji = { idea: '💡', draft: '📝', link: '🔗' };

function createIdeaCard(id, idea) {
    const div = document.createElement('div');
    div.className = `idea-card idea-card-${idea.type}${idea.pinned ? ' idea-card-pinned' : ''}`;

    const date = idea.createdAt
        ? new Date(idea.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Just now';

    let updatedHtml = '';
    if (idea.createdAt && idea.updatedAt && (idea.updatedAt.seconds - idea.createdAt.seconds > 60)) {
        updatedHtml = `<span class="idea-updated-at" title="Edited on ${new Date(idea.updatedAt.seconds * 1000).toLocaleDateString()}">(Edited)</span>`;
    }

    const tagsHtml = idea.tags?.length
        ? `<div class="card-tags">${idea.tags.map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

    div.innerHTML = `
        <input type="checkbox" class="card-checkbox" data-id="${id}">
        <div class="card-top">
            <span class="idea-tag tag-${idea.type}">${typeEmoji[idea.type] || ''} ${idea.type}</span>
            <button class="pin-btn${idea.pinned ? ' pinned' : ''}" data-id="${id}" title="${idea.pinned ? 'Unpin' : 'Pin to top'}">📌</button>
        </div>
        <h3>${escapeHtml(idea.title)}</h3>
        <p class="idea-content">${escapeHtml(idea.content || 'No description provided.')}</p>
        ${idea.url ? `<a href="${escapeHtml(idea.url)}" target="_blank" rel="noopener noreferrer" class="idea-url">🔗 ${escapeHtml(idea.url)}</a>` : ''}
        ${tagsHtml}
        <div class="idea-footer">
            <span class="idea-date">${date}${updatedHtml}</span>
            <div class="idea-actions">
                <button class="btn-icon copy-btn" title="Copy to clipboard">📋</button>
                <button class="btn btn-outline btn-sm edit-btn" data-id="${id}">Edit</button>
                <button class="btn btn-outline btn-sm btn-danger delete-btn" data-id="${id}">Delete</button>
            </div>
        </div>
    `;

    // Checkbox click
    const checkbox = div.querySelector('.card-checkbox');
    checkbox.checked = selectedIdeas.has(id);
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) selectedIdeas.add(id);
        else selectedIdeas.delete(id);
        updateBulkBar();
    });

    // Pin toggle
    div.querySelector('.pin-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
            await updateDoc(doc(db, 'ideas', id), { pinned: !idea.pinned });
            showToast(idea.pinned ? 'Unpinned.' : 'Pinned to top! 📌', 'success');
        } catch (err) {
            showToast('Could not update pin.', 'error');
        }
    });

    // Copy
    div.querySelector('.copy-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(`${idea.title}\n\n${idea.content || ''}`);
    });

    // Edit
    div.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(id, idea);
    });

    // Delete
    div.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirm();
        if (confirmed) {
            try {
                await deleteDoc(doc(db, 'ideas', id));
                showToast('Spark deleted.', 'info');
            } catch (error) {
                showToast('Error deleting spark: ' + error.message, 'error');
            }
        }
    });

    // Click card body → detail view
    div.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !e.target.closest('a')) {
            openDetailView(id, idea);
        }
    });

    return div;
}

// ─── Detail View ─────────────────────────────────────────────────────────────────
function openDetailView(id, idea) {
    detailCurrentIdea = { id, ...idea };

    detailTypeTag.className = `idea-tag tag-${idea.type}`;
    detailTypeTag.textContent = `${typeEmoji[idea.type] || ''} ${idea.type}`;
    detailTitle.textContent = idea.title;
    detailContentText.textContent = idea.content || 'No description provided.';

    if (idea.url) {
        detailUrl.href = idea.url;
        detailUrl.textContent = `🔗 ${idea.url}`;
        detailUrl.classList.remove('hidden');
    } else {
        detailUrl.classList.add('hidden');
    }

    if (idea.tags?.length) {
        detailTagsWrap.innerHTML = idea.tags.map(t => `<span class="card-tag">#${escapeHtml(t)}</span>`).join('');
        detailTagsWrap.classList.remove('hidden');
    } else {
        detailTagsWrap.classList.add('hidden');
    }

    const fullDate = idea.createdAt
        ? new Date(idea.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Just now';
    let updatedText = '';
    if (idea.createdAt && idea.updatedAt && (idea.updatedAt.seconds - idea.createdAt.seconds > 60)) {
        updatedText = ` • Edited ${new Date(idea.updatedAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
    detailDate.textContent = `Added ${fullDate}${updatedText}`;

    detailModal.classList.remove('hidden');
}

detailCopyBtn.addEventListener('click', () => {
    if (detailCurrentIdea) {
        copyToClipboard(`${detailCurrentIdea.title}\n\n${detailCurrentIdea.content || ''}`);
    }
});

detailEditBtn.addEventListener('click', () => {
    if (detailCurrentIdea) {
        detailModal.classList.add('hidden');
        openEditModal(detailCurrentIdea.id, detailCurrentIdea);
    }
});

// ─── Custom Confirm Dialog ───────────────────────────────────────────────────────
function showConfirm() {
    return new Promise((resolve) => {
        confirmModal.classList.remove('hidden');

        const cleanup = () => {
            confirmDeleteBtn.removeEventListener('click', onConfirm);
            confirmCancelBtn.removeEventListener('click', onCancel);
            confirmModal.removeEventListener('click', onBackdrop);
        };
        const onConfirm = () => { confirmModal.classList.add('hidden'); cleanup(); resolve(true); };
        const onCancel = () => { confirmModal.classList.add('hidden'); cleanup(); resolve(false); };
        const onBackdrop = (e) => { if (e.target === confirmModal) onCancel(); };

        confirmDeleteBtn.addEventListener('click', onConfirm);
        confirmCancelBtn.addEventListener('click', onCancel);
        confirmModal.addEventListener('click', onBackdrop);
    });
}

// ─── Close Modals ────────────────────────────────────────────────────────────────
function closeAllModals() {
    [ideaModal, resetPasswordModal, detailModal, exportModal, profileModal].forEach(m => m.classList.add('hidden'));
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
});

window.addEventListener('click', (e) => {
    if ([ideaModal, resetPasswordModal, detailModal, exportModal, profileModal].includes(e.target)) {
        e.target.classList.add('hidden');
    }
});

// ─── Profile Settings ─────────────────────────────────────────────────────────────
userAvatar.addEventListener('click', () => {
    if (!currentUser) return;
    profileName.value = currentUser.displayName || '';
    profileEmail.value = currentUser.email || '';
    profileModal.classList.remove('hidden');
});
userAvatar.classList.add('clickable');

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = profileName.value.trim();
    if (!newName) return;
    
    profileSubmitBtn.classList.add('loading');
    profileSubmitBtn.disabled = true;

    try {
        await updateProfile(currentUser, { displayName: newName });
        userInitials.textContent = getInitials(currentUser);
        userAvatar.title = `${newName} (${currentUser.email})`;
        showToast('Profile updated!', 'success');
        profileModal.classList.add('hidden');
    } catch (error) {
        showToast('Error updating profile.', 'error');
    } finally {
        profileSubmitBtn.classList.remove('loading');
        profileSubmitBtn.disabled = false;
    }
});

// ─── Bulk Actions ─────────────────────────────────────────────────────────────────
function updateBulkBar() {
    if (selectedIdeas.size > 0) {
        bulkSelectedCount.textContent = `${selectedIdeas.size} selected`;
        bulkActionsBar.classList.remove('hidden');
    } else {
        bulkActionsBar.classList.add('hidden');
    }
}

bulkCancelBtn.addEventListener('click', () => {
    selectedIdeas.clear();
    updateBulkBar();
    document.querySelectorAll('.card-checkbox').forEach(cb => cb.checked = false);
});

bulkDeleteBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm();
    if (confirmed) {
        bulkDeleteBtn.classList.add('loading');
        bulkDeleteBtn.disabled = true;
        let successCount = 0;
        try {
            for (const id of selectedIdeas) {
                await deleteDoc(doc(db, 'ideas', id));
                successCount++;
            }
            showToast(`Deleted ${successCount} sparks.`, 'success');
        } catch (error) {
            showToast('Error during bulk delete.', 'error');
        } finally {
            bulkDeleteBtn.classList.remove('loading');
            bulkDeleteBtn.disabled = false;
            selectedIdeas.clear();
            updateBulkBar();
        }
    }
});

// ─── Auth State ──────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showSection('dashboard');

        // Set avatar
        userInitials.textContent = getInitials(user);
        userAvatar.style.background = getAvatarColor(user.uid);
        userAvatar.title = user.displayName ? `${user.displayName} (${user.email})` : user.email;

        if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
            verificationBanner.classList.remove('hidden');
        } else {
            verificationBanner.classList.add('hidden');
        }

        fetchIdeas();
    } else {
        currentUser = null;
        allIdeas = [];
        showSection('landing');
        if (unsubscribeIdeas) unsubscribeIdeas();
    }
});

// ─── Navigation ──────────────────────────────────────────────────────────────────
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
    toggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    toggleAuth.textContent = isLogin ? 'Sign Up' : 'Login';
    forgotPasswordLink.style.display = isLogin ? 'block' : 'none';
    nameGroup.classList.toggle('hidden', isLogin);
    authName.required = !isLogin;
}

toggleAuth.addEventListener('click', (e) => { e.preventDefault(); setAuthMode(!isLogin); });

// ─── Show / Hide Password ─────────────────────────────────────────────────────────
const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

passwordToggle.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    passwordToggle.innerHTML = show ? eyeClosed : eyeOpen;
    passwordToggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

// ─── Email/Password Auth ──────────────────────────────────────────────────────────
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
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(cred.user, { displayName: name });
            await sendEmailVerification(cred.user);
            showToast('Account created! Check your inbox to verify your email.', 'success');
        }
        authForm.reset();
        passwordInput.type = 'password';
        passwordToggle.innerHTML = eyeOpen;
    } catch (error) {
        showToast(getFriendlyError(error.code), 'error');
    } finally {
        authSubmitBtn.classList.remove('loading');
        authSubmitBtn.disabled = false;
    }
});

// ─── Google Sign-In ───────────────────────────────────────────────────────────────
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

// ─── Forgot Password ──────────────────────────────────────────────────────────────
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
        showToast(`Reset link sent to ${email}!`, 'success');
        resetPasswordModal.classList.add('hidden');
        resetPasswordForm.reset();
    } catch (error) {
        showToast(getFriendlyError(error.code), 'error');
    } finally {
        resetSubmitBtn.classList.remove('loading');
        resetSubmitBtn.disabled = false;
    }
});

// ─── Resend Verification ──────────────────────────────────────────────────────────
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

// ─── Logout ───────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    showToast('You have been signed out.', 'info');
});

// ─── Search, Filter, Sort ─────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    searchClear.classList.toggle('hidden', !searchQuery);
    renderIdeas();
});

searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.add('hidden');
    searchInput.focus();
    renderIdeas();
});

document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeFilter = tab.dataset.filter;
        renderIdeas();
    });
});

sortSelect.addEventListener('change', () => {
    activeSort = sortSelect.value;
    renderIdeas();
});

// ─── Fetch Ideas (Firestore) ──────────────────────────────────────────────────────
async function fetchIdeas() {
    const preferredQuery = query(
        collection(db, 'ideas'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
    );

    const setupListener = (q, isFallback = false) => {
        if (unsubscribeIdeas) unsubscribeIdeas();

        unsubscribeIdeas = onSnapshot(q, (snapshot) => {
            allIdeas = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            updateStats();
            renderIdeas();

            if (isFallback && snapshot.docs.length > 0) {
                const notice = document.createElement('div');
                notice.style.cssText = 'grid-column:1/-1;padding:1rem;background:#fffbeb;color:#92400e;border-radius:8px;margin-bottom:1rem;font-size:0.85rem;border:1px solid #fef3c7;';
                notice.innerHTML = '<b>Note:</b> Sorting is disabled — a Firestore index is missing. <a href="https://console.firebase.google.com" target="_blank" style="color:inherit">Create it in Firebase Console</a>.';
                ideasList.prepend(notice);
            }
        }, (error) => {
            console.error('Firestore Error:', error);
            if (error.code === 'failed-precondition' && !isFallback) {
                const fallbackQuery = query(collection(db, 'ideas'), where('userId', '==', currentUser.uid));
                setupListener(fallbackQuery, true);
            } else {
                ideasList.innerHTML = `<div class="error-state"><h3>Error loading collection</h3><p>${error.message}</p></div>`;
            }
        });
    };

    setupListener(preferredQuery);
}

// ─── Modal: Add / Edit ────────────────────────────────────────────────────────────
addIdeaBtn.addEventListener('click', () => {
    modalTitle.textContent = 'New Spark';
    ideaForm.reset();
    document.getElementById('idea-id').value = '';
    document.querySelector('input[name="idea-type"][value="idea"]').checked = true;
    currentTags = [];
    renderTagPills();
    titleCounter.textContent = '0/100';
    contentCounter.textContent = '0/2000';
    ideaModal.classList.remove('hidden');
    setTimeout(() => titleInput.focus(), 100);
});

function openEditModal(id, idea) {
    modalTitle.textContent = 'Edit Spark';
    document.getElementById('idea-id').value = id;
    document.getElementById('idea-title').value = idea.title;
    document.querySelector(`input[name="idea-type"][value="${idea.type}"]`).checked = true;
    document.getElementById('idea-content').value = idea.content || '';
    document.getElementById('idea-url').value = idea.url || '';
    currentTags = idea.tags ? [...idea.tags] : [];
    renderTagPills();
    titleCounter.textContent = `${idea.title.length}/100`;
    contentCounter.textContent = `${(idea.content || '').length}/2000`;
    ideaModal.classList.remove('hidden');
}

// ─── Save Idea ────────────────────────────────────────────────────────────────────
ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('idea-id').value;
    const type = document.querySelector('input[name="idea-type"]:checked').value;
    const saveBtn = ideaForm.querySelector('button[type="submit"]');

    const ideaData = {
        title: document.getElementById('idea-title').value.trim(),
        type,
        content: document.getElementById('idea-content').value,
        url: document.getElementById('idea-url').value,
        tags: currentTags,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: currentUser.displayName || 'Creator',
        updatedAt: serverTimestamp()
    };

    saveBtn.classList.add('loading');
    saveBtn.disabled = true;

    try {
        if (id) {
            await updateDoc(doc(db, 'ideas', id), ideaData);
            showToast('Spark updated successfully!', 'success');
        } else {
            ideaData.createdAt = serverTimestamp();
            ideaData.pinned = false;
            await addDoc(collection(db, 'ideas'), ideaData);
            showToast('New spark saved! ✨', 'success');
        }
        ideaModal.classList.add('hidden');
        ideaForm.reset();
        currentTags = [];
    } catch (error) {
        showToast('Error saving: ' + error.message, 'error');
    } finally {
        saveBtn.classList.remove('loading');
        saveBtn.disabled = false;
    }
});

// ─── Tags Input ───────────────────────────────────────────────────────────────────
function renderTagPills() {
    tagsPills.innerHTML = '';
    currentTags.forEach((tag, idx) => {
        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        pill.innerHTML = `#${escapeHtml(tag)} <button type="button" class="tag-remove" aria-label="Remove tag ${tag}">×</button>`;
        pill.querySelector('.tag-remove').addEventListener('click', () => {
            currentTags.splice(idx, 1);
            renderTagPills();
        });
        tagsPills.appendChild(pill);
    });
}

function addTag(val) {
    const clean = val.trim().replace(/,/g, '').toLowerCase();
    if (!clean) return;
    if (currentTags.includes(clean)) { tagInput.value = ''; return; }
    if (currentTags.length >= 8) { showToast('Maximum 8 tags allowed.', 'info'); return; }
    currentTags.push(clean);
    renderTagPills();
    tagInput.value = '';
}

tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(tagInput.value);
    }
    if (e.key === 'Backspace' && tagInput.value === '' && currentTags.length > 0) {
        currentTags.pop();
        renderTagPills();
    }
});
tagInput.addEventListener('blur', () => { if (tagInput.value.trim()) addTag(tagInput.value); });

// ─── Character Counters ───────────────────────────────────────────────────────────
titleInput.addEventListener('input', () => {
    const len = titleInput.value.length;
    titleCounter.textContent = `${len}/100`;
    titleCounter.classList.toggle('char-counter-warn', len > 80);
});

contentTextarea.addEventListener('input', () => {
    const len = contentTextarea.value.length;
    contentCounter.textContent = `${len}/2000`;
    contentCounter.classList.toggle('char-counter-warn', len > 1800);
});

// ─── Export ───────────────────────────────────────────────────────────────────────
exportBtn.addEventListener('click', () => exportModal.classList.remove('hidden'));
exportCancelBtn.addEventListener('click', () => exportModal.classList.add('hidden'));

exportJsonBtn.addEventListener('click', () => {
    const data = allIdeas.map(({ id, title, type, content, url, tags, pinned, createdAt, updatedAt }) => ({
        id, title, type,
        content: content || '',
        url: url || '',
        tags: tags || [],
        pinned: !!pinned,
        createdAt: createdAt ? new Date(createdAt.seconds * 1000).toISOString() : null,
        updatedAt: updatedAt ? new Date(updatedAt.seconds * 1000).toISOString() : null
    }));
    downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        `contentspark-${formatDateForFilename()}.json`
    );
    exportModal.classList.add('hidden');
    showToast(`Exported ${data.length} sparks as JSON!`, 'success');
});

exportCsvBtn.addEventListener('click', () => {
    const headers = ['Title', 'Type', 'Content', 'URL', 'Tags', 'Pinned', 'Created At'];
    const rows = allIdeas.map(idea => [
        csvEsc(idea.title),
        csvEsc(idea.type),
        csvEsc(idea.content || ''),
        csvEsc(idea.url || ''),
        csvEsc((idea.tags || []).join('; ')),
        idea.pinned ? 'Yes' : 'No',
        idea.createdAt ? new Date(idea.createdAt.seconds * 1000).toISOString() : ''
    ]);
    const csv = [headers.map(csvEsc), ...rows].map(r => r.join(',')).join('\n');
    downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
        `contentspark-${formatDateForFilename()}.csv`
    );
    exportModal.classList.add('hidden');
    showToast(`Exported ${allIdeas.length} sparks as CSV!`, 'success');
});

function csvEsc(val) { return `"${String(val || '').replace(/"/g, '""')}"`; }
function formatDateForFilename() { return new Date().toISOString().slice(0, 10); }
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Copy to Clipboard ────────────────────────────────────────────────────────────
function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => showToast('Copied to clipboard!', 'success'))
            .catch(() => showToast('Could not copy.', 'error'));
    } else {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        Object.assign(ta.style, { position: 'fixed', opacity: '0' });
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); showToast('Copied!', 'success'); }
        catch { showToast('Could not copy.', 'error'); }
        document.body.removeChild(ta);
    }
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    const dashVisible = !dashboardSection.classList.contains('hidden');

    if (e.key === 'Escape') {
        closeAllModals();
        return;
    }
    if (isTyping) return;

    if (e.key === 'n' && dashVisible) { addIdeaBtn.click(); }
    if (e.key === '/' && dashVisible) { e.preventDefault(); searchInput.focus(); }
});

// ─── Utility ──────────────────────────────────────────────────────────────────────
function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

// ─── Dark Mode ────────────────────────────────────────────────────────────────────
const darkToggles = document.querySelectorAll('.dark-toggle-btn');

function applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    darkToggles.forEach(btn => {
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);

darkToggles.forEach(btn => {
    btn.addEventListener('click', () => {
        applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
    });
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) applyTheme(e.matches);
});

// ─── PWA Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────────
setAuthMode(true);

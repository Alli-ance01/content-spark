import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
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

// DOM Elements
const landingSection = document.getElementById('landing-section');
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
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
const closeModalBtns = document.querySelectorAll('.close-modal');
const modalTitle = document.getElementById('modal-title');
const backToLandingBtn = document.querySelector('.back-to-landing');
const showAuthBtns = document.querySelectorAll('.show-auth-btn');

let isLogin = true;
let currentUser = null;
let unsubscribeIdeas = null;

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showSection('dashboard');
        userEmailSpan.textContent = user.email;
        fetchIdeas();
    } else {
        currentUser = null;
        showSection('landing');
        if (unsubscribeIdeas) unsubscribeIdeas();
    }
});

// Navigation Logic
function showSection(sectionId) {
    [landingSection, authSection, dashboardSection].forEach(section => {
        section.classList.add('hidden');
    });
    
    if (sectionId === 'landing') landingSection.classList.remove('hidden');
    else if (sectionId === 'auth') authSection.classList.remove('hidden');
    else if (sectionId === 'dashboard') dashboardSection.classList.remove('hidden');
}

showAuthBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'signup') {
            setAuthMode(false);
        } else {
            setAuthMode(true);
        }
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
}

toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(!isLogin);
});

// Auth Form Submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authForm.email.value;
    const password = authForm.password.value;
    
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = isLogin ? 'Logging in...' : 'Creating account...';

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        authForm.reset();
    } catch (error) {
        alert(error.message);
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isLogin ? 'Login' : 'Sign Up';
    }
});

// Logout
logoutBtn.addEventListener('click', () => signOut(auth));

// Fetch Ideas
async function fetchIdeas() {
    // Attempt the preferred query (filtered and sorted)
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

            snapshot.forEach((doc) => {
                const idea = doc.data();
                const card = createIdeaCard(doc.id, idea);
                ideasList.appendChild(card);
            });
            
            if (isFallback) {
                const notice = document.createElement('div');
                notice.style.cssText = "grid-column: 1/-1; padding: 1rem; background: #fffbeb; color: #92400e; border-radius: 8px; margin-bottom: 1rem; font-size: 0.85rem; border: 1px solid #fef3c7;";
                notice.innerHTML = "<b>Note:</b> Sorting is currently disabled because a Firestore Index is missing. Your ideas are shown by ID instead.";
                ideasList.prepend(notice);
            }
        }, (error) => {
            console.error("Firestore Error:", error);
            if (error.code === 'failed-precondition' && !isFallback) {
                console.log("Preferred query failed (index missing), trying fallback...");
                // Fallback: Filter by userId but REMOVE the orderBy to bypass index requirement
                const fallbackQuery = query(
                    collection(db, "ideas"), 
                    where("userId", "==", currentUser.uid)
                );
                setupListener(fallbackQuery, true);
            } else {
                ideasList.innerHTML = `<div class="error-state"><h3>Error loading collection</h3><p>${error.message}</p></div>`;
            }
        });
    };

    setupListener(preferredQuery);
}

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
            } catch (error) {
                alert("Error deleting: " + error.message);
            }
        }
    });

    return div;
}

// Modal Logic
addIdeaBtn.addEventListener('click', () => {
    modalTitle.textContent = 'New Spark';
    ideaForm.reset();
    document.getElementById('idea-id').value = '';
    // Default to 'idea' radio
    document.querySelector('input[name="idea-type"][value="idea"]').checked = true;
    ideaModal.classList.remove('hidden');
});

closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => ideaModal.classList.add('hidden'));
});

window.onclick = (event) => {
    if (event.target == ideaModal) ideaModal.classList.add('hidden');
};

function openEditModal(id, idea) {
    modalTitle.textContent = 'Edit Spark';
    document.getElementById('idea-id').value = id;
    document.getElementById('idea-title').value = idea.title;
    document.querySelector(`input[name="idea-type"][value="${idea.type}"]`).checked = true;
    document.getElementById('idea-content').value = idea.content || '';
    document.getElementById('idea-url').value = idea.url || '';
    ideaModal.classList.remove('hidden');
}

// Idea Form Submission
ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('idea-id').value;
    const type = document.querySelector('input[name="idea-type"]:checked').value;
    
    const ideaData = {
        title: document.getElementById('idea-title').value,
        type: type,
        content: document.getElementById('idea-content').value,
        url: document.getElementById('idea-url').value,
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "ideas", id), ideaData);
        } else {
            ideaData.createdAt = serverTimestamp();
            await addDoc(collection(db, "ideas"), ideaData);
        }
        ideaModal.classList.add('hidden');
        ideaForm.reset();
    } catch (error) {
        alert("Error saving: " + error.message);
    }
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

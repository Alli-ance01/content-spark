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
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
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

let isLogin = true;
let currentUser = null;
let unsubscribeIdeas = null;

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showDashboard();
        userEmailSpan.textContent = user.email;
        fetchIdeas();
    } else {
        currentUser = null;
        showAuth();
        if (unsubscribeIdeas) unsubscribeIdeas();
    }
});

// Toggle Auth Mode
toggleAuth.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    authTitle.textContent = isLogin ? 'Login' : 'Sign Up';
    authSubmitBtn.textContent = isLogin ? 'Login' : 'Sign Up';
    toggleText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
    toggleAuth.textContent = isLogin ? 'Sign Up' : 'Login';
});

// Auth Form Submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authForm.email.value;
    const password = authForm.password.value;

    try {
        if (isLogin) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        authForm.reset();
    } catch (error) {
        alert(error.message);
    }
});

// Logout
logoutBtn.addEventListener('click', () => signOut(auth));

// UI Navigation
function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
}

function showAuth() {
    dashboardSection.classList.add('hidden');
    authSection.classList.remove('hidden');
}

// Fetch Ideas
function fetchIdeas() {
    const q = query(
        collection(db, "ideas"), 
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
    );

    unsubscribeIdeas = onSnapshot(q, (snapshot) => {
        ideasList.innerHTML = '';
        if (snapshot.empty) {
            ideasList.innerHTML = '<div class="empty-state">No ideas found. Start by adding one!</div>';
            return;
        }

        snapshot.forEach((doc) => {
            const idea = doc.data();
            const card = createIdeaCard(doc.id, idea);
            ideasList.appendChild(card);
        });
    }, (error) => {
        console.error("Error fetching ideas:", error);
        if (error.code === 'failed-precondition') {
            ideasList.innerHTML = '<div class="error-state">Please enable Firestore Indexes in your Firebase Console.</div>';
        } else {
            ideasList.innerHTML = '<div class="error-state">Error loading ideas. Check console for details.</div>';
        }
    });
}

function createIdeaCard(id, idea) {
    const div = document.createElement('div');
    div.className = 'idea-card';
    
    const date = idea.createdAt ? new Date(idea.createdAt.seconds * 1000).toLocaleDateString() : 'Just now';
    
    div.innerHTML = `
        <span class="idea-tag tag-${idea.type}">${idea.type}</span>
        <h3>${escapeHtml(idea.title)}</h3>
        <p class="idea-content">${escapeHtml(idea.content || '')}</p>
        ${idea.url ? `<a href="${idea.url}" target="_blank" class="idea-url">${escapeHtml(idea.url)}</a>` : ''}
        <div class="idea-footer">
            <span class="idea-date">${date}</span>
            <div class="idea-actions">
                <button class="btn btn-outline edit-btn" data-id="${id}">Edit</button>
                <button class="btn btn-outline btn-danger delete-btn" data-id="${id}">Delete</button>
            </div>
        </div>
    `;

    // Edit Button
    div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(id, idea));
    
    // Delete Button
    div.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this idea?')) {
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
    modalTitle.textContent = 'Add New Idea';
    ideaForm.reset();
    document.getElementById('idea-id').value = '';
    ideaModal.classList.remove('hidden');
});

closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => ideaModal.classList.add('hidden'));
});

window.onclick = (event) => {
    if (event.target == ideaModal) ideaModal.classList.add('hidden');
};

function openEditModal(id, idea) {
    modalTitle.textContent = 'Edit Idea';
    document.getElementById('idea-id').value = id;
    document.getElementById('idea-title').value = idea.title;
    document.getElementById('idea-type').value = idea.type;
    document.getElementById('idea-content').value = idea.content || '';
    document.getElementById('idea-url').value = idea.url || '';
    ideaModal.classList.remove('hidden');
}

// Idea Form Submission
ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('idea-id').value;
    const ideaData = {
        title: document.getElementById('idea-title').value,
        type: document.getElementById('idea-type').value,
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

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

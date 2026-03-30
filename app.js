import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 🔁 YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCx-yIgRBdqqaZm5mnCs6XicbJHqf442mQ",
  authDomain: "netrackers.firebaseapp.com",
  databaseURL: "https://netrackers-default-rtdb.firebaseio.com",
  projectId: "netrackers",
  storageBucket: "netrackers.firebasestorage.app",
  messagingSenderId: "362299470159",
  appId: "1:362299470159:web:dce2775a7c6fdd6970153a",
  measurementId: "G-FHJSFVG3RE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// DOM elements
const totalClicksSpan = document.getElementById('totalClicks');
const totalLinksSpan = document.getElementById('totalLinks');
const linksContainer = document.getElementById('linksContainer');
const addLinkBtn = document.getElementById('addLinkBtn');
const linkNameInput = document.getElementById('linkName');
const linkUrlInput = document.getElementById('linkUrl');
const clearAllBtn = document.getElementById('clearAllBtn');
const logoutBtn = document.getElementById('logoutBtn'); // add this button in index.html
const userDisplaySpan = document.getElementById('userDisplay'); // optional, to show user name

let currentUser = null;
let currentLinksRef = null; // will point to users/{uid}/links

// Helper: get base URL for redirect links
function getRedirectBase() {
    return window.location.origin;
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Render links for current user
function renderLinks(linksData) {
    if (!linksData || Object.keys(linksData).length === 0) {
        linksContainer.innerHTML = `<div class="empty-state">✨ No links yet. Create your first tracking link above.</div>`;
        totalClicksSpan.innerText = '0';
        totalLinksSpan.innerText = '0';
        return;
    }

    const linkIds = Object.keys(linksData);
    let totalClicks = 0;
    linkIds.forEach(id => {
        totalClicks += linksData[id].clickCount || 0;
    });
    totalClicksSpan.innerText = totalClicks;
    totalLinksSpan.innerText = linkIds.length;

    let html = '';
    for (let id of linkIds) {
        const link = linksData[id];
        const name = link.name || 'Unnamed';
        const destination = link.destinationUrl || '#';
        const clickCount = link.clickCount || 0;
        const trackingUrl = `${getRedirectBase()}/redirect.html?id=${id}`;

        html += `
            <div class="link-card" data-id="${id}">
                <div class="link-info">
                    <div class="link-name">
                        ${escapeHtml(name)}
                        <span class="link-badge">🔗 tracked</span>
                    </div>
                    <div class="link-dest">➡️ ${escapeHtml(destination)}</div>
                    <div class="tracking-link" title="Click to copy tracking link">📎 ${escapeHtml(trackingUrl)}</div>
                </div>
                <div class="link-stats">
                    <div class="click-count">🖱️ ${clickCount} click${clickCount !== 1 ? 's' : ''}</div>
                    <button class="copy-btn" data-url="${trackingUrl}" title="Copy tracking link">📋</button>
                    <button class="delete-btn" data-id="${id}" title="Delete link">🗑️</button>
                </div>
            </div>
        `;
    }
    linksContainer.innerHTML = html;

    // Attach copy events
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = btn.getAttribute('data-url');
            navigator.clipboard.writeText(url);
            const original = btn.innerText;
            btn.innerText = '✓';
            setTimeout(() => btn.innerText = original, 1000);
        });
    });

    // Attach delete events
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            if (confirm('Delete this link? Clicks will be lost.')) {
                await remove(ref(db, `users/${currentUser.uid}/links/${id}`));
            }
        });
    });
}

// Add new link for current user
async function addNewLink() {
    if (!currentUser) {
        alert('You must be logged in');
        return;
    }
    const name = linkNameInput.value.trim();
    let destination = linkUrlInput.value.trim();
    if (!name) {
        alert('Please enter a link name');
        return;
    }
    if (!destination) {
        alert('Please enter a destination URL (https://...)');
        return;
    }
    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
        destination = 'https://' + destination;
    }
    try {
        new URL(destination);
    } catch(e) {
        alert('Invalid URL. Use format like https://example.com');
        return;
    }

    const newLinkRef = push(ref(db, `users/${currentUser.uid}/links`));
    await set(newLinkRef, {
        name: name,
        destinationUrl: destination,
        clickCount: 0,
        createdAt: Date.now()
    });
    linkNameInput.value = '';
    linkUrlInput.value = '';
}

// Clear all links for current user
async function clearAllLinks() {
    if (!currentUser) return;
    if (confirm('⚠️ Delete ALL your links and their click counts? This action is permanent.')) {
        await set(ref(db, `users/${currentUser.uid}/links`), null);
    }
}

// Logout function
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// Listen to authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Show logout button and possibly user name
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        // Fetch user profile from database (optional)
        const profileRef = ref(db, `users/${user.uid}/profile`);
        onValue(profileRef, (snap) => {
            if (snap.exists()) {
                const profile = snap.val();
                if (userDisplaySpan) userDisplaySpan.textContent = `👋 ${profile.name || user.email}`;
            } else {
                if (userDisplaySpan) userDisplaySpan.textContent = `👋 ${user.email}`;
            }
        }, (err) => console.warn("Profile fetch failed:", err));

        // Set links reference to user's sub‑collection
        currentLinksRef = ref(db, `users/${user.uid}/links`);
        // Real‑time listener for user's links
        onValue(currentLinksRef, (snapshot) => {
            const data = snapshot.val();
            renderLinks(data);
        }, (error) => {
            console.error("Firebase read failed:", error);
            linksContainer.innerHTML = `<div class="empty-state">⚠️ Database error. Check rules.</div>`;
        });

        // Enable action buttons
        addLinkBtn.disabled = false;
        clearAllBtn.disabled = false;
    } else {
        // No user logged in – redirect to login page
        window.location.href = "login.html";
    }
});

// Event listeners
addLinkBtn.addEventListener('click', addNewLink);
clearAllBtn.addEventListener('click', clearAllLinks);
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

// Allow Enter key in inputs
linkUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewLink();
});
linkNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewLink();
});
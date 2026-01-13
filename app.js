const firebaseConfig = {
    apiKey: "AIzaSyBzd5sjsNaOIBch3KH3mG3UaGfpONwG77Y",
    authDomain: "cachop-media-hub.firebaseapp.com",
    projectId: "cachop-media-hub",
    storageBucket: "cachop-media-hub.firebasestorage.app",
    messagingSenderId: "752343781591",
    appId: "1:752343781591:web:78824fc05d6e0606da6092",
    measurementId: "G-49BYQF2JCB"
  };
  

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();



let teamMembers = [], dressCodes = {}, specialPrograms = [], currentUser = null;

// 2. AUTHENTICATION
async function memberLogin() {
    const nameInput = document.getElementById('loginName').value.trim().toLowerCase();
    const keyInput = document.getElementById('loginKey').value.trim();
    
    if(!nameInput || !keyInput) return alert("Please enter Name and Access Code");

    const snap = await db.collection('members').get();
    let match = null;
    
    snap.forEach(doc => {
        const d = doc.data();
        // Allow login if name matches AND (personal code matches OR master code 7777 is used)
        if (d.name.toLowerCase() === nameInput && (d.code === keyInput || keyInput === '7777')) { 
            match = d; 
            match.id = doc.id; 
        }
    });

    if (match) {
        currentUser = match;
        const hr = new Date().getHours();
        const greet = hr < 12 ? "Good Morning" : hr < 17 ? "Good Afternoon" : "Good Evening";
        document.getElementById('user-welcome').innerText = `${greet}, ${match.name}`;
        document.getElementById('login-screen').style.setProperty('display', 'none', 'important');
        document.getElementById('main-dashboard').style.display = 'block';
        initDashboard();
    } else { 
        alert("Access Denied. Please check your credentials."); 
    }
}

// 3. DASHBOARD INITIALIZATION & LIVE LISTENERS
function initDashboard() {
    updateClock(); 
    setInterval(updateClock, 1000);
    
    if (currentUser.role === 'admin') autoCleanup();

    // Directory Listener
    db.collection('members').onSnapshot(s => { 
        teamMembers = s.docs.map(d => ({id:d.id, ...d.data()})); 
        renderTeam(); 
        applyPermissions(); 
    });

    // Dress Code Listener (FIXED: removed .exists() parentheses)
    db.collection('settings').doc('dressCodes').onSnapshot(d => { 
        if(d.exists) { 
            dressCodes = d.data(); 
            renderDressCalendar(); 
        } 
    });

    // Poll Listener (FIXED: removed .exists() parentheses)
    db.collection('settings').doc('activePoll').onSnapshot(d => {
        const sec = document.getElementById('poll-section');
        if (d.exists && d.data().question) {
            sec.style.display = 'block';
            const p = d.data();
            document.getElementById('poll-question').innerText = p.question;
            document.getElementById('labelA').innerText = p.optA_label;
            document.getElementById('labelB').innerText = p.optB_label;
            const total = (p.optA_votes || 0) + (p.optB_votes || 0);
            const pA = total === 0 ? 0 : Math.round((p.optA_votes / total) * 100);
            document.getElementById('percentA').innerText = pA + "%";
            document.getElementById('percentB').innerText = (100 - pA) + "%";
        } else { 
            sec.style.display = 'none'; 
        }
    });

    // Notice Bar Listener (FIXED: removed .exists() parentheses)
    db.collection('settings').doc('liveNotice').onSnapshot(d => {
        const bar = document.getElementById('live-notice-bar');
        if (d.exists && d.data().message) {
            document.getElementById('notice-text').innerText = d.data().message;
            bar.style.display = 'block';
        } else { 
            bar.style.display = 'none'; 
        }
    });

    // Observations Listener
    db.collection('comments').orderBy('timestamp', 'desc').limit(15).onSnapshot(s => {
        document.getElementById('commentList').innerHTML = s.docs.map(doc => {
            const c = doc.data();
            return `<div class="mb-2 p-2 border-bottom small shadow-sm bg-light rounded">
                <b>${c.author}:</b> ${c.text}
                ${currentUser.role==='admin' ? `<span class="text-danger float-end fw-bold" style="cursor:pointer" onclick="deleteComment('${doc.id}')">×</span>` : ''}
            </div>`;
        }).join('') || '<div class="small text-muted text-center">No observations yet.</div>';
    });

    // Programs Listener
    db.collection('programs').orderBy('expiryDate').onSnapshot(s => { 
        specialPrograms = s.docs.map(d => ({id:d.id, ...d.data()})); 
        renderRoster(); 
    });
}

// 4. UI RENDERING FUNCTIONS
function renderRoster() {
    let html = `<tr class="table-primary"><td><b>Sunday Service</b></td><td>8:00 AM</td><td></td></tr>`;
    html += `<tr class="table-warning"><td><b>Thursday Core Service</b></td><td>5:00 PM</td><td></td></tr>`;
    html += specialPrograms.map(p => `<tr><td><b>${p.event}</b></td><td>${p.timeDisplay}</td><td class="text-end"> 
    ${currentUser.role==='admin'?`<span class="text-danger fw-bold" style="cursor:pointer" onclick="deleteProgram('${p.id}')">×</span>`:''}</td></tr>`).join('');
    document.getElementById('fullRoster').innerHTML = html;
}

function renderDressCalendar() {
    let sundays = []; 
    let d = new Date(); 
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    for (let i = 0; i < 4; i++) { 
        sundays.push(d.toDateString()); 
        d.setDate(d.getDate() + 7); 
    }
    document.getElementById('dressCalendar').innerHTML = sundays.map(date => `
        <div class="col-6 mb-2"><div class="p-2 border rounded bg-white text-dark shadow-sm" style="font-size:0.65rem;">
            <div class="text-primary fw-bold">${date}</div><div class="fw-bold">${dressCodes[date] || "TBA"}</div>
        </div></div>`).join('');
}

function renderTeam(data = teamMembers) {
    document.getElementById('totalMembers').innerText = teamMembers.length;
    document.getElementById('directoryList').innerHTML = data.map(m => `
        <li class="list-group-item d-flex justify-content-between p-2 small">
            <div><b>${m.name}</b><br><span class="text-muted">${m.phone || ''}</span></div>
            <div>${m.phone ? `<a href="tel:${m.phone}" class="btn btn-xs btn-outline-primary">📞</a>`:'' }
            ${(currentUser.role==='admin' && m.name.toLowerCase()!=='admin')?`<span onclick="removeMember('${m.id}')" class="text-danger ms-2 fw-bold" style="cursor:pointer">×</span>`:''}</div>
        </li>`).join('');
}

// 5. ADMIN & USER ACTIONS
async function updateDressCalendar() {
    let dates = [];
    let d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    for (let i = 0; i < 4; i++) { dates.push(d.toDateString()); d.setDate(d.getDate() + 7); }

    const choice = prompt(`Update which Sunday?\n1. ${dates[0]}\n2. ${dates[1]}\n3. ${dates[2]}\n4. ${dates[3]}`);
    const index = parseInt(choice) - 1;

    if (index >= 0 && index < 4) {
        const selectedDate = dates[index];
        const newDress = prompt(`Enter Dress Code for ${selectedDate}:`);
        if (newDress) {
            await db.collection('settings').doc('dressCodes').set({ [selectedDate]: newDress }, { merge: true });
        }
    } else { alert("Invalid choice."); }
}

async function castVote(opt) {
    const ref = db.collection('settings').doc('activePoll');
    const doc = await ref.get();
    if(doc.data().voters?.includes(currentUser.id)) return alert("You have already voted!");
    let upd = { voters: firebase.firestore.FieldValue.arrayUnion(currentUser.id) };
    upd[opt + "_votes"] = firebase.firestore.FieldValue.increment(1);
    await ref.update(upd);
}

async function submitComment() {
    const t = document.getElementById('commentText').value.trim();
    if(t) await db.collection('comments').add({ 
        author: currentUser.name, 
        text: t, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    });
    document.getElementById('commentText').value = ''; 
    toggleCommentForm();
}

async function deleteComment(id) {
    if(confirm("Permanently delete this observation?")) {
        await db.collection('comments').doc(id).delete();
    }
}

// 6. UTILITIES
function updateClock() { 
    document.getElementById('current-time').innerText = new Date().toLocaleTimeString(); 
}

function applyPermissions() { 
    if(currentUser.role === 'admin') {
        document.querySelectorAll('.auth-required').forEach(e => e.style.setProperty('display', 'block', 'important')); 
    }
}

function toggleCommentForm() { 
    const s = document.getElementById('commentFormSection'); 
    s.style.display = s.style.display === 'none' ? 'block' : 'none'; 
}

function filterTeam() {
    const term = document.getElementById('memberSearch').value.toLowerCase();
    renderTeam(teamMembers.filter(m => m.name.toLowerCase().includes(term)));
}

// Admin Tools
async function createNewPoll() {
    const q = prompt("Question?"), a = prompt("Option A:"), b = prompt("Option B:");
    if(q) await db.collection('settings').doc('activePoll').set({ question: q, optA_label: a, optB_label: b, optA_votes: 0, optB_votes: 0, voters: [] });
}
async function setLiveNotice() { 
    const m = prompt("Enter Notice Message:"); 
    if(m) await db.collection('settings').doc('liveNotice').set({message: m}); 
}
async function clearNotice() { await db.collection('settings').doc('liveNotice').delete(); }
async function deletePoll() { if(confirm("End current poll?")) await db.collection('settings').doc('activePoll').delete(); }
async function addNewProgram() { 
    const e = prompt("Event Name:"), t = prompt("Time (e.g. 6:00 PM):"), x = prompt("Expiry Date (YYYY-MM-DD):");
    if(e && x) await db.collection('programs').add({event:e, timeDisplay:t, expiryDate:x}); 
}
async function deleteProgram(id) { await db.collection('programs').doc(id).delete(); }
async function removeMember(id) { if(confirm("Remove team member?")) await db.collection('members').doc(id).delete(); }
async function addTeamMember() {
    const n = prompt("Name:"), p = prompt("Phone:"), c = prompt("Code:"), a = confirm("Make Admin?");
    if(n && c) await db.collection('members').add({ name: n, phone: p, code: c, role: a?'admin':'member' });
}
async function autoCleanup() {
    const today = new Date().toISOString().split('T')[0];
    const snap = await db.collection('programs').where('expiryDate', '<', today).get();
    snap.forEach(d => d.ref.delete());
}

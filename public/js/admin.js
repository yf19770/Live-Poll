import { db, auth, doc, collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, onAuthStateChanged, signInWithEmailAndPassword, signOut, writeBatch } from './app.js';

// --- DOM Elements ---
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const logoutButton = document.getElementById('logout-button');
const createGameForm = document.getElementById('create-game-form');
const gamesList = document.getElementById('games-list');
const initialState = document.getElementById('initial-state');
const gameDashboard = document.getElementById('game-dashboard');
const mainGameTitle = document.getElementById('main-game-title');
const resetGameButton = document.getElementById('reset-game-button');
const deleteGameButton = document.getElementById('delete-game-button');
const questionsListContainer = document.getElementById('questions-list-container');
const analyticsContainer = document.getElementById('analytics-container');
const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Mission Control Elements
const qrCodeContainer = document.getElementById('qr-code-container');
const copyJoinLinkBtn = document.getElementById('copy-join-link-btn');
const openDisplayBtn = document.getElementById('open-display-btn');
const showLobbyBtn = document.getElementById('show-lobby-btn');
const liveQuestionsList = document.getElementById('live-questions-list');
const previewWrapper = document.querySelector('.preview-wrapper');
const previewContainer = document.getElementById('preview-container');
const livePreviewIframe = document.getElementById('live-preview-iframe');
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');


// --- State Variables ---
let selectedGameId = null;
let questions = []; 
let activeCharts = {}; 
let unsubscribeGames = null;
let unsubscribeGame = null;
let unsubscribeQuestions = null;
let openEditorElement = null;
let previewScaler = null;


// --- AUTHENTICATION ---
onAuthStateChanged(auth, user => {
    if (user) {
        dashboardSection.classList.remove('hidden');
        loginSection.classList.add('hidden');
        listenForGames();
    } else {
        dashboardSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        if (previewScaler) previewScaler.disconnect();
        if (unsubscribeGames) unsubscribeGames();
        if (unsubscribeGame) unsubscribeGame();
        if (unsubscribeQuestions) unsubscribeQuestions();
        showInitialState();
    }
});

document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    document.getElementById('login-error').textContent = '';
    try {
        await signInWithEmailAndPassword(auth, e.target['login-email'].value, e.target['login-password'].value);
    } catch (error) {
        document.getElementById('login-error').textContent = "Invalid email or password.";
    }
});

logoutButton.addEventListener('click', () => signOut(auth));


// --- UI HELPERS ---
function showInitialState() {
    initialState.classList.remove('hidden');
    gameDashboard.classList.add('hidden');
    selectedGameId = null;
    document.querySelectorAll('#games-list .list-item').forEach(el => el.classList.remove('selected'));
    sidebar.classList.remove('open');
    // Hide game-specific header elements
    document.querySelector('.main-header-game-info').classList.add('initially-hidden');
    document.querySelector('.header-actions').classList.add('initially-hidden');
}

function switchTab(tabName) {
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-content-${tabName}`);
    });
}

tabs.forEach(tab => {
    tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
});


// --- GAME MANAGEMENT ---
function listenForGames() {
    if (unsubscribeGames) unsubscribeGames();
    const gamesRef = collection(db, 'games');
    unsubscribeGames = onSnapshot(gamesRef, snapshot => {
        gamesList.innerHTML = '';
        const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        games.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
        games.forEach(game => renderGameListItem(game.id, game));
    });
}

function renderGameListItem(id, data) {
    const gameEl = document.createElement('div');
    gameEl.className = 'list-item';
    gameEl.innerHTML = `<span>${data.title}</span>`;
    gameEl.dataset.id = id;
    if (id === selectedGameId) gameEl.classList.add('selected');
    gameEl.addEventListener('click', () => selectGame(id));
    gamesList.appendChild(gameEl);
}

createGameForm.addEventListener('submit', async e => {
    e.preventDefault();
    const title = e.target['game-title'].value.trim();
    if (!title) return;
    
    const newGameRef = await addDoc(collection(db, 'games'), {
        title: title,
        createdAt: new Date(),
        currentQuestionId: null,
    });
    createGameForm.reset();
    selectGame(newGameRef.id);
});

function selectGame(id) {
    if (selectedGameId === id) {
        sidebar.classList.remove('open'); // Close sidebar on mobile if same game is selected
        return;
    }
    selectedGameId = id;

    document.querySelectorAll('#games-list .list-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === id);
    });

    initialState.classList.add('hidden');
    gameDashboard.classList.remove('hidden');
    // Show game-specific header elements
    document.querySelector('.main-header-game-info').classList.remove('initially-hidden');
    document.querySelector('.header-actions').classList.remove('initially-hidden');
    
    switchTab('live');
    sidebar.classList.remove('open');

    if (unsubscribeGame) unsubscribeGame();
    if (unsubscribeQuestions) unsubscribeQuestions();

    unsubscribeGame = onSnapshot(doc(db, 'games', id), (doc) => {
        if (!doc.exists()) {
            alert('This game was deleted.');
            showInitialState();
            return;
        }
        const gameData = doc.data();
        mainGameTitle.textContent = gameData.title;
        renderLiveControls(gameData);
    });

    listenForQuestions(id);
    const displayUrl = `/display.html?game=${id}`;
    openDisplayBtn.href = displayUrl;
    livePreviewIframe.src = displayUrl;
    initPreviewScaler();
}

deleteGameButton.addEventListener('click', async () => {
    if (!selectedGameId) return;
    if (confirm("DANGER: Are you sure you want to permanently delete this game and all of its questions? This action cannot be undone.")) {
        try {
            const questionsRef = collection(db, 'games', selectedGameId, 'questions');
            const questionsSnapshot = await getDocs(questionsRef);
            const batch = writeBatch(db);
            questionsSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            await deleteDoc(doc(db, 'games', selectedGameId));
            showInitialState();
        } catch (error) {
            console.error("Error deleting game: ", error);
            alert("Could not delete the game. Please try again.");
        }
    }
});

resetGameButton.addEventListener('click', async () => {
    if (!selectedGameId) return;
    if (confirm("Are you sure you want to reset all votes for ALL questions in this game to zero?")) {
        const batch = writeBatch(db);
        questions.forEach(q => {
            const newVoteCounts = Object.fromEntries(q.options.map(opt => [opt.id, 0]));
            const questionRef = doc(db, 'games', selectedGameId, 'questions', q.id);
            batch.update(questionRef, { status: 'draft', voteCounts: newVoteCounts });
        });
        
        const gameRef = doc(db, 'games', selectedGameId);
        batch.update(gameRef, { currentQuestionId: null });

        await batch.commit();
        alert("Game votes have been reset.");
        switchTab('live');
    }
});

// --- QUESTION MANAGEMENT (INLINE) ---
function listenForQuestions(gameId) {
    const questionsRef = collection(db, 'games', gameId, 'questions');
    unsubscribeQuestions = onSnapshot(questionsRef, snapshot => {
        questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQuestionsList();
        renderAnalyticsTab();
        getDoc(doc(db, 'games', gameId)).then(gameDoc => {
             if(gameDoc.exists()) renderLiveControls(gameDoc.data());
        });
    });
}

function renderQuestionsList() {
    closeOpenEditor();
    questionsListContainer.innerHTML = '';

    questions.forEach((q, index) => {
        const qCard = document.createElement('div');
        qCard.className = 'question-card';
        qCard.dataset.id = q.id;
        qCard.innerHTML = `
            <div class="question-card-header">
                <span class="q-card-index">${index + 1}.</span>
                <span class="q-card-text">${q.questionText}</span>
                <div class="q-actions">
                    <button class="button-small edit-btn">Edit</button>
                    <button class="button-small delete-btn">Delete</button>
                </div>
            </div>
            <div class="editor-container"></div>
        `;
        qCard.querySelector('.edit-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleEditor(qCard.querySelector('.editor-container'), q); });
        qCard.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteQuestion(q.id); });
        questionsListContainer.appendChild(qCard);
    });

    const addQuestionCard = document.createElement('div');
    addQuestionCard.className = 'question-card add-new';
    addQuestionCard.innerHTML = `<span>+ Add a New Question</span>`;
    addQuestionCard.addEventListener('click', () => {
        const newCard = document.createElement('div');
        newCard.className = 'question-card';
        questionsListContainer.appendChild(newCard);
        toggleEditor(newCard, null);
        newCard.scrollIntoView({ behavior: 'smooth' });
    });
    questionsListContainer.appendChild(addQuestionCard);
}

function toggleEditor(container, questionData) {
    if (openEditorElement && openEditorElement !== container) closeOpenEditor();
    
    if (container.classList.contains('open')) {
        closeOpenEditor();
    } else {
        openEditorElement = container;
        container.innerHTML = createEditorForm(questionData);
        container.classList.add('open');
        container.querySelector('.cancel-btn').addEventListener('click', closeOpenEditor);
        container.querySelector('.question-editor-form').addEventListener('submit', (e) => { e.preventDefault(); saveQuestion(e.target, questionData ? questionData.id : null); });
        container.querySelector('.add-option-btn-inline').addEventListener('click', (e) => { const optionsDiv = e.target.previousElementSibling; addOptionInput(optionsDiv); });
    }
}

function closeOpenEditor() {
    if (openEditorElement) {
        if (!openEditorElement.closest('.question-card').dataset.id) { openEditorElement.closest('.question-card').remove(); }
        else { openEditorElement.classList.remove('open'); openEditorElement.innerHTML = ''; }
        openEditorElement = null;
    }
}

function createEditorForm(data) {
    const qText = data ? data.questionText : '';
    const duration = data ? data.duration : 30;
    const chartType = data ? data.chartType : 'bar';
    const options = data ? data.options : [{text:'', color:'#4A90E2'}, {text:'', color:'#50E3C2'}];
    let optionsHtml = options.map(opt => `
        <div class="option-input-group">
            <input type="text" value="${opt.text}" placeholder="Option Text" class="option-text" required>
            <input type="color" value="${opt.color}" class="option-color">
        </div>`).join('');

    return `
        <form class="question-editor-form">
            <label>Question</label>
            <input type="text" name="questionText" value="${qText}" required>
            <label>Options (Max 4)</label>
            <div class="options-container-inline">${optionsHtml}</div>
            <button type="button" class="button-tertiary add-option-btn-inline">Add Option</button>
            <div class="form-grid-2">
                <div>
                    <label>Voting Time (s)</label>
                    <input type="number" name="duration" value="${duration}" required>
                </div>
                <div>
                    <label>Chart Type</label>
                    <select name="chartType">
                        <option value="bar" ${chartType === 'bar' ? 'selected' : ''}>Bar Chart</option>
                        <option value="pie" ${chartType === 'pie' ? 'selected' : ''}>Pie Chart</option>
                        <option value="doughnut" ${chartType === 'doughnut' ? 'selected' : ''}>doughnut Chart</option>
                    </select>
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="button-secondary cancel-btn">Cancel</button>
                <button type="submit" class="button">Save Question</button>
            </div>
        </form>
    `;
}


function addOptionInput(container) {
    if (container.children.length >= 4) return alert("A maximum of 4 options are allowed.");
    const div = document.createElement('div');
    div.className = 'option-input-group';
    div.innerHTML = `<input type="text" value="" placeholder="Option Text" class="option-text" required> <input type="color" value="#3498db" class="option-color">`;
    container.appendChild(div);
}

async function saveQuestion(form, questionId) {
    const options = Array.from(form.querySelectorAll('.option-input-group')).map((group, index) => ({ id: `opt${index + 1}`, text: group.querySelector('.option-text').value.trim(), color: group.querySelector('.option-color').value })).filter(opt => opt.text);
    if (options.length < 2) return alert("Please define at least 2 options.");
    const questionData = { questionText: form.questionText.value.trim(), options, duration: parseInt(form.duration.value) || 30, chartType: form.chartType.value };
    if (questionId) {
        await updateDoc(doc(db, 'games', selectedGameId, 'questions', questionId), questionData);
    } else {
        questionData.status = 'draft';
        questionData.voteCounts = Object.fromEntries(options.map(opt => [opt.id, 0]));
        await addDoc(collection(db, 'games', selectedGameId, 'questions'), questionData);
    }
    closeOpenEditor();
}

async function deleteQuestion(questionId) { if (confirm("Are you sure you want to delete this question?")) await deleteDoc(doc(db, 'games', selectedGameId, 'questions', questionId)); }

// --- MISSION CONTROL ---
function renderLiveControls(gameData) {
    if (!selectedGameId || !gameData) return;

    generateQRCode(selectedGameId);
    copyJoinLinkBtn.onclick = () => { navigator.clipboard.writeText(`${window.location.origin}/vote.html?game=${selectedGameId}`); copyJoinLinkBtn.textContent = 'Copied!'; setTimeout(() => { copyJoinLinkBtn.innerHTML = `<span class="emoji">🔗</span> Copy Join Link`; }, 2000); };
    showLobbyBtn.onclick = showLobby;

    liveQuestionsList.innerHTML = '';
    questions.forEach(q => {
        const isCurrent = gameData.currentQuestionId === q.id;
        const isRevealed = q.status === 'results_revealed';
        let statusText = 'Ready';
        if(isCurrent && isRevealed) statusText = 'Results Shown';
        else if(isCurrent) statusText = 'Live';
        
        const pushDisabled = isCurrent && !isRevealed;
        const revealDisabled = isRevealed;

        const qEl = document.createElement('div');
        qEl.className = `live-question-item ${isCurrent ? 'active' : ''}`;
        qEl.innerHTML = `
            <div class="live-q-status ${statusText.toLowerCase().replace(' ','-')}">${statusText}</div>
            <span class="live-q-text">${q.questionText}</span>
            <div class="live-q-buttons">
                <button class="button-small push-btn" data-q-id="${q.id}" ${pushDisabled ? 'disabled' : ''}>Push</button>
                <button class="button-small reveal-btn" data-q-id="${q.id}" ${revealDisabled ? 'disabled' : ''}>Reveal</button>
            </div>`;
        liveQuestionsList.appendChild(qEl);
    });
    
    document.querySelectorAll('.push-btn').forEach(btn => btn.addEventListener('click', pushQuestion));
    document.querySelectorAll('.reveal-btn').forEach(btn => btn.addEventListener('click', revealResults));
}

function generateQRCode(gameId) { qrCodeContainer.innerHTML = ''; const qr = qrcode(0, 'L'); qr.addData(`${window.location.origin}/vote.html?game=${gameId}`); qr.make(); qrCodeContainer.innerHTML = qr.createImgTag(4, 4); }
async function showLobby() { if (!selectedGameId) return; await updateDoc(doc(db, 'games', selectedGameId), { currentQuestionId: null }); }

async function pushQuestion(e) {
    const questionId = e.target.dataset.qId;
    const batch = writeBatch(db);
    batch.update(doc(db, 'games', selectedGameId), { currentQuestionId: questionId });
    batch.update(doc(db, 'games', selectedGameId, 'questions', questionId), { status: 'draft' });
    await batch.commit();
}

async function revealResults(e) {
    const questionId = e.target.dataset.qId;
    const batch = writeBatch(db);
    batch.update(doc(db, 'games', selectedGameId), { currentQuestionId: questionId });
    batch.update(doc(db, 'games', selectedGameId, 'questions', questionId), { status: 'results_revealed' });
    await batch.commit();
}

function initPreviewScaler() {
    if (previewScaler) previewScaler.disconnect();
    const iframe = livePreviewIframe;
    const iframeWidth = parseInt(iframe.width);
    const iframeHeight = parseInt(iframe.height);

    const updateScale = () => {
        const containerWidth = previewWrapper.offsetWidth;
        if (containerWidth > 0) {
            const scale = containerWidth / iframeWidth;
            iframe.style.transform = `scale(${scale})`;
            previewContainer.style.height = `${iframeHeight * scale}px`;
        }
    };
    previewScaler = new ResizeObserver(updateScale);
    previewScaler.observe(previewWrapper);
    updateScale();
}

// --- ANALYTICS TAB ---
function renderAnalyticsTab() {
    Object.values(activeCharts).forEach(chart => chart.destroy());
    activeCharts = {};
    const questionsWithVotes = questions.filter(q => Object.values(q.voteCounts || {}).reduce((sum, count) => sum + count, 0) > 0);
    if (questionsWithVotes.length === 0) {
        analyticsContainer.innerHTML = '<p class="placeholder-text-lg">No results to show yet. Push a question and gather some votes first!</p>';
        return;
    }
    analyticsContainer.innerHTML = '';
    questionsWithVotes.forEach(q => {
        const totalVotes = Object.values(q.voteCounts || {}).reduce((sum, count) => sum + count, 0);
        const card = document.createElement('div');
        card.className = 'analytics-card';
        card.innerHTML = `<h4>${q.questionText}</h4><p>Total Votes: <strong>${totalVotes}</strong></p><div class="analytics-chart-container"><canvas id="chart-${q.id}"></canvas></div>`;
        analyticsContainer.appendChild(card);
        const ctx = document.getElementById(`chart-${q.id}`).getContext('2d');
        if (ctx) {
            activeCharts[q.id] = new Chart(ctx, { type: 'bar', data: { labels: q.options.map(opt => opt.text), datasets: [{ label: 'Votes', data: q.options.map(opt => q.voteCounts[opt.id] || 0), backgroundColor: q.options.map(opt => opt.color) }] }, options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } } });
        }
    });
}

// --- MOBILE SIDEBAR ---
mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('open');
});

document.body.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});


document.addEventListener('DOMContentLoaded', showInitialState);
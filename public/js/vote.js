import { db, doc, onSnapshot, updateDoc, increment } from './app.js';

// DOM Elements
const lobbyState = document.getElementById('lobby-state');
const questionState = document.getElementById('question-state');
const votedState = document.getElementById('voted-state');
const resultsState = document.getElementById('results-state');

const voteGameTitle = document.getElementById('vote-game-title');
const lobbyMessage = document.getElementById('lobby-message');
const questionTitle = document.getElementById('question-title-vote');
const optionsGrid = document.getElementById('options-grid');
// FIX IS HERE: Corrected ID to match vote.html
const resultsQuestionTitle = document.getElementById('results-question-title-vote');
const voteResultsChartCanvas = document.getElementById('vote-results-chart');

// State Variables
let currentGameId = null;
let currentQuestionId = null;
let unsubscribeGame = null; 
let unsubscribeQuestion = null;
let currentChart = null;

// --- UTILITY FUNCTIONS ---
function showState(state, message) {
    // Hide all states first, checking if they exist to prevent errors
    [lobbyState, questionState, votedState, resultsState].forEach(el => {
        if (el) el.classList.add('hidden');
    });

    // Now, show the correct state, also checking if it exists
    if (state === 'lobby' && lobbyState) {
        lobbyState.classList.remove('hidden');
    } else if (state === 'question' && questionState) {
        questionState.classList.remove('hidden');
    } else if (state === 'voted' && votedState) {
        votedState.classList.remove('hidden');
    } else if (state === 'results' && resultsState) {
        resultsState.classList.remove('hidden');
    } else if (state === 'error' && lobbyState) {
        lobbyState.classList.remove('hidden');
        if(voteGameTitle) voteGameTitle.textContent = 'Error';
        if(lobbyMessage) lobbyMessage.textContent = message || 'An error occurred.';
        if (unsubscribeGame) unsubscribeGame();
        if (unsubscribeQuestion) unsubscribeQuestion();
    }
}

// --- CORE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentGameId = params.get('game');
    if (!currentGameId) {
        return showState('error', "No game specified. Make sure your link is correct.");
    }
    showState('lobby');
    listenToGame(currentGameId);
});

function listenToGame(gameId) {
    if (unsubscribeGame) unsubscribeGame(); 

    const gameRef = doc(db, 'games', gameId);
    unsubscribeGame = onSnapshot(gameRef, (gameDoc) => {
        if (!gameDoc.exists()) {
            return showState('error', "This game is no longer available.");
        }

        const gameData = gameDoc.data();
        if(voteGameTitle) voteGameTitle.textContent = `Joining "${gameData.title}"...`;
        
        if (gameData.currentQuestionId && gameData.currentQuestionId !== currentQuestionId) {
            currentQuestionId = gameData.currentQuestionId;
            listenToQuestion(gameId, currentQuestionId);
        } else if (!gameData.currentQuestionId) {
            if (unsubscribeQuestion) unsubscribeQuestion();
            currentQuestionId = null;
            showState('lobby');
        }
    }, (error) => {
        console.error("Game Listener error:", error);
        showState('error', "Lost connection to the game.");
    });
}

function listenToQuestion(gameId, questionId) {
    if (unsubscribeQuestion) unsubscribeQuestion();

    const questionRef = doc(db, 'games', gameId, 'questions', questionId);
    unsubscribeQuestion = onSnapshot(questionRef, (qDoc) => {
        if (!qDoc.exists()) return; 

        const questionData = qDoc.data();
        
        if (questionData.status === 'results_revealed') {
            renderResultsChart(questionData);
            showState('results');
        } else if (sessionStorage.getItem(`voted_${questionId}`)) {
            showState('voted');
        } else {
            renderQuestion(questionData);
            showState('question');
        }
    });
}


function renderQuestion(data) {
    if (questionTitle) questionTitle.textContent = data.questionText;
    if(optionsGrid) optionsGrid.innerHTML = ''; 
    
    data.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = option.text;
        button.style.backgroundColor = option.color;
        button.addEventListener('click', () => handleVote(option.id), { once: true });
        if(optionsGrid) optionsGrid.appendChild(button);
    });
}

async function handleVote(optionId) {
    sessionStorage.setItem(`voted_${currentQuestionId}`, 'true');
    if (navigator.vibrate) navigator.vibrate(100);
    showState('voted');

    try {
        const questionRef = doc(db, 'games', currentGameId, 'questions', currentQuestionId);
        await updateDoc(questionRef, { [`voteCounts.${optionId}`]: increment(1) });
    } catch (error) {
        console.error("Error submitting vote:", error);
    }
}

function renderResultsChart(data) {
    if(resultsQuestionTitle) resultsQuestionTitle.textContent = data.questionText;
    
    const labels = data.options.map(opt => opt.text);
    const colors = data.options.map(opt => opt.color);
    const votes = data.options.map(opt => data.voteCounts[opt.id] || 0);

    if (currentChart) currentChart.destroy();
    if (!voteResultsChartCanvas) return;

    const ctx = voteResultsChartCanvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: data.chartType || 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Votes',
                data: votes,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 1
            }]
        },
        options: {
             indexAxis: data.chartType === 'bar' ? 'y' : 'x', // Makes horizontal bars, standard pie
             responsive: true,
             maintainAspectRatio: false,
             plugins: { legend: { display: false } },
             // THE FIX IS HERE: Same conditional logic as the display page.
             scales: data.chartType === 'bar' ? {
                 y: { beginAtZero: true, ticks: { color: '#333' } },
                 x: { ticks: { color: '#333', stepSize: 1 } }
             } : {}
        }
    });
}
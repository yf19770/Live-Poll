import { db, doc, onSnapshot, updateDoc, increment, getDocs, collection } from './app.js';

// DOM Elements
const lobbyState = document.getElementById('lobby-state');
const questionState = document.getElementById('question-state');
const votedState = document.getElementById('voted-state');
const resultsState = document.getElementById('results-state');
const votePollTitle = document.getElementById('vote-poll-title');
const lobbyMessage = document.getElementById('lobby-message');
const questionTitle = document.getElementById('question-title-vote');
const optionsGrid = document.getElementById('options-grid');
const resultsQuestionTitle = document.getElementById('results-question-title-vote');
const voteResultsChartCanvas = document.getElementById('vote-results-chart');

// State Variables & Setup
let currentUserId = null;
let currentPollId = null;
let currentQuestionId = null;
let unsubscribePoll = null; 
let unsubscribeQuestion = null;
let unsubscribeResults = null; // Listener for results
let currentChart = null;

if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

// --- UTILITY FUNCTIONS ---
function showState(state, message) {
    [lobbyState, questionState, votedState, resultsState].forEach(el => el && el.classList.add('hidden'));
    
    const targetState = document.getElementById(`${state}-state`);
    if (targetState) {
        targetState.classList.remove('hidden');
    } else if (state === 'error' && lobbyState) {
        lobbyState.classList.remove('hidden');
        if (votePollTitle) votePollTitle.textContent = 'Error';
        if (lobbyMessage) lobbyMessage.textContent = message || 'An error occurred.';
        if (unsubscribePoll) unsubscribePoll();
        if (unsubscribeQuestion) unsubscribeQuestion();
        if (unsubscribeResults) unsubscribeResults();
    }
}

// --- CORE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentUserId = params.get('user');
    currentPollId = params.get('poll');
    
    if (!currentPollId || !currentUserId) {
        return showState('error', "Invalid join link. Please get a new one from the host.");
    }
    
    showState('lobby');
    listenToPoll(currentUserId, currentPollId);
});

function listenToPoll(userId, pollId) {
    if (unsubscribePoll) unsubscribePoll(); 

    const pollRef = doc(db, 'users', userId, 'polls', pollId);
    unsubscribePoll = onSnapshot(pollRef, (pollDoc) => {
        if (!pollDoc.exists()) {
            return showState('error', "This poll is no longer available.");
        }
        
        const pollData = pollDoc.data();
        if (votePollTitle) votePollTitle.textContent = `Joining "${pollData.title}"...`;
        
        const newQuestionId = pollData.currentQuestionId;
        if (newQuestionId && newQuestionId !== currentQuestionId) {
            currentQuestionId = newQuestionId;
            listenToQuestion(userId, pollId, currentQuestionId);
        } else if (!newQuestionId) {
            if (unsubscribeQuestion) unsubscribeQuestion();
            if (unsubscribeResults) unsubscribeResults();
            currentQuestionId = null;
            showState('lobby');
        }
    }, (error) => {
        console.error("Poll Listener error:", error);
        showState('error', "Lost connection to the poll.");
    });
}

function listenToQuestion(userId, pollId, questionId) {
    if (unsubscribeQuestion) unsubscribeQuestion();
    if (unsubscribeResults) unsubscribeResults();

    const questionRef = doc(db, 'users', userId, 'polls', pollId, 'questions', questionId);
    unsubscribeQuestion = onSnapshot(questionRef, (qDoc) => {
        if (!qDoc.exists()) return; 

        const questionData = qDoc.data();
        if (questionData.status === 'results_revealed') {
            const resultsRef = doc(questionRef, 'results', 'vote_counts');
            unsubscribeResults = onSnapshot(resultsRef, (resultsDoc) => {
                if (resultsDoc.exists()){
                     const voteCounts = resultsDoc.data().counts;
                     renderResultsChart(questionData, voteCounts);
                     showState('results');
                }
            });
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
    if (optionsGrid) optionsGrid.innerHTML = ''; 
    
    data.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = option.text;
        button.style.backgroundColor = option.color;
        button.addEventListener('click', () => handleVote(option.id), { once: true });
        if(optionsGrid) optionsGrid.appendChild(button);
    });
}

// *** CORRECTED FUNCTION ***
// Directly updates the 'vote_counts' document. Much simpler and more efficient.
async function handleVote(optionId) {
    sessionStorage.setItem(`voted_${currentQuestionId}`, 'true');
    if (navigator.vibrate) navigator.vibrate(100);
    showState('voted');

    try {
        const resultsDocRef = doc(db, 'users', currentUserId, 'polls', currentPollId, 'questions', currentQuestionId, 'results', 'vote_counts');

        // Use dot notation to increment a field within the 'counts' map.
        await updateDoc(resultsDocRef, {
            [`counts.${optionId}`]: increment(1)
        });

    } catch (error) {
        console.error("Error submitting vote:", error);
        sessionStorage.removeItem(`voted_${currentQuestionId}`);
        showState('question');
        alert("Your vote could not be counted. Please try again.");
    }
}

// No changes needed below this line
function renderResultsChart(data, voteCounts) {
    if (resultsQuestionTitle) resultsQuestionTitle.textContent = data.questionText;
    
    const labels = data.options.map(opt => opt.text);
    const colors = data.options.map(opt => opt.color);
    const votes = data.options.map(opt => voteCounts[opt.id] || 0);
    const totalVotes = votes.reduce((a, b) => a + b, 0);

    const legendContainer = document.createElement('div');
    legendContainer.className = 'vote-results-legend';
    data.options.forEach(opt => {
        const voteCount = voteCounts[opt.id] || 0;
        const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100).toFixed(0) : 0;
        legendContainer.innerHTML += `
            <div class="legend-item">
                <span class="legend-color-box" style="background-color: ${opt.color};"></span>
                <span class="legend-text">${opt.text} <strong>(${percentage}%)</strong></span>
            </div>
        `;
    });
    const resultsCard = resultsState.querySelector('.card');
    const existingLegend = resultsCard.querySelector('.vote-results-legend');
    if (existingLegend) existingLegend.remove();
    resultsCard.insertBefore(legendContainer, resultsCard.querySelector('p'));


    if (currentChart) currentChart.destroy();
    if (!voteResultsChartCanvas) return;

    const ctx = voteResultsChartCanvas.getContext('2d');
    currentChart = new Chart(ctx, {
        type: data.chartType || 'bar',
        data: {
            labels,
            datasets: [{ data: votes, backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
             indexAxis: data.chartType === 'bar' ? 'y' : 'x',
             responsive: true,
             maintainAspectRatio: false,
             plugins: { 
                legend: { display: false },
                datalabels: {
                    display: true,
                    color: '#fff',
                    anchor: 'center',
                    align: 'center',
                    font: { size: 16, weight: 'bold' },
                    formatter: (value) => {
                        if (value === 0) return null;
                        if (data.resultsDisplay === 'number') return value;
                        if (totalVotes === 0) return '0%';
                        return `${(value / totalVotes * 100).toFixed(0)}%`;
                    }
                }
             },
             scales: data.chartType === 'bar' ? { 
                 y: { display: false },
                 x: { ticks: { display: false }, grid: { display: false } }
             } : {}
        }
    });
}
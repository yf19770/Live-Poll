import { db } from "../app.js";
import { doc, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function listenForPolls(userId, callback) {
    const pollsRef = collection(db, 'users', userId, 'polls');
    return onSnapshot(pollsRef, snapshot => {
        const userPolls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        userPolls.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
        callback(userPolls);
    });
}

export function listenForQuestions(userId, pollId, callback) {
    const questionsRef = collection(db, 'users', userId, 'polls', pollId, 'questions');
    return onSnapshot(questionsRef, snapshot => {
        const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(questions);
    });
}

export function listenForSinglePoll(userId, pollId, callback) {
    return onSnapshot(doc(db, 'users', userId, 'polls', pollId), callback);
}

export async function createPoll(userId, title) {
    return await addDoc(collection(db, 'users', userId, 'polls'), {
        title: title,
        createdAt: new Date(),
        currentQuestionId: null,
    });
}

// *** CORRECTED FUNCTION ***
// Uses setDoc to create the results document with a predictable ID.
export async function saveQuestion(userId, pollId, questionId, questionData) {
    if (questionId) {
        await updateDoc(doc(db, 'users', userId, 'polls', pollId, 'questions', questionId), questionData);
    } else {
        questionData.status = 'draft';
        const newQuestionRef = await addDoc(collection(db, 'users', userId, 'polls', pollId, 'questions'), questionData);
        
        // Create the results document with a known ID: 'vote_counts'
        const resultsRef = doc(db, 'users', userId, 'polls', pollId, 'questions', newQuestionRef.id, 'results', 'vote_counts');
        const initialCounts = Object.fromEntries(questionData.options.map(opt => [opt.id, 0]));
        await setDoc(resultsRef, { counts: initialCounts });
    }
}

// Now cleans up the known 'vote_counts' document.
export async function deleteQuestion(userId, pollId, questionId) {
    const batch = writeBatch(db);
    const questionRef = doc(db, 'users', userId, 'polls', pollId, 'questions', questionId);
    const resultsRef = doc(questionRef, 'results', 'vote_counts');

    batch.delete(resultsRef); // Delete the results doc
    batch.delete(questionRef); // Delete the question
    await batch.commit();
}


export async function deletePoll(userId, pollId) {
    const questionsRef = collection(db, 'users', userId, 'polls', pollId, 'questions');
    const questionsSnapshot = await getDocs(questionsRef);
    const batch = writeBatch(db);

    for (const qDoc of questionsSnapshot.docs) {
        // For robust cleanup, query the subcollection in case of stray docs
        const resultsSnapshot = await getDocs(collection(qDoc.ref, 'results'));
        resultsSnapshot.forEach(resDoc => batch.delete(resDoc.ref));
        batch.delete(qDoc.ref);
    }
    
    batch.delete(doc(db, 'users', userId, 'polls', pollId));
    await batch.commit();
}

// Now resets the counts in the known 'vote_counts' document.
export async function resetPoll(userId, pollId, questions) {
    const batch = writeBatch(db);
    for (const q of questions) {
        const questionRef = doc(db, 'users', userId, 'polls', pollId, 'questions', q.id);
        batch.update(questionRef, { status: 'draft' });
        
        const resultsRef = doc(questionRef, 'results', 'vote_counts');
        const newVoteCounts = Object.fromEntries(q.options.map(opt => [opt.id, 0]));
        batch.update(resultsRef, { counts: newVoteCounts });
    }
    
    const pollRef = doc(db, 'users', userId, 'polls', pollId);
    batch.update(pollRef, { currentQuestionId: null });
    await batch.commit();
}

export async function pushQuestion(userId, pollId, questionId) {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', userId, 'polls', pollId), { currentQuestionId: questionId });
    batch.update(doc(db, 'users', userId, 'polls', pollId, 'questions', questionId), { status: 'draft' });
    await batch.commit();
}

export async function revealResults(userId, pollId, questionId) {
    await updateDoc(doc(db, 'users', userId, 'polls', pollId, 'questions', questionId), { status: 'results_revealed' });
}

export async function showLobby(userId, pollId) {
    await updateDoc(doc(db, 'users', userId, 'polls', pollId), { currentQuestionId: null });
}
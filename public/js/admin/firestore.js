
import { db } from "../app.js";
import { doc, collection, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

export async function saveQuestion(userId, pollId, questionId, questionData) {
    if (questionId) {
        await updateDoc(doc(db, 'users', userId, 'polls', pollId, 'questions', questionId), questionData);
    } else {
        questionData.status = 'draft';
        questionData.voteCounts = Object.fromEntries(questionData.options.map(opt => [opt.id, 0]));
        await addDoc(collection(db, 'users', userId, 'polls', pollId, 'questions'), questionData);
    }
}

export async function deleteQuestion(userId, pollId, questionId) {
    await deleteDoc(doc(db, 'users', userId, 'polls', pollId, 'questions', questionId));
}

export async function deletePoll(userId, pollId) {
    const questionsRef = collection(db, 'users', userId, 'polls', pollId, 'questions');
    const questionsSnapshot = await getDocs(questionsRef);
    const batch = writeBatch(db);
    questionsSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await deleteDoc(doc(db, 'users', userId, 'polls', pollId));
}

export async function resetPoll(userId, pollId, questions) {
    const batch = writeBatch(db);
    questions.forEach(q => {
        const newVoteCounts = Object.fromEntries(q.options.map(opt => [opt.id, 0]));
        const questionRef = doc(db, 'users', userId, 'polls', pollId, 'questions', q.id);
        batch.update(questionRef, { status: 'draft', voteCounts: newVoteCounts });
    });
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
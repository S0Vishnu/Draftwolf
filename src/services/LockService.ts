
import { db, auth } from '../firebase';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    serverTimestamp,
    getDoc,
    Unsubscribe
} from 'firebase/firestore';

export interface Lock {
    id: string; // The lock ID (e.g. sanitized path)
    filePath: string;
    userId: string;
    userEmail: string;
    timestamp: any;
}

const COLLECTION_NAME = 'locks';

// Helper to sanitize path for document ID
const sanitizePath = (path: string) => {
    // Replace invalid characters for Firestore document IDs but keep uniqueness
    // encodeURIComponent handles most, but we must escape any remaining '/' if any (though encodeURI handles it)
    // Firestore IDs cannot contain forward slashes.
    return encodeURIComponent(path).replaceAll('.', '%2E');
};

export const LockService = {
    // Subscribe to all locks (or filter by project if we add project IDs later)
    subscribeToLocks: (callback: (locks: Lock[]) => void): Unsubscribe => {
        const q = query(collection(db, COLLECTION_NAME));

        return onSnapshot(q, (snapshot) => {
            const locks: Lock[] = [];
            snapshot.forEach((doc) => {
                locks.push({ id: doc.id, ...doc.data() } as Lock);
            });
            callback(locks);
        });
    },

    // Acquire lock
    lockFile: async (relativePath: string) => {
        if (!auth.currentUser) throw new Error("Must be logged in to lock files.");

        const lockId = sanitizePath(relativePath);
        const lockRef = doc(db, COLLECTION_NAME, lockId);

        // Transaction to ensure we don't overwrite
        // For simplicity using get then set, which has a race condition but acceptable for this demo level
        const existing = await getDoc(lockRef);
        if (existing.exists()) {
            const data = existing.data() as Lock;
            if (data.userId !== auth.currentUser.uid) {
                throw new Error(`File is already locked by ${data.userEmail}`);
            }
            // If self-locked, we can update timestamp or just return
            return;
        }

        const lockData = {
            filePath: relativePath,
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email || 'Unknown User',
            timestamp: serverTimestamp()
        };

        await setDoc(lockRef, lockData);
    },

    // Release lock
    unlockFile: async (relativePath: string) => {
        if (!auth.currentUser) throw new Error("Must be logged in.");

        const lockId = sanitizePath(relativePath);
        const lockRef = doc(db, COLLECTION_NAME, lockId);

        const existing = await getDoc(lockRef);
        if (!existing.exists()) return;

        const data = existing.data() as Lock;
        if (data.userId !== auth.currentUser.uid) {
            throw new Error("You cannot unlock a file locked by another user.");
        }

        await deleteDoc(lockRef);
    },

    // Check if locked (synchronous check against cached locks would be better in UI)
    // This is for one-off checks
    isLocked: async (relativePath: string): Promise<Lock | null> => {
        const lockId = sanitizePath(relativePath);
        const lockRef = doc(db, COLLECTION_NAME, lockId);
        const snap = await getDoc(lockRef);
        if (snap.exists()) return { id: snap.id, ...snap.data() } as Lock;
        return null;
    }
};

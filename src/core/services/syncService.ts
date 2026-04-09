// src/core/services/syncService.ts

import {
  writeBatch,
  runTransaction,
  DocumentReference,
  Transaction,
  getFirestore
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ErrorService } from './errorService';
import * as Sentry from '@sentry/react-native';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes an async operation with automatic retries for transient errors.
 * Useful for network blips or generic Firestore timeouts.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    retries = MAX_RETRIES,
    delayMs = RETRY_DELAY_MS
): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0) {
            console.warn(`[SyncService] Operation failed. Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`, error);
            await delay(delayMs);
            return withRetry(operation, retries - 1, delayMs * 2); // Exponential backoff
        }
        
        
        // Log final failure to ErrorService but don't swallow it completely if caller wants to handle it
        Sentry.captureException(error, { extra: { service: 'SyncService' } });
        ErrorService.handleError(error, 'SyncService');
        throw error;
    }
}

export type BatchOperation = 
    | { type: 'set'; ref: DocumentReference; data: any; merge?: boolean }
    | { type: 'update'; ref: DocumentReference; data: any }
    | { type: 'delete'; ref: DocumentReference };

/**
 * Executes a batch of writes securely, wrapped in our retry mechanism.
 */
export async function safeBatchWrite(operations: BatchOperation[]): Promise<void> {
    if (operations.length === 0) return;

    await withRetry(async () => {
        const batch = writeBatch(db);
        
        for (const op of operations) {
            switch (op.type) {
                case 'set':
                    batch.set(op.ref, op.data, { merge: op.merge });
                    break;
                case 'update':
                    batch.update(op.ref, op.data);
                    break;
                case 'delete':
                    batch.delete(op.ref);
                    break;
            }
        }

        await batch.commit();
    });
}

/**
 * Wrapper around Firestore runTransaction that includes retries 
 * and optimistic locking verification inherently if logic demands.
 */
export async function safeTransaction<T>(
    updateFunction: (transaction: Transaction) => Promise<T>
): Promise<T> {
    return withRetry(async () => {
        return await runTransaction(db, async (transaction) => {
            return await updateFunction(transaction);
        });
    });
}

/**
 * Centralized conflict error generator
 */
export function createConflictError(entityName: string): Error {
    const error = new Error(`Conflicto de concurrencia detectado en ${entityName}. Recargue los datos para intentar la operación con la versión actual.`);
    error.name = 'ConcurrencyConflict';
    return error;
}

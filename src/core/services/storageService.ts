import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';

/**
 * Convierte una URI local (file://, content://, etc.) a Blob usando XMLHttpRequest.
 * fetch() no funciona correctamente con URIs locales en React Native.
 */
function uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response as Blob);
        xhr.onerror = () => reject(new Error('No se pudo leer el archivo local.'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
}

export class StorageService {
    /**
     * Sube cualquier archivo (imagen o PDF) a Firebase Storage.
     */
    static async uploadFile(uri: string, path: string, contentType: string): Promise<string> {
        try {
            const blob = await uriToBlob(uri);

            const maxSize = 10 * 1024 * 1024; // 10 MB
            if (blob.size > maxSize) {
                throw new Error('El archivo supera el tamaño máximo permitido de 10MB.');
            }

            const storageRef = ref(storage, path);
            const metadata = { contentType, cacheControl: 'public,max-age=31536000' };
            const snapshot = await uploadBytes(storageRef, blob, metadata);
            return getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error('Error uploading file to storage:', error);
            throw error;
        }
    }

    static async uploadImage(uri: string, path: string): Promise<string> {
        try {
            const blob = await uriToBlob(uri);

            const maxSize = 5 * 1024 * 1024; // 5 MB
            if (blob.size > maxSize) {
                throw new Error('El archivo supera el tamaño máximo permitido de 5MB.');
            }

            const storageRef = ref(storage, path);
            const metadata = {
                contentType: 'image/jpeg',
                cacheControl: 'public,max-age=31536000',
            };

            const snapshot = await uploadBytes(storageRef, blob, metadata);
            return getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error('Error uploading image to storage:', error);
            throw error;
        }
    }
}

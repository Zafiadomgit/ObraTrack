import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';

export class StorageService {
    /**
     * Sube una imagen a Firebase Storage asegurando restricciones de tamaño y metadata de caché.
     */
    static async uploadImage(uri: string, path: string): Promise<string> {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            
            // Limit to 5MB
            const maxSize = 5 * 1024 * 1024;
            if (blob.size > maxSize) {
                throw new Error("El archivo supera el tamaño máximo permitido de 5MB.");
            }

            const storageRef = ref(storage, path);
            const metadata = {
                contentType: 'image/jpeg',
                cacheControl: 'public,max-age=31536000',
            };

            const snapshot = await uploadBytes(storageRef, blob, metadata);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            
            return downloadUrl;
        } catch (error) {
            console.error('Error uploading image to storage:', error);
            throw error;
        }
    }
}

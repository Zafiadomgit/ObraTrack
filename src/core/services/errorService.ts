import { Alert } from 'react-native';
import * as Sentry from '@sentry/react-native';

export class ErrorService {
    static handleError(error: any, context?: string) {
        console.error(`[ErrorService] Error in ${context || 'Unknown'}:`, error);

        // Capture in Sentry
        if (error instanceof Error) {
            Sentry.captureException(error, { extra: { context } });
        } else {
            Sentry.captureMessage(`Error in ${context || 'Unknown'}: ${JSON.stringify(error)}`);
        }

        let title = 'Error';
        let message = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';

        if (error?.name === 'ZodError') {
            title = 'Error de validación';
            message = error.errors.map((e: any) => e.message).join('\n');
        } else if (error?.code?.startsWith('auth/')) {
            title = 'Error de autenticación';
            message = 'Revisa tus credenciales o permisos.';
        } else if (error?.code === 'permission-denied') {
            title = 'Permiso denegado';
            message = 'No tienes permisos para realizar esta acción en tu empresa.';
        } else if (error?.message) {
            if (error.message.includes('offline') || error.message.includes('network')) {
                title = 'Error de Red';
                message = 'Parece que estás desconectado. Los cambios se guardarán localmente.';
            } else {
                message = error.message;
            }
        }

        Alert.alert(title, message);
        return { title, message, originalError: error };
    }
}

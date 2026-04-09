import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { ErrorService } from './errorService';
import { ActivityService } from './activityService';

export class ExportService {
    /**
     * Exports an array of JSON objects to an Excel file (.xlsx).
     * Works on both Web and Mobile (React Native).
     * 
     * @param data Array of objects to export
     * @param fileName Name of the file (without extension)
     * @param sheetName Name of the sheet
     */
    static async exportToExcel(
        companyId: string,
        userId: string,
        data: any[],
        fileName: string,
        sheetName: string = 'Datos'
    ): Promise<void> {
        try {
            if (!data || data.length === 0) {
                throw new Error('No hay datos para exportar.');
            }

            // Create worksheet and workbook
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            if (Platform.OS === 'web') {
                // For Web browsers
                XLSX.writeFile(wb, `${fileName}.xlsx`);
            } else {
                // For iOS and Android
                const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
                const uri = `${FileSystem.documentDirectory}${fileName}.xlsx`;
                
                await FileSystem.writeAsStringAsync(uri, wbout, {
                    encoding: FileSystem.EncodingType.Base64
                });

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        dialogTitle: 'Exportar a Excel'
                    });
                } else {
                    throw new Error('La opción de compartir no está disponible en este dispositivo.');
                }
            }

            // Log activity for auditing
            ActivityService.logActivity(
                companyId,
                userId,
                'exported_excel',
                'system',
                fileName,
                `Exportó datos a Excel: ${fileName}.xlsx`
            );

        } catch (error) {
            ErrorService.handleError(error, 'Exportación a Excel');
        }
    }
}

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DailyReportPayload } from './pdfService';

export const exportService = {
    exportToExcel: async (payload: DailyReportPayload): Promise<boolean> => {
        try {
            const { project, date, dailyLog, presentWorkers, materials, engineerName } = payload;
            const dateStr = format(date, "dd-MMM-yyyy", { locale: es });
            const fileName = `Reporte_${project.nombreProyecto.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
            const fileUri = ((FileSystem as any).documentDirectory || '') + fileName;

            const wb = XLSX.utils.book_new();

            // 1. Resumen Sheet
            const summaryData = [
                ['Reporte Diario de Obra'],
                ['Proyecto', project.nombreProyecto],
                ['Ubicación', project.ubicacion],
                ['Fecha', format(date, "dd 'de' MMMM 'de' yyyy", { locale: es })],
                ['Ingeniero', engineerName],
                [],
                ['Resumen de Actividades'],
                [dailyLog?.actividades || 'Sin registro'],
                [],
                ['Observaciones'],
                [dailyLog?.observaciones || 'Sin observaciones']
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");

            // 2. Personal Sheet
            const personnelData = [['Nombre', 'Cargo', 'Horas']];
            if (presentWorkers.length > 0) {
                presentWorkers.forEach(w => personnelData.push([w.nombre, w.rol, '8']));
            } else {
                personnelData.push(['No hay personal registrado en sitio', '', '']);
            }
            const wsPersonnel = XLSX.utils.aoa_to_sheet(personnelData);
            XLSX.utils.book_append_sheet(wb, wsPersonnel, "Personal");

            // 3. Materiales Sheet
            const materialData = [['Material', 'Cantidad Actual en Obra', 'Unidad']];
            if (materials.length > 0) {
                materials.forEach(m => materialData.push([m.nombre, m.cantidadActual.toString(), m.unidad]));
            } else {
                materialData.push(['No hay materiales en obra', '', '']);
            }
            const wsMaterials = XLSX.utils.aoa_to_sheet(materialData);
            XLSX.utils.book_append_sheet(wb, wsMaterials, "Materiales");

            // Write and Share
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' as any });

            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                    dialogTitle: 'Compartir Archivo Excel',
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    UTI: 'com.microsoft.excel.xls'
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error generating Excel:", error);
            throw error;
        }
    },

    exportToCSV: async (payload: DailyReportPayload): Promise<boolean> => {
        try {
            const { project, date, presentWorkers, materials } = payload;
            const dateStr = format(date, "dd-MMM-yyyy", { locale: es });
            const fileName = `Export_${project.nombreProyecto.replace(/\s+/g, '_')}_${dateStr}.csv`;
            const fileUri = ((FileSystem as any).documentDirectory || '') + fileName;

            let csvData = `Reporte, Proyecto: ${project.nombreProyecto}, Fecha: ${dateStr}\n\n`;

            csvData += `--- PERSONAL EN OBRA ---\n`;
            csvData += `Nombre,Cargo,Horas\n`;
            presentWorkers.forEach(w => {
                csvData += `${w.nombre},${w.rol},8\n`;
            });

            csvData += `\n--- MATERIALES EN OBRA ---\n`;
            csvData += `Material,Cantidad,Unidad\n`;
            materials.forEach(m => {
                csvData += `${m.nombre},${m.cantidadActual},${m.unidad}\n`;
            });

            // Using 'utf8' string literal to bypass potential typing mismatch
            await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: 'utf8' as any });

            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                    dialogTitle: 'Compartir Archivo CSV',
                    mimeType: 'text/csv',
                    UTI: 'public.comma-separated-values-text'
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error("Error generating CSV:", error);
            throw error;
        }
    }
};

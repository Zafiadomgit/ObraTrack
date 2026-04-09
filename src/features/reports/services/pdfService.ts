import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Project } from '../../projects/store/projectStore';
import { DailyLog } from '../store/reportStore';
import { Worker } from '../../personnel/store/personnelStore';
import * as FileSystem from 'expo-file-system';
import { Material } from '../../materials/store/materialStore';
import { logoBase64 } from '../../../core/theme/logoBase64';

export interface DailyReportPayload {
    project: Project;
    dailyLog: DailyLog | undefined;
    presentWorkers: Worker[];
    materials: Material[];
    isPro: boolean;
    date: Date;
    engineerName: string;
    engineerSignature?: string;
}

export const pdfService = {
    generateDailyReport: async (payload: DailyReportPayload, customFileName?: string): Promise<string> => {
        try {
            const { project, dailyLog, presentWorkers, materials, isPro, date, engineerName, engineerSignature } = payload;

            const startDate = new Date(project.fechaInicio);
            const executionDays = Math.max(1, Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));

            const dateStr = format(date, "dd 'de' MMMM 'de' yyyy", { locale: es });

            const summaryText = dailyLog?.actividades
                ? `Durante la jornada se ejecutaron las siguientes actividades: ${dailyLog.actividades}. Clima registrado: ${dailyLog.clima}.`
                : 'No se registraron actividades específicas para esta fecha en la bitácora.';

            const observacionesText = dailyLog?.observaciones || 'Sin observaciones adicionales.';

            const workStartTime = dailyLog?.horaInicio ? format(new Date(dailyLog.horaInicio), 'HH:mm') : 'No registrado';
            const workEndTime = dailyLog?.horaFin ? format(new Date(dailyLog.horaFin), 'HH:mm') : 'No registrado';

            // Build workers rows
            let workersRows = '';
            let totalLaborCostDay = 0;
            if (presentWorkers.length > 0) {
                presentWorkers.forEach(w => {
                    totalLaborCostDay += w.costoDia;
                    workersRows += `<tr><td>${w.nombre}</td><td>${w.rol}</td><td>${w.diasTrabajados.length} días</td><td>$${w.costoDia.toLocaleString()}</td></tr>`;
                });
            } else {
                workersRows = '<tr><td colspan="4" style="text-align:center;">No hay personal registrado en sitio</td></tr>';
            }

            // Build materials rows
            let materialsRows = '';
            if (materials.length > 0) {
                materials.forEach(m => {
                    materialsRows += `<tr><td>${m.nombre}</td><td>${m.cantidadActual}</td><td>${m.unidad}</td></tr>`;
                });
            } else {
                materialsRows = '<tr><td colspan="3" style="text-align:center;">No hay materiales registrados</td></tr>';
            }

            // Signature HTML
            const sigHtml = engineerSignature
                ? `<img src="${engineerSignature}" style="max-width:200px;max-height:80px;display:block;" />`
                : '<div style="height:60px;border-bottom:1px solid #333;"></div>';

            // IMPORTANT: No display:flex, no CSS variables, no advanced CSS to ensure expo-print compatibility
            const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: Arial, sans-serif; padding: 20px; color: #222; }
h1 { font-size: 20px; color: #1A3A5C; margin-bottom: 4px; }
.subtitle { font-size: 12px; color: #666; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
th { background: #1A3A5C; color: #fff; padding: 8px; font-size: 12px; text-align: left; }
td { border: 1px solid #ddd; padding: 7px; font-size: 12px; }
tr:nth-child(even) { background: #f5f7fa; }
.section-title { font-size: 14px; font-weight: bold; color: #1A3A5C; margin-top: 20px; margin-bottom: 6px; border-left: 3px solid #2E86C1; padding-left: 8px; }
.info-box { background: #EBF5FB; padding: 10px; font-size: 12px; border-left: 3px solid #2E86C1; margin-bottom: 16px; }
.sig-block { margin-top: 40px; }
.sig-name { font-weight: bold; margin-top: 6px; font-size: 13px; }
.sig-role { font-size: 11px; color: #888; }
.pro-badge { display: inline-block; background: #1A3A5C; color: #fff; font-size: 9px; padding: 2px 6px; border-radius: 3px; }
</style>
</head>
<body>
<div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #00458B; padding-bottom: 10px; margin-bottom: 20px;">
    <img src="${logoBase64}" style="max-height: 45px;" alt="ObraTrack Logo" />
    <h1 style="margin: 0; color: #00458B;">Reporte de Obra</h1>
</div>
<div class="subtitle">
Proyecto: <b>${project.nombreProyecto}</b> &nbsp;|&nbsp;
Fecha: <b>${dateStr}</b> &nbsp;|&nbsp;
Día de Ejecución: <b>#${executionDays}</b>
</div>
<div class="subtitle">
Horario Cuadrilla: <b>${workStartTime} - ${workEndTime}</b>
</div>
<div class="subtitle">
Ubicación: <b>${project.ubicacion}</b> &nbsp;|&nbsp;
Ingeniero: <b>${engineerName}</b>
${isPro ? '<span class="pro-badge">PRO</span>' : ''}
</div>

<div class="section-title">Resumen de Actividades</div>
<div class="info-box">${summaryText}</div>

<div class="section-title">Personal y Mano de Obra</div>
<table>
<tr><th>Nombre</th><th>Cargo</th><th>Total Días</th><th>Costo/Día</th></tr>
${workersRows}
<tr style="background:#EBF5FB; font-weight:bold;"><td colspan="3">Inversión Mano de Obra Hoy</td><td>$${totalLaborCostDay.toLocaleString()}</td></tr>
</table>

<div class="section-title">Materiales en Obra</div>
<table>
<tr><th>Material</th><th>Cantidad en Obra</th><th>Unidad</th></tr>
${materialsRows}
</table>

<div class="section-title">Observaciones</div>
<div class="info-box">${observacionesText}</div>

<div class="sig-block">
${sigHtml}
<div class="sig-name">${engineerName}</div>
<div class="sig-role">Ingeniero Responsable</div>
<div class="sig-role">Generado con ObraTrack ${isPro ? 'Pro' : ''}</div>
</div>
</body>
</html>`;

            console.log('[pdfService] Generating PDF with expo-print...');
            const result = await Print.printToFileAsync({
                html,
                base64: false
            });
            console.log('[pdfService] PDF generated at:', result.uri);

            if (customFileName) {
                const targetPath = `${((FileSystem as any).cacheDirectory || '')}${customFileName}`;
                await FileSystem.copyAsync({
                    from: result.uri,
                    to: targetPath
                });
                return targetPath;
            }

            return result.uri;

        } catch (error: any) {
            const msg = error?.message || String(error);
            console.error('[pdfService] ERROR:', msg, error);
            throw new Error(`PDF Error: ${msg}`);
        }
    },

    sharePDF: async (uri: string) => {
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(uri, {
                    dialogTitle: 'Compartir Reporte Diario',
                    mimeType: 'application/pdf',
                    UTI: 'com.adobe.pdf'
                });
            } else {
                alert('El sistema de compartir no está disponible en este dispositivo.');
            }
        } catch (err: any) {
            console.error('[pdfService] Share error:', err?.message || err);
            throw err;
        }
    }
};

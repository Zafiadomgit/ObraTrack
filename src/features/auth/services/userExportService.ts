/**
 * User List Export Service
 * Handles PDF, Excel and CSV export of the users table for the Admin panel.
 * Works on both web (download via blob) and mobile (share via expo-sharing).
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { User } from '../../../store/appStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
    if (!iso) return '–';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function capitalize(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── Web download helper ─────────────────────────────────────────────────────

function downloadOnWeb(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export async function exportUsersCSV(users: User[]) {
    const header = ['Nombre', 'Cédula', 'Email', 'Rol', 'Estado', 'Fecha Registro'];
    const rows = users.map(u => [
        u.nombre,
        u.cedula || '–',
        u.email,
        capitalize(u.role),
        capitalize(u.status),
        formatDate(u.fechaRegistro),
    ]);

    const csv = [header, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const filename = `ObraTrack_Usuarios_${new Date().toISOString().split('T')[0]}.csv`;

    if (Platform.OS === 'web') {
        downloadOnWeb(csv, filename, 'text/csv;charset=utf-8;');
        return true;
    }

    // Mobile: use expo-file-system + expo-sharing
    try {
        const fileUri = ((FileSystem as any).documentDirectory || '') + filename;
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' as any });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Exportar usuarios CSV' });
        }
        return true;
    } catch (e) {
        console.error('CSV export error', e);
        return false;
    }
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function exportUsersExcel(users: User[]) {
    try {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const filename = `ObraTrack_Usuarios_${new Date().toISOString().split('T')[0]}.xlsx`;

        const data: (string | number)[][] = [
            ['ObraTrack — Lista de Usuarios'],
            [`Exportado: ${new Date().toLocaleString('es-CO')}`],
            [],
            ['Nombre', 'Cédula', 'Email', 'Rol', 'Estado', 'Fecha Registro'],
            ...users.map(u => [
                u.nombre,
                u.cedula || '–',
                u.email,
                capitalize(u.role),
                capitalize(u.status),
                formatDate(u.fechaRegistro),
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');

        if (Platform.OS === 'web') {
            XLSX.writeFile(wb, filename);
            return true;
        }

        // Mobile
        const fileUri = ((FileSystem as any).documentDirectory || '') + filename;
        const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: 'base64' as any });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Exportar usuarios Excel',
            });
        }
        return true;
    } catch (e) {
        console.error('Excel export error', e);
        return false;
    }
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function exportUsersPDF(users: User[]) {
    try {
        const rows = users.map((u, i) => `
            <tr style="background:${i % 2 === 0 ? '#1a2635' : '#0f1923'}">
                <td>${u.nombre}</td>
                <td>${u.cedula || '–'}</td>
                <td style="font-size:11px">${u.email}</td>
                <td><span class="badge badge-${u.role}">${capitalize(u.role)}</span></td>
                <td><span class="badge badge-${u.status}">${capitalize(u.status)}</span></td>
                <td>${formatDate(u.fechaRegistro)}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>ObraTrack — Usuarios</title>
<style>
  body { font-family: Arial, sans-serif; background:#0f1923; color:#e2e8f0; margin:0; padding:20px; }
  .header { display:flex; align-items:center; margin-bottom:24px; border-bottom:2px solid #2563eb; padding-bottom:16px; }
  .header h1 { font-size:22px; margin:0; color:#fff; }
  .header small { color:#64748b; font-size:12px; display:block; margin-top:4px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#1e3a5f; color:#93c5fd; padding:10px 8px; text-align:left; font-weight:600; }
  td { padding:9px 8px; border-bottom:1px solid #1e2d3d; }
  .badge { padding:3px 8px; border-radius:12px; font-size:10px; font-weight:700; }
  .badge-admin { background:#1e3a5f; color:#93c5fd; }
  .badge-coordinador { background:#1e3f2f; color:#4ade80; }
  .badge-lider { background:#3b2a1e; color:#fb923c; }
  .badge-conductor { background:#2e1e3f; color:#c084fc; }
  .badge-logistica { background:#3f2e1e; color:#fbbf24; }
  .badge-approved { background:#14532d; color:#86efac; }
  .badge-pending { background:#451a03; color:#fde68a; }
  .badge-suspended { background:#450a0a; color:#fca5a5; }
  .footer { margin-top:20px; color:#64748b; font-size:11px; text-align:center; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>OBRA<span style="color:#2563eb">TRACK</span> — Lista de Usuarios</h1>
    <small>Exportado el ${new Date().toLocaleString('es-CO')} · Total: ${users.length} usuarios</small>
  </div>
</div>
<table>
  <thead><tr>
    <th>Nombre</th><th>Cédula</th><th>Email</th><th>Rol</th><th>Estado</th><th>Registro</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">© ${new Date().getFullYear()} ObraTrack — Documento confidencial. Uso interno.</div>
</body>
</html>`;

        if (Platform.OS === 'web') {
            // Guide the user: Chrome requires them to change destination to "Guardar como PDF"
            window.alert('Se abrirá el panel de impresión.\nEn "Destino", selecciona "Guardar como PDF" para descargar el archivo.');
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
                // Wait for full content load before triggering the print dialog
                if (win.document.readyState === 'complete') {
                    setTimeout(() => win.print(), 400);
                } else {
                    win.onload = () => setTimeout(() => win.print(), 400);
                }
            }
            return true;
        }

        // Mobile: expo-print + expo-sharing
        const Print = await import('expo-print');
        const Sharing = await import('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar usuarios PDF' });
        }
        return true;
    } catch (e) {
        console.error('PDF export error', e);
        return false;
    }
}

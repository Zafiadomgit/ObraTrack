export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
    }).format(value);
}

export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatShortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
    });
}

export function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Validates a date string in YYYY-MM-DD format AND that it is a real calendar
 * date (e.g. rejects 2026-13-45 or 2026-02-30). Returns true only for valid dates.
 */
export function isValidDateString(value: string): boolean {
    if (!value) return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return false;
    const [, y, m, d] = match;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    // Reject overflow (e.g. Feb 30 rolls over to March) and invalid dates.
    return (
        !isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

export function getProgressColor(progress: number): string {
    if (progress < 30) return '#E74C3C';
    if (progress < 60) return '#F39C12';
    return '#2ECC71';
}

export function getStatusColor(status: string): string {
    switch (status) {
        case 'Activo': return '#2ECC71';
        case 'En pausa': return '#F39C12';
        case 'Completado': return '#3498DB';
        default: return '#8A9BB0';
    }
}

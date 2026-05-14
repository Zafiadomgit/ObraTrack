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

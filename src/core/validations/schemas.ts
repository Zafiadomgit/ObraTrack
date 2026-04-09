import { z } from 'zod';

export const ActivityLogSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1, 'Company ID es requerido'),
    userId: z.string().min(1, 'User ID es requerido'),
    action: z.string(),
    entityId: z.string().optional(),
    entityType: z.string().optional(),
    description: z.string().optional(),
    timestamp: z.number()
});

export const BaseEntitySchema = z.object({
    id: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    synced: z.boolean(),
    userId: z.string(),
    companyId: z.string(),
    version: z.number().int().min(1).default(1)
});

export const ProjectSchema = BaseEntitySchema.extend({
    nombreProyecto: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    ubicacion: z.string().min(5, "Ubicación demasiado corta"),
    fechaInicio: z.string(),
    fechaFin: z.string().optional(),
    estado: z.enum(['activo', 'pausa', 'completado']),
    tipoProyecto: z.string(),
    collaborators: z.array(z.string()).optional()
});

export const MaterialSchema = BaseEntitySchema.extend({
    projectId: z.string(),
    nombre: z.string().min(2),
    unidad: z.string(),
    categoria: z.string(),
    costoUnitario: z.number().min(0, "Costo no puede ser negativo"),
    stock: z.number().min(0, "Stock no puede ser negativo"),
    enviado: z.number().min(0),
    cantidadActual: z.number().min(0),
    minimoAlerta: z.number().min(0),
    stockMinimoObra: z.number().min(0),
    totalUsado: z.number().min(0),
    proveedor: z.string().optional(),
    unidadDestino: z.string().optional(),
    historialTransacciones: z.array(z.any())
});

export const WorkerSchema = BaseEntitySchema.extend({
    projectId: z.string(),
    nombre: z.string().min(2),
    rol: z.enum(['lider', 'tecnico', 'ayudante']),
    cargo: z.string(),
    cuadrilla: z.string(),
    costoDia: z.number().min(0, "Costo no puede ser negativo"),
    diasTrabajados: z.array(z.string())
});

export const DailyLogSchema = BaseEntitySchema.extend({
    projectId: z.string(),
    fecha: z.string(),
    actividades: z.string().min(5, "Las actividades son obligatorias"),
    clima: z.enum(['soleado', 'nublado', 'lluvia']),
    observaciones: z.string().optional(),
    listaFotos: z.array(z.string()),
    trabajadoresPresentes: z.array(z.string()),
    horaInicio: z.string().optional(),
    horaFin: z.string().optional()
});

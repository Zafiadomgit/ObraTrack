/**
 * Standard material catalogs per project type.
 * Based on industry-standard specifications for each construction category.
 */

export type ProjectType = 'obras_civiles' | 'edificios_casas' | 'torres_telecomunicaciones' | 'otro';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
    obras_civiles: 'Obras Civiles',
    edificios_casas: 'Edificios / Casas',
    torres_telecomunicaciones: 'Torres de Telecomunicaciones',
    otro: 'Otro',
};

export const PROJECT_TYPE_ICONS: Record<ProjectType, string> = {
    obras_civiles: '🌉',
    edificios_casas: '🏗️',
    torres_telecomunicaciones: '📡',
    otro: '🔨',
};

interface StandardMaterial {
    nombre: string;
    unidad: string;
    categoria: string;
    costoUnitario: number;
    minimoAlerta: number;
    stockMinimoObra: number;
}

export const STANDARD_MATERIALS: Record<ProjectType, StandardMaterial[]> = {

    // ─────────────────────────────────────────────────────────────
    // 📡 Torres de Telecomunicaciones
    // Prioridad: alta resistencia a la corrosión, relación peso/resistencia
    // ─────────────────────────────────────────────────────────────
    torres_telecomunicaciones: [
        // Estructura principal
        { nombre: 'Acero galvanizado ASTM A36', unidad: 'kg', categoria: 'Estructura', costoUnitario: 3.5, minimoAlerta: 500, stockMinimoObra: 1000 },
        { nombre: 'Acero galvanizado ASTM A572', unidad: 'kg', categoria: 'Estructura', costoUnitario: 4.0, minimoAlerta: 300, stockMinimoObra: 800 },
        { nombre: 'Perfil ángulo galvanizado 3"x1/4"', unidad: 'ml', categoria: 'Estructura', costoUnitario: 12.0, minimoAlerta: 50, stockMinimoObra: 150 },
        // Fijación
        { nombre: 'Tornillo alta resistencia Gr.8 5/8"', unidad: 'unidad', categoria: 'Fijación', costoUnitario: 1.8, minimoAlerta: 100, stockMinimoObra: 500 },
        { nombre: 'Tornillo alta resistencia Gr.5 1/2"', unidad: 'unidad', categoria: 'Fijación', costoUnitario: 1.2, minimoAlerta: 100, stockMinimoObra: 400 },
        { nombre: 'Tuerca hexagonal recubierta zinc 5/8"', unidad: 'unidad', categoria: 'Fijación', costoUnitario: 0.8, minimoAlerta: 100, stockMinimoObra: 500 },
        { nombre: 'Arandela plana recubierta zinc', unidad: 'unidad', categoria: 'Fijación', costoUnitario: 0.3, minimoAlerta: 200, stockMinimoObra: 600 },
        // Cimentación
        { nombre: 'Concreto 280 kg/cm²', unidad: 'm³', categoria: 'Cimentación', costoUnitario: 145.0, minimoAlerta: 5, stockMinimoObra: 20 },
        { nombre: 'Varilla corrugada #5 (5/8")', unidad: 'varilla', categoria: 'Cimentación', costoUnitario: 9.5, minimoAlerta: 50, stockMinimoObra: 200 },
        { nombre: 'Varilla corrugada #3 (3/8")', unidad: 'varilla', categoria: 'Cimentación', costoUnitario: 4.5, minimoAlerta: 50, stockMinimoObra: 150 },
        { nombre: 'Alambre de amarre #18', unidad: 'kg', categoria: 'Cimentación', costoUnitario: 2.0, minimoAlerta: 20, stockMinimoObra: 50 },
        // Puesta a tierra
        { nombre: 'Cable cobre desnudo 2/0 AWG', unidad: 'ml', categoria: 'Puesta a Tierra', costoUnitario: 6.5, minimoAlerta: 30, stockMinimoObra: 100 },
        { nombre: 'Varilla Copperweld 5/8"x2.4m', unidad: 'unidad', categoria: 'Puesta a Tierra', costoUnitario: 28.0, minimoAlerta: 2, stockMinimoObra: 6 },
        { nombre: 'Soldadura exotérmica (carga 25g)', unidad: 'unidad', categoria: 'Puesta a Tierra', costoUnitario: 12.0, minimoAlerta: 5, stockMinimoObra: 20 },
        { nombre: 'Conectores de compresión para tierra', unidad: 'unidad', categoria: 'Puesta a Tierra', costoUnitario: 4.5, minimoAlerta: 5, stockMinimoObra: 20 },
    ],

    // ─────────────────────────────────────────────────────────────
    // 🌉 Obras Civiles (Puentes, Vías, Represas)
    // Prioridad: durabilidad largo plazo, grandes esfuerzos de compresión/tensión
    // ─────────────────────────────────────────────────────────────
    obras_civiles: [
        // Concreto
        { nombre: 'Concreto HPC 350 kg/cm²', unidad: 'm³', categoria: 'Concreto', costoUnitario: 180.0, minimoAlerta: 10, stockMinimoObra: 40 },
        { nombre: 'Concreto 280 kg/cm²', unidad: 'm³', categoria: 'Concreto', costoUnitario: 145.0, minimoAlerta: 10, stockMinimoObra: 30 },
        { nombre: 'Aditivo plastificante (sika)', unidad: 'litro', categoria: 'Concreto', costoUnitario: 8.0, minimoAlerta: 20, stockMinimoObra: 50 },
        // Acero de refuerzo
        { nombre: 'Varilla corrugada Gr.60 #8 (1")', unidad: 'varilla', categoria: 'Acero Refuerzo', costoUnitario: 18.0, minimoAlerta: 50, stockMinimoObra: 200 },
        { nombre: 'Varilla corrugada Gr.60 #6 (3/4")', unidad: 'varilla', categoria: 'Acero Refuerzo', costoUnitario: 12.0, minimoAlerta: 50, stockMinimoObra: 150 },
        { nombre: 'Varilla corrugada Gr.60 #4 (1/2")', unidad: 'varilla', categoria: 'Acero Refuerzo', costoUnitario: 7.5, minimoAlerta: 80, stockMinimoObra: 200 },
        { nombre: 'Malla electrosoldada 6-6-8-8', unidad: 'm²', categoria: 'Acero Refuerzo', costoUnitario: 5.5, minimoAlerta: 100, stockMinimoObra: 300 },
        { nombre: 'Alambre de amarre #18', unidad: 'kg', categoria: 'Acero Refuerzo', costoUnitario: 2.0, minimoAlerta: 30, stockMinimoObra: 80 },
        // Gaviones y geosintéticos
        { nombre: 'Gavión caja malla triple torsión 1x1x1', unidad: 'unidad', categoria: 'Contención', costoUnitario: 35.0, minimoAlerta: 10, stockMinimoObra: 50 },
        { nombre: 'Geotextil no tejido NT1600 (rollos)', unidad: 'rollo', categoria: 'Contención', costoUnitario: 120.0, minimoAlerta: 2, stockMinimoObra: 8 },
        { nombre: 'Geomembrana HDPE 1mm', unidad: 'm²', categoria: 'Contención', costoUnitario: 4.5, minimoAlerta: 100, stockMinimoObra: 500 },
        // Pavimentación
        { nombre: 'Mezcla asfáltica MDC-19 (tráfico pesado)', unidad: 'ton', categoria: 'Pavimento', costoUnitario: 95.0, minimoAlerta: 10, stockMinimoObra: 50 },
        { nombre: 'Asfalto líquido MC-30', unidad: 'galón', categoria: 'Pavimento', costoUnitario: 6.0, minimoAlerta: 50, stockMinimoObra: 200 },
        { nombre: 'Subbase granular compactada', unidad: 'm³', categoria: 'Pavimento', costoUnitario: 22.0, minimoAlerta: 20, stockMinimoObra: 100 },
        // Formaletas y encofrado
        { nombre: 'Formaleta metálica (alquiler día)', unidad: 'día', categoria: 'Encofrado', costoUnitario: 8.0, minimoAlerta: 0, stockMinimoObra: 0 },
        { nombre: 'Madera contrachapada 18mm', unidad: 'lámina', categoria: 'Encofrado', costoUnitario: 28.0, minimoAlerta: 10, stockMinimoObra: 30 },
    ],

    // ─────────────────────────────────────────────────────────────
    // 🏗️ Edificios / Casas
    // Prioridad: reducción de peso propio, resistencia sísmica, acabados
    // ─────────────────────────────────────────────────────────────
    edificios_casas: [
        // Estructura pórticos
        { nombre: 'Concreto 210 kg/cm² (columnas/vigas)', unidad: 'm³', categoria: 'Estructura', costoUnitario: 130.0, minimoAlerta: 5, stockMinimoObra: 20 },
        { nombre: 'Varilla corrugada #4 (1/2")', unidad: 'varilla', categoria: 'Estructura', costoUnitario: 7.5, minimoAlerta: 100, stockMinimoObra: 300 },
        { nombre: 'Varilla corrugada #5 (5/8")', unidad: 'varilla', categoria: 'Estructura', costoUnitario: 9.5, minimoAlerta: 80, stockMinimoObra: 250 },
        { nombre: 'Perfil IPE-200 estructural', unidad: 'ml', categoria: 'Estructura', costoUnitario: 22.0, minimoAlerta: 20, stockMinimoObra: 80 },
        { nombre: 'Alambre de amarre #18', unidad: 'kg', categoria: 'Estructura', costoUnitario: 2.0, minimoAlerta: 30, stockMinimoObra: 60 },
        // Losas aligeradas
        { nombre: 'Bloque de arcilla aligeradora 25cm', unidad: 'unidad', categoria: 'Losas', costoUnitario: 1.2, minimoAlerta: 500, stockMinimoObra: 2000 },
        { nombre: 'Poliestireno expandido hoja 25mm', unidad: 'm²', categoria: 'Losas', costoUnitario: 3.5, minimoAlerta: 50, stockMinimoObra: 200 },
        { nombre: 'Steel Deck lámina calibre 22', unidad: 'm²', categoria: 'Losas', costoUnitario: 9.0, minimoAlerta: 20, stockMinimoObra: 80 },
        // Mampostería
        { nombre: 'Ladrillo arcilla H-10', unidad: 'millar', categoria: 'Mampostería', costoUnitario: 550.0, minimoAlerta: 1, stockMinimoObra: 5 },
        { nombre: 'Bloque de concreto 20x20x40', unidad: 'unidad', categoria: 'Mampostería', costoUnitario: 2.0, minimoAlerta: 200, stockMinimoObra: 800 },
        { nombre: 'Cemento gris saco 50kg', unidad: 'saco', categoria: 'Mampostería', costoUnitario: 12.0, minimoAlerta: 20, stockMinimoObra: 80 },
        { nombre: 'Arena fina m³', unidad: 'm³', categoria: 'Mampostería', costoUnitario: 35.0, minimoAlerta: 3, stockMinimoObra: 10 },
        // Cubierta
        { nombre: 'Teja fibrocemento ondulada 2.44m', unidad: 'unidad', categoria: 'Cubierta', costoUnitario: 8.5, minimoAlerta: 30, stockMinimoObra: 100 },
        { nombre: 'Correa galvanizada 4"x2"x1/16"', unidad: 'ml', categoria: 'Cubierta', costoUnitario: 5.0, minimoAlerta: 30, stockMinimoObra: 100 },
        // Acabados interiores
        { nombre: 'Panel Drywall 1/2"x1.22x2.44m', unidad: 'lámina', categoria: 'Acabados', costoUnitario: 18.0, minimoAlerta: 20, stockMinimoObra: 80 },
        { nombre: 'Porcelanato 60x60 (caja)', unidad: 'caja', categoria: 'Acabados', costoUnitario: 38.0, minimoAlerta: 10, stockMinimoObra: 40 },
        { nombre: 'Pintura vinílica interior (baldes 4gl)', unidad: 'balde', categoria: 'Acabados', costoUnitario: 45.0, minimoAlerta: 3, stockMinimoObra: 12 },
        // Instalaciones
        { nombre: 'Tubería conduit PVC 3/4"x3m', unidad: 'unidad', categoria: 'Eléctricas', costoUnitario: 3.5, minimoAlerta: 30, stockMinimoObra: 100 },
        { nombre: 'Cable THHN 12 AWG (rollo 100m)', unidad: 'rollo', categoria: 'Eléctricas', costoUnitario: 48.0, minimoAlerta: 3, stockMinimoObra: 10 },
        { nombre: 'Tubería CPVC 1/2"x6m', unidad: 'unidad', categoria: 'Hidrosanitario', costoUnitario: 6.5, minimoAlerta: 10, stockMinimoObra: 40 },
        { nombre: 'Tubería PVC sanitaria 4"x6m', unidad: 'unidad', categoria: 'Hidrosanitario', costoUnitario: 18.0, minimoAlerta: 5, stockMinimoObra: 20 },
    ],

    // ─────────────────────────────────────────────────────────────
    // 🔨 Otro (materiales base genéricos)
    // ─────────────────────────────────────────────────────────────
    otro: [
        { nombre: 'Cemento gris saco 50kg', unidad: 'saco', categoria: 'General', costoUnitario: 12.0, minimoAlerta: 20, stockMinimoObra: 50 },
        { nombre: 'Arena fina', unidad: 'm³', categoria: 'General', costoUnitario: 35.0, minimoAlerta: 3, stockMinimoObra: 10 },
        { nombre: 'Grava triturada', unidad: 'm³', categoria: 'General', costoUnitario: 30.0, minimoAlerta: 3, stockMinimoObra: 10 },
        { nombre: 'Varilla corrugada #4 (1/2")', unidad: 'varilla', categoria: 'Acero', costoUnitario: 7.5, minimoAlerta: 50, stockMinimoObra: 150 },
        { nombre: 'Alambre de amarre #18', unidad: 'kg', categoria: 'Acero', costoUnitario: 2.0, minimoAlerta: 20, stockMinimoObra: 40 },
        { nombre: 'Madera tabla 1"x6"x3m', unidad: 'unidad', categoria: 'Madera', costoUnitario: 5.0, minimoAlerta: 20, stockMinimoObra: 60 },
        { nombre: 'Clavo 2.5" (caja 1kg)', unidad: 'caja', categoria: 'Ferretería', costoUnitario: 3.0, minimoAlerta: 5, stockMinimoObra: 15 },
        { nombre: 'Pintura exterior (balde 4gl)', unidad: 'balde', categoria: 'Acabados', costoUnitario: 55.0, minimoAlerta: 2, stockMinimoObra: 8 },
    ],
};

/**
 * Returns the standard material list for a given project type,
 * enriched with projectId and userId so they're ready to insert in the store.
 */
export function getStandardMaterials(
    tipoProyecto: ProjectType,
    projectId: string,
    userId: string,
    companyId: string
) {
    return STANDARD_MATERIALS[tipoProyecto].map(m => ({
        ...m,
        projectId,
        userId,
        companyId,
    }));
}

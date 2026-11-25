// Regiones de Chile (de norte a sur) y sus 346 comunas, según la división
// político-administrativa vigente (SUBDERE / INE). El checkout las ofrece como
// listas desplegables: el cliente no escribe región ni comuna a mano y la
// analítica de ventas por comuna recibe siempre el mismo nombre (sin
// "Stgo", "metropolitana" ni faltas de ortografía).
//
// Los nombres de región siguen el formato que ya usan los datos de la tienda
// (p. ej. "Región Metropolitana", "Biobío"), así que los pedidos antiguos y el
// dataset sintético calzan con los nuevos.

export interface ChileRegion {
  name: string;
  communes: readonly string[];
}

export const CHILE_REGIONS: readonly ChileRegion[] = [
  {
    name: 'Arica y Parinacota',
    communes: ['Arica', 'Camarones', 'General Lagos', 'Putre'],
  },
  {
    name: 'Tarapacá',
    communes: ['Alto Hospicio', 'Camiña', 'Colchane', 'Huara', 'Iquique', 'Pica', 'Pozo Almonte'],
  },
  {
    name: 'Antofagasta',
    communes: [
      'Antofagasta', 'Calama', 'María Elena', 'Mejillones', 'Ollagüe', 'San Pedro de Atacama',
      'Sierra Gorda', 'Taltal', 'Tocopilla',
    ],
  },
  {
    name: 'Atacama',
    communes: [
      'Alto del Carmen', 'Caldera', 'Chañaral', 'Copiapó', 'Diego de Almagro', 'Freirina', 'Huasco',
      'Tierra Amarilla', 'Vallenar',
    ],
  },
  {
    name: 'Coquimbo',
    communes: [
      'Andacollo', 'Canela', 'Combarbalá', 'Coquimbo', 'Illapel', 'La Higuera', 'La Serena', 'Los Vilos',
      'Monte Patria', 'Ovalle', 'Paihuano', 'Punitaqui', 'Río Hurtado', 'Salamanca', 'Vicuña',
    ],
  },
  {
    name: 'Valparaíso',
    communes: [
      'Algarrobo', 'Cabildo', 'Calle Larga', 'Cartagena', 'Casablanca', 'Catemu', 'Concón', 'El Quisco',
      'El Tabo', 'Hijuelas', 'Isla de Pascua', 'Juan Fernández', 'La Calera', 'La Cruz', 'La Ligua',
      'Limache', 'Llaillay', 'Los Andes', 'Nogales', 'Olmué', 'Panquehue', 'Papudo', 'Petorca',
      'Puchuncaví', 'Putaendo', 'Quillota', 'Quilpué', 'Quintero', 'Rinconada', 'San Antonio',
      'San Esteban', 'San Felipe', 'Santa María', 'Santo Domingo', 'Valparaíso', 'Villa Alemana',
      'Viña del Mar', 'Zapallar',
    ],
  },
  {
    name: 'Región Metropolitana',
    communes: [
      'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví',
      'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo',
      'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes',
      'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa',
      'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia',
      'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo',
      'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante',
      'Tiltil', 'Vitacura',
    ],
  },
  {
    name: "O'Higgins",
    communes: [
      'Chépica', 'Chimbarongo', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Graneros', 'La Estrella',
      'Las Cabras', 'Litueche', 'Lolol', 'Machalí', 'Malloa', 'Marchihue', 'Mostazal', 'Nancagua',
      'Navidad', 'Olivar', 'Palmilla', 'Paredones', 'Peralillo', 'Peumo', 'Pichidegua', 'Pichilemu',
      'Placilla', 'Pumanque', 'Quinta de Tilcoco', 'Rancagua', 'Rengo', 'Requínoa', 'San Fernando',
      'San Vicente', 'Santa Cruz',
    ],
  },
  {
    name: 'Maule',
    communes: [
      'Cauquenes', 'Chanco', 'Colbún', 'Constitución', 'Curepto', 'Curicó', 'Empedrado', 'Hualañé',
      'Licantén', 'Linares', 'Longaví', 'Maule', 'Molina', 'Parral', 'Pelarco', 'Pelluhue', 'Pencahue',
      'Rauco', 'Retiro', 'Río Claro', 'Romeral', 'Sagrada Familia', 'San Clemente', 'San Javier',
      'San Rafael', 'Talca', 'Teno', 'Vichuquén', 'Villa Alegre', 'Yerbas Buenas',
    ],
  },
  {
    name: 'Ñuble',
    communes: [
      'Bulnes', 'Chillán', 'Chillán Viejo', 'Cobquecura', 'Coelemu', 'Coihueco', 'El Carmen', 'Ninhue',
      'Ñiquén', 'Pemuco', 'Pinto', 'Portezuelo', 'Quillón', 'Quirihue', 'Ránquil', 'San Carlos',
      'San Fabián', 'San Ignacio', 'San Nicolás', 'Treguaco', 'Yungay',
    ],
  },
  {
    name: 'Biobío',
    communes: [
      'Alto Biobío', 'Antuco', 'Arauco', 'Cabrero', 'Cañete', 'Chiguayante', 'Concepción', 'Contulmo',
      'Coronel', 'Curanilahue', 'Florida', 'Hualpén', 'Hualqui', 'Laja', 'Lebu', 'Los Álamos',
      'Los Ángeles', 'Lota', 'Mulchén', 'Nacimiento', 'Negrete', 'Penco', 'Quilaco', 'Quilleco',
      'San Pedro de la Paz', 'San Rosendo', 'Santa Bárbara', 'Santa Juana', 'Talcahuano', 'Tirúa', 'Tomé',
      'Tucapel', 'Yumbel',
    ],
  },
  {
    name: 'Araucanía',
    communes: [
      'Angol', 'Carahue', 'Cholchol', 'Collipulli', 'Cunco', 'Curacautín', 'Curarrehue', 'Ercilla',
      'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Lonquimay', 'Los Sauces', 'Lumaco',
      'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Purén',
      'Renaico', 'Saavedra', 'Temuco', 'Teodoro Schmidt', 'Toltén', 'Traiguén', 'Victoria', 'Vilcún',
      'Villarrica',
    ],
  },
  {
    name: 'Los Ríos',
    communes: [
      'Corral', 'Futrono', 'La Unión', 'Lago Ranco', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina',
      'Paillaco', 'Panguipulli', 'Río Bueno', 'Valdivia',
    ],
  },
  {
    name: 'Los Lagos',
    communes: [
      'Ancud', 'Calbuco', 'Castro', 'Chaitén', 'Chonchi', 'Cochamó', 'Curaco de Vélez', 'Dalcahue',
      'Fresia', 'Frutillar', 'Futaleufú', 'Hualaihué', 'Llanquihue', 'Los Muermos', 'Maullín', 'Osorno',
      'Palena', 'Puerto Montt', 'Puerto Octay', 'Puerto Varas', 'Puqueldón', 'Purranque', 'Puyehue',
      'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Río Negro', 'San Juan de la Costa', 'San Pablo',
    ],
  },
  {
    name: 'Aysén',
    communes: [
      'Aysén', 'Chile Chico', 'Cisnes', 'Cochrane', 'Coyhaique', 'Guaitecas', 'Lago Verde', "O'Higgins",
      'Río Ibáñez', 'Tortel',
    ],
  },
  {
    name: 'Magallanes',
    communes: [
      'Antártica', 'Cabo de Hornos', 'Laguna Blanca', 'Natales', 'Porvenir', 'Primavera', 'Punta Arenas',
      'Río Verde', 'San Gregorio', 'Timaukel', 'Torres del Paine',
    ],
  },
];

export const REGION_NAMES: readonly string[] = CHILE_REGIONS.map((r) => r.name);

// Siempre la misma lista vacía: el formulario la usa como dependencia de un efecto
const NO_COMMUNES: readonly string[] = [];

/** Comunas de una región, o lista vacía si la región no existe. */
export function communesOf(region: string | undefined | null): readonly string[] {
  return CHILE_REGIONS.find((r) => r.name === region)?.communes ?? NO_COMMUNES;
}

export function isValidRegion(region: string | undefined | null): boolean {
  return REGION_NAMES.includes(region ?? '');
}

/** La comuna existe y pertenece a esa región. */
export function isValidCommune(region: string | undefined | null, commune: string | undefined | null): boolean {
  return communesOf(region).includes(commune ?? '');
}

// Sin tildes, minúsculas y sin el prefijo "Región de/del": "Region de Valparaiso",
// "valparaíso" y "Valparaíso" se consideran el mismo nombre.
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^region\s+(de\s+la\s+|del\s+|de\s+)?/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombre oficial de la región escrita a mano en una dirección antigua
 * ("metropolitana" → "Región Metropolitana"), o null si no se reconoce.
 */
export function matchRegion(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  const n = normalize(value);
  return REGION_NAMES.find((name) => normalize(name) === n) ?? null;
}

/** Igual que matchRegion, para una comuna dentro de una región ya reconocida. */
export function matchCommune(region: string | null, value: string | undefined | null): string | null {
  if (!region || !value?.trim()) return null;
  const n = normalize(value);
  return communesOf(region).find((name) => normalize(name) === n) ?? null;
}

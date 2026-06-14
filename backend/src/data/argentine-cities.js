// Seed de ciudades argentinas para el autocomplete de localidad en el flow
// publico (PublicBuy). Asi el comprador ve sugerencias desde el primer
// dia, sin esperar a que otros las carguen.
//
// El endpoint getLocalidadesSuggestions las combina con las que matchearon
// de la tabla tickets — las dinamicas (mas usadas en el evento) saltan
// arriba, las del seed quedan como red de seguridad para casos donde
// ningun comprador todavia cargo esa ciudad.
//
// Cada item es { city, province } para que la UI muestre
// "Firmat, Santa Fe" — desambigua casos comunes como "Mercedes" (Buenos
// Aires vs Corrientes) o "San Juan" (provincia capital vs barrios).
//
// Cobertura:
//   - 24 capitales provinciales + CABA
//   - Principales ciudades de cada provincia
//   - Foco en Santa Fe + Buenos Aires (alta densidad de eventos)
//   - Total ~200 entradas

const cities = [
  // CABA + GBA
  ['Buenos Aires', 'CABA'], ['La Plata', 'Buenos Aires'], ['Mar del Plata', 'Buenos Aires'],
  ['Bahía Blanca', 'Buenos Aires'], ['Quilmes', 'Buenos Aires'], ['Lanús', 'Buenos Aires'],
  ['Avellaneda', 'Buenos Aires'], ['Lomas de Zamora', 'Buenos Aires'], ['Morón', 'Buenos Aires'],
  ['San Isidro', 'Buenos Aires'], ['Vicente López', 'Buenos Aires'], ['Tigre', 'Buenos Aires'],
  ['San Fernando', 'Buenos Aires'], ['Pilar', 'Buenos Aires'], ['Escobar', 'Buenos Aires'],
  ['San Justo', 'Buenos Aires'], ['Ramos Mejía', 'Buenos Aires'], ['Hurlingham', 'Buenos Aires'],
  ['Ituzaingó', 'Buenos Aires'], ['San Miguel', 'Buenos Aires'],
  ['Tres de Febrero', 'Buenos Aires'], ['Merlo', 'Buenos Aires'], ['Moreno', 'Buenos Aires'],
  ['José C. Paz', 'Buenos Aires'], ['Malvinas Argentinas', 'Buenos Aires'],
  ['Berazategui', 'Buenos Aires'], ['Florencio Varela', 'Buenos Aires'], ['Ezeiza', 'Buenos Aires'],
  ['Esteban Echeverría', 'Buenos Aires'], ['Almirante Brown', 'Buenos Aires'],
  ['Adrogué', 'Buenos Aires'], ['Banfield', 'Buenos Aires'], ['Temperley', 'Buenos Aires'],
  ['Burzaco', 'Buenos Aires'], ['Olivos', 'Buenos Aires'], ['Martínez', 'Buenos Aires'],
  ['Don Torcuato', 'Buenos Aires'], ['Bella Vista', 'Buenos Aires'], ['Boulogne', 'Buenos Aires'],
  ['Belgrano', 'CABA'], ['Palermo', 'CABA'], ['Caballito', 'CABA'], ['Recoleta', 'CABA'],
  ['Núñez', 'CABA'], ['Villa Urquiza', 'CABA'], ['Flores', 'CABA'], ['Almagro', 'CABA'],
  ['San Telmo', 'CABA'], ['Puerto Madero', 'CABA'], ['Villa Devoto', 'CABA'],

  // Buenos Aires interior
  ['Pinamar', 'Buenos Aires'], ['Villa Gesell', 'Buenos Aires'], ['Necochea', 'Buenos Aires'],
  ['Tandil', 'Buenos Aires'], ['Olavarría', 'Buenos Aires'], ['Azul', 'Buenos Aires'],
  ['Junín', 'Buenos Aires'], ['Pergamino', 'Buenos Aires'], ['San Pedro', 'Buenos Aires'],
  ['San Nicolás', 'Buenos Aires'], ['Zárate', 'Buenos Aires'], ['Campana', 'Buenos Aires'],
  ['9 de Julio', 'Buenos Aires'], ['Chivilcoy', 'Buenos Aires'], ['Mercedes', 'Buenos Aires'],
  ['Luján', 'Buenos Aires'], ['Chascomús', 'Buenos Aires'], ['Dolores', 'Buenos Aires'],
  ['Bragado', 'Buenos Aires'], ['Lincoln', 'Buenos Aires'], ['Trenque Lauquen', 'Buenos Aires'],
  ['Tres Arroyos', 'Buenos Aires'], ['Coronel Suárez', 'Buenos Aires'], ['Pehuajó', 'Buenos Aires'],
  ['Carlos Casares', 'Buenos Aires'], ['Las Flores', 'Buenos Aires'], ['Cañuelas', 'Buenos Aires'],

  // Santa Fe
  ['Santa Fe', 'Santa Fe'], ['Rosario', 'Santa Fe'], ['Rafaela', 'Santa Fe'],
  ['Esperanza', 'Santa Fe'], ['Reconquista', 'Santa Fe'], ['San Lorenzo', 'Santa Fe'],
  ['Funes', 'Santa Fe'], ['Roldán', 'Santa Fe'], ['Casilda', 'Santa Fe'],
  ['Cañada de Gómez', 'Santa Fe'], ['Firmat', 'Santa Fe'], ['Pérez', 'Santa Fe'],
  ['Granadero Baigorria', 'Santa Fe'], ['Venado Tuerto', 'Santa Fe'], ['Sunchales', 'Santa Fe'],
  ['Capitán Bermúdez', 'Santa Fe'], ['Villa Constitución', 'Santa Fe'],
  ['Arroyo Seco', 'Santa Fe'], ['Las Rosas', 'Santa Fe'], ['Carcarañá', 'Santa Fe'],
  ['Coronda', 'Santa Fe'], ['Santo Tomé', 'Santa Fe'],

  // Córdoba
  ['Córdoba', 'Córdoba'], ['Villa Carlos Paz', 'Córdoba'], ['Río Cuarto', 'Córdoba'],
  ['San Francisco', 'Córdoba'], ['Villa María', 'Córdoba'], ['Alta Gracia', 'Córdoba'],
  ['Jesús María', 'Córdoba'], ['La Falda', 'Córdoba'], ['La Cumbre', 'Córdoba'],
  ['Mina Clavero', 'Córdoba'], ['Cosquín', 'Córdoba'], ['Bell Ville', 'Córdoba'],
  ['Marcos Juárez', 'Córdoba'], ['Río Tercero', 'Córdoba'], ['Río Ceballos', 'Córdoba'],
  ['Villa Allende', 'Córdoba'], ['Villa General Belgrano', 'Córdoba'],
  ['Cruz del Eje', 'Córdoba'], ['Capilla del Monte', 'Córdoba'],

  // Mendoza
  ['Mendoza', 'Mendoza'], ['San Rafael', 'Mendoza'], ['Godoy Cruz', 'Mendoza'],
  ['Maipú', 'Mendoza'], ['Luján de Cuyo', 'Mendoza'], ['Las Heras', 'Mendoza'],
  ['Guaymallén', 'Mendoza'], ['General Alvear', 'Mendoza'], ['Tunuyán', 'Mendoza'],
  ['San Martín', 'Mendoza'], ['Tupungato', 'Mendoza'], ['Malargüe', 'Mendoza'],

  // Tucumán
  ['San Miguel de Tucumán', 'Tucumán'], ['Yerba Buena', 'Tucumán'], ['Tafí Viejo', 'Tucumán'],
  ['Tafí del Valle', 'Tucumán'], ['Concepción', 'Tucumán'], ['Banda del Río Salí', 'Tucumán'],

  // Salta
  ['Salta', 'Salta'], ['Tartagal', 'Salta'], ['San Ramón de la Nueva Orán', 'Salta'],
  ['Cafayate', 'Salta'], ['Metán', 'Salta'], ['Rosario de Lerma', 'Salta'],
  ['General Güemes', 'Salta'],

  // Jujuy
  ['San Salvador de Jujuy', 'Jujuy'], ['Tilcara', 'Jujuy'], ['Purmamarca', 'Jujuy'],
  ['Humahuaca', 'Jujuy'], ['Palpalá', 'Jujuy'], ['San Pedro', 'Jujuy'],
  ['Libertador General San Martín', 'Jujuy'],

  // Entre Ríos
  ['Paraná', 'Entre Ríos'], ['Concordia', 'Entre Ríos'], ['Gualeguaychú', 'Entre Ríos'],
  ['Concepción del Uruguay', 'Entre Ríos'], ['Villaguay', 'Entre Ríos'],
  ['Diamante', 'Entre Ríos'], ['Crespo', 'Entre Ríos'], ['Victoria', 'Entre Ríos'],
  ['Federación', 'Entre Ríos'], ['Colón', 'Entre Ríos'], ['Chajarí', 'Entre Ríos'],

  // Misiones
  ['Posadas', 'Misiones'], ['Puerto Iguazú', 'Misiones'], ['Oberá', 'Misiones'],
  ['Eldorado', 'Misiones'], ['Apóstoles', 'Misiones'],

  // Chaco
  ['Resistencia', 'Chaco'], ['Presidencia Roque Sáenz Peña', 'Chaco'],
  ['Villa Ángela', 'Chaco'], ['Charata', 'Chaco'], ['Quitilipi', 'Chaco'],

  // Corrientes
  ['Corrientes', 'Corrientes'], ['Goya', 'Corrientes'], ['Mercedes', 'Corrientes'],
  ['Curuzú Cuatiá', 'Corrientes'], ['Paso de los Libres', 'Corrientes'],
  ['Bella Vista', 'Corrientes'], ['Saladas', 'Corrientes'], ['Esquina', 'Corrientes'],

  // Formosa
  ['Formosa', 'Formosa'], ['Clorinda', 'Formosa'], ['Pirané', 'Formosa'],
  ['El Colorado', 'Formosa'],

  // Santiago del Estero
  ['Santiago del Estero', 'Santiago del Estero'], ['La Banda', 'Santiago del Estero'],
  ['Termas de Río Hondo', 'Santiago del Estero'], ['Frías', 'Santiago del Estero'],

  // Catamarca
  ['San Fernando del Valle de Catamarca', 'Catamarca'], ['Tinogasta', 'Catamarca'],
  ['Andalgalá', 'Catamarca'], ['Belén', 'Catamarca'], ['Recreo', 'Catamarca'],

  // La Rioja
  ['La Rioja', 'La Rioja'], ['Chilecito', 'La Rioja'], ['Aimogasta', 'La Rioja'],
  ['Chamical', 'La Rioja'],

  // San Juan
  ['San Juan', 'San Juan'], ['Rivadavia', 'San Juan'], ['Pocito', 'San Juan'],
  ['Rawson', 'San Juan'], ['Chimbas', 'San Juan'], ['Caucete', 'San Juan'],
  ['Jáchal', 'San Juan'],

  // San Luis
  ['San Luis', 'San Luis'], ['Villa Mercedes', 'San Luis'], ['Merlo', 'San Luis'],
  ['La Punta', 'San Luis'], ['Justo Daract', 'San Luis'],

  // La Pampa
  ['Santa Rosa', 'La Pampa'], ['General Pico', 'La Pampa'], ['Toay', 'La Pampa'],
  ['Realicó', 'La Pampa'],

  // Río Negro
  ['Viedma', 'Río Negro'], ['San Carlos de Bariloche', 'Río Negro'],
  ['General Roca', 'Río Negro'], ['Cipolletti', 'Río Negro'],
  ['Villa Regina', 'Río Negro'], ['Allen', 'Río Negro'], ['El Bolsón', 'Río Negro'],
  ['Cinco Saltos', 'Río Negro'], ['Choele Choel', 'Río Negro'],

  // Neuquén
  ['Neuquén', 'Neuquén'], ['San Martín de los Andes', 'Neuquén'],
  ['Villa La Angostura', 'Neuquén'], ['Junín de los Andes', 'Neuquén'],
  ['Plottier', 'Neuquén'], ['Centenario', 'Neuquén'], ['Cutral Có', 'Neuquén'],
  ['Zapala', 'Neuquén'], ['Chos Malal', 'Neuquén'],

  // Chubut
  ['Rawson', 'Chubut'], ['Comodoro Rivadavia', 'Chubut'], ['Puerto Madryn', 'Chubut'],
  ['Trelew', 'Chubut'], ['Esquel', 'Chubut'], ['Sarmiento', 'Chubut'],
  ['Gaiman', 'Chubut'], ['Dolavon', 'Chubut'],

  // Santa Cruz
  ['Río Gallegos', 'Santa Cruz'], ['El Calafate', 'Santa Cruz'],
  ['Caleta Olivia', 'Santa Cruz'], ['Pico Truncado', 'Santa Cruz'],
  ['Puerto Deseado', 'Santa Cruz'], ['Puerto San Julián', 'Santa Cruz'],
  ['El Chaltén', 'Santa Cruz'],

  // Tierra del Fuego
  ['Ushuaia', 'Tierra del Fuego'], ['Río Grande', 'Tierra del Fuego'],
  ['Tolhuin', 'Tierra del Fuego'],
];

module.exports = cities.map(([city, province]) => ({ city, province }));

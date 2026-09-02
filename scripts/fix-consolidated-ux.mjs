import fs from 'node:fs';

const path = 'app/(tabs)/index.tsx';
let source = fs.readFileSync(path, 'utf8');
const before = '  const mapLens: MapLens = "all";';
const after = '  const [mapLens] = useState<MapLens>("all");';
if (!source.includes(before)) throw new Error('Map lens anchor not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Map lens type narrowing fixed.');

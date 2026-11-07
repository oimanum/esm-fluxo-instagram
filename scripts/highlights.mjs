// Gera as capas dos Destaques e as telas de Story (a partir de brand/facts.json) em destaques/.
import { renderHighlights } from '../src/producer/highlights.js';
import { loadFacts } from '../src/facts.js';

const facts = await loadFacts();
const { covers, stories } = await renderHighlights(facts.data, 'destaques');
console.log(`${covers.length} capas e ${stories.length} telas de Story em destaques/`);
if (!stories.length) console.log('Sem telas de Story: preencha cases, process e about em brand/facts.json com fatos reais.');

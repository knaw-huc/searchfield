import SearchField, {type UpdateState, type Query} from '@knaw-huc/searchfield';
import places from './data/places.json' with {type: 'json'};
import polities from './data/polities.json' with {type: 'json'};
import placeIcon from './assets/place.svg?raw';
import polityIcon from './assets/polity.svg?raw';

function getSVGElement(svg: string) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
    return svgDoc.documentElement as unknown as SVGElement;
}

const types: Record<string, { color: string, icon: SVGElement }> = {
    'Place': {color: '#C5D89D', icon: getSVGElement(placeIcon)},
    'Polity': {color: '#BDE8F5', icon: getSVGElement(polityIcon)},
};

interface Entity {
    id: string;
    type: 'Place' | 'Polity';
    label: string;
    alternatives: string[];
}

const entities: Entity[] = [...places.map(place => ({
    id: place.id,
    type: place.type as 'Place',
    label: place._label,
    alternatives: place.alternative_labels
})), ...polities.map(polity => ({
    id: polity.id,
    type: polity.type as 'Polity',
    label: polity._label,
    alternatives: polity.alternative_labels
}))].sort((a, b) => a.label.localeCompare(b.label));

const input = document.getElementsByClassName('searchbox-input')[0];
const undoButton = document.getElementsByClassName('searchbox-undo-button')[0];
const redoButton = document.getElementsByClassName('searchbox-redo-button')[0];
const searchButton = document.getElementsByClassName('searchbox-search-button')[0];
const output = document.getElementsByClassName('output')[0];

function onSearch(query: Query) {
    console.log('Query', query);
    output.textContent = JSON.stringify(query, null, 2);
}

function onUpdate({canUndo, canRedo}: UpdateState) {
    console.log(`Update - canUndo: ${canUndo}, canRedo: ${canRedo}`);

    canUndo ? undoButton.removeAttribute('disabled') : undoButton.setAttribute('disabled', 'disabled');
    canRedo ? redoButton.removeAttribute('disabled') : redoButton.setAttribute('disabled', 'disabled');
}

const searchField = new SearchField<Entity>(input, {
    enableHistory: true,
    enableLuceneQuerySyntax: true,
    onSearch,
    onUpdate,
    autocomplete: {
        source: async (query: string) => {
            query = query.toLowerCase();
            return entities.filter(entity => {
                const labelMatch = entity.label.toLowerCase().indexOf(query) > -1;
                const altMatch = entity.alternatives.find(alt => alt.toLowerCase().indexOf(query) > -1);

                return labelMatch || altMatch;
            });
        },
        type: 'type',
        id: 'id',
        label: 'label',
        description: entity => entity.alternatives.join(', '),
        icon: entity => types[entity.type]?.icon,
        token: {
            color: entityToken => types[entityToken.type]?.color,
            icon: entityToken => types[entityToken.type]?.icon,
        }
    },
});

undoButton.addEventListener('click', () => searchField.undo());
redoButton.addEventListener('click', () => searchField.redo());
searchButton.addEventListener('click', () => searchField.search());

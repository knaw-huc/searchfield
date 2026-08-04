import {
    Decoration,
    EditorView,
    MatchDecorator,
    ViewPlugin,
    ViewUpdate,
    WidgetType
} from '@codemirror/view';

import type {DecorationSet} from '@codemirror/view';
import type {AutocompleteConfig} from './SearchFieldConfig';

export default function createEntitiesPlugin<E extends object>(config: AutocompleteConfig<E>) {
    class EntityWidget<E extends object> extends WidgetType {
        private readonly entity: E;
        private readonly config: AutocompleteConfig<E>;

        constructor(entity: E, config: AutocompleteConfig<E>) {
            super();
            this.entity = entity;
            this.config = config;
        }

        eq(other: WidgetType) {
            return other instanceof EntityWidget && (
                typeof this.config.id === 'function'
                    ? this.config.id(this.entity) === this.config.id(this.entity)
                    : this.entity[this.config.id] === other.entity[this.config.id]
            );
        }

        toDOM(view: EditorView) {
            const el = document.createElement('span');
            el.classList = 'cm-entity';

            if (this.config.color) {
                typeof this.config.color === 'function'
                    ? el.style.setProperty('--cm-entity-color', this.config.color(this.entity))
                    : el.style.setProperty('--cm-entity-color', this.entity[this.config.color] as string);
            }

            if (this.config.icon) {
                const icon = this.config.icon(this.entity).cloneNode(true) as SVGElement;
                icon.classList = 'cm-entity-icon';
                el.append(icon);
            }

            const cross = document.createElement('span');
            cross.textContent = '✕';
            cross.classList = 'cm-entity-cross';
            cross.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();

                const pos = view.posAtDOM(el);
                if (pos != null) {
                    view.plugin(entitiesPlugin)?.entities.between(pos, pos, (from, to) =>
                        view.dispatch({changes: {from, to, insert: ''}}));
                }
            });

            const label = typeof this.config.label === 'function'
                ? this.config.label(this.entity)
                : this.entity[this.config.label] as string;
            el.append(document.createTextNode(label), cross);

            return el;
        }
    }

    const entityMatcher = new MatchDecorator({
        regexp: config.entityRegex,
        decoration: match => Decoration.replace({
            widget: new EntityWidget(JSON.parse(match[1]), config)
        }),
    });

    const entitiesPlugin = ViewPlugin.fromClass(class {
        entities: DecorationSet;

        constructor(view: EditorView) {
            this.entities = entityMatcher.createDeco(view);
        }

        update(update: ViewUpdate) {
            this.entities = entityMatcher.updateDeco(update, this.entities);
        }
    }, {
        decorations: instance => instance.entities,
        provide: plugin => EditorView.atomicRanges.of(view =>
            view.plugin(plugin)?.entities || Decoration.none),
    });

    return entitiesPlugin;
}

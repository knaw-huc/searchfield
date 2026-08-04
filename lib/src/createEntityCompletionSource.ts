import {CompletionContext, type CompletionResult} from '@codemirror/autocomplete';
import type {AutocompleteConfig} from './SearchFieldConfig.ts';

export default function createEntityCompletionSource<E extends object = object>(config: AutocompleteConfig<E>) {
    return async (context: CompletionContext): Promise<CompletionResult | null> => {
        try {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit))
                return null;

            if (config.debounceMs && config.debounceMs > 0) {
                await wait(config.debounceMs, context);
                if (context.aborted)
                    return null;
            }

            const search = word.text.toString();
            const entities = await config.source(search);

            if (context.aborted)
                return null;

            return {
                filter: false,
                from: word.from,
                options: entities.map(entity => ({
                    type: 'property',
                    label: typeof config.label === 'function' ? config.label(entity) : entity[config.label] as string,
                    detail: typeof config.description === 'function' ? config.description(entity) : entity[config.description] as string,
                    apply: JSON.stringify(entity),
                    entity,
                })),
            };
        } catch {
            return null;
        }
    };
}

function wait(ms: number, context: CompletionContext): Promise<void> {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            if (!context.aborted)
                resolve();
        }, ms);
        void timer;
    });
}

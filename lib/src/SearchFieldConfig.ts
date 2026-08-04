import type {StyleSpec} from 'style-mod';

export default interface SearchFieldConfig<E extends object> {
    query: string;
    enableHistory: boolean;
    enableLuceneQuerySyntax: boolean;
    onSearch?: (query: string) => void;
    onUpdate?: (state: UpdateState) => void;
    theme?: {
        light?: ThemeConfig;
        dark?: ThemeConfig;
    };
    autocomplete?: AutocompleteConfig<E>;
}

export interface UpdateState {
    canUndo: boolean;
    canRedo: boolean;
}

export interface ThemeConfig {
    fontFamily?: string;
    fontFamilyAutocomplete?: string;
    entity?: StyleSpec;
    icon?: StyleSpec;
    cross?: StyleSpec;
    highlight?: HighlightConfig;
}

export interface HighlightConfig {
    string?: string;
    operatorKeyword?: string;
    number?: string;
    modifier?: string;
    regexp?: string;
    escape?: string;
    paren?: string;
}

export interface AutocompleteConfig<E extends object> {
    source: (query: string) => Promise<E[]>;
    debounceMs?: number;
    entityRegex: RegExp;
    id: keyof E | ((entity: E) => string);
    label: keyof E | ((entity: E) => string);
    description: keyof E | ((entity: E) => string);
    color?: keyof E | ((entity: E) => string);
    icon?: (entity: E) => SVGElement;
}

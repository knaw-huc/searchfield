export interface SourceSpan {
    from: number;
    to: number;
}

export interface ASTBase {
    span: SourceSpan;
    raw?: string;
    boost?: number;
}

export type TreeQuery =
    | BooleanQuery
    | NotQuery
    | TermQuery
    | PhraseQuery
    | RegexQuery
    | PrefixWildcardQuery
    | FuzzyQuery
    | EntityQuery;

export interface BooleanQuery extends ASTBase {
    type: 'and' | 'or';
    clauses: TreeQuery[];
}

export interface NotQuery extends ASTBase {
    type: 'not';
    clause: TreeQuery;
}

export interface TermQuery extends ASTBase {
    type: 'term';
    value: string;
}

export interface PhraseQuery extends ASTBase {
    type: 'phrase';
    value: string;
    proximity?: number;
}

export interface RegexQuery extends ASTBase {
    type: 'regex';
    value: string;
}

export interface PrefixWildcardQuery extends ASTBase {
    type: 'prefix-wildcard';
    value: string;
}

export interface FuzzyQuery extends ASTBase {
    type: 'fuzzy';
    value: string;
    distance?: number;
}

export interface EntityQuery extends ASTBase {
    type: 'entity';
    entityType: string;
    id: string;
    label: string;
}

import {entityTokenExactRegex} from '../../entityToken';
import type {SyntaxNode, Tree} from '@lezer/common';
import type {
    Query,
    BooleanQuery,
    NotQuery,
    TermQuery,
    PhraseQuery,
    RegexQuery,
    WildcardQuery,
    FuzzyQuery,
    ASTBase, EntityQuery,
} from './types';

const unescape = (value: string) => value.replace(/\\([\s\S])/g, '$1');

export function parseQuery(source: string, tree: Tree, defaultOperator: 'and' | 'or'): Query | null {
    const expressions = childrenNamed(tree.topNode, 'Expression')
        .map(node => expression(node, source, defaultOperator))
        .filter((x): x is Query => x !== null);

    return expressions.length > 0
        ? (expressions.length === 1 ? expressions[0] : group(expressions, source, defaultOperator))
        : null;
}

function expression(node: SyntaxNode, source: string, defaultOperator: 'and' | 'or'): Query | null {
    const children = namedChildren(node);

    const operator = children.find(child => ['And', 'Or', 'Not'].includes(child.name));
    if (!operator) {
        const clause = children.find(child => child.name === 'Clause');
        return clause ? clauseNode(clause, source, defaultOperator) : null;
    }

    if (operator.name === 'Not') {
        const operand = children.find(child => child.name === 'Expression');
        if (!operand)
            return null;

        const clause = expression(operand, source, defaultOperator);
        if (!clause)
            return null;

        return withBase({type: 'not', clause} satisfies Omit<NotQuery, keyof ASTBase>, node, source);
    }

    const operands = children.filter(child => child.name === 'Expression');
    if (operands.length !== 2)
        return null;

    const left = expression(operands[0], source, defaultOperator);
    const right = expression(operands[1], source, defaultOperator);
    if (!left || !right)
        return null;

    const type = operator.name === 'And' ? 'and' : 'or';
    return withBase({type, clauses: [left, right],} satisfies Omit<BooleanQuery, keyof ASTBase>, node, source);
}

function clauseNode(node: SyntaxNode, source: string, defaultOperator: 'and' | 'or'): Query | null {
    const primitive = childNamed(node, 'Primitive');
    if (!primitive)
        return null;

    const query = primitiveNode(primitive, source, defaultOperator);
    if (!query)
        return null;

    const boostNode = childNamed(node, 'Boost');
    if (!boostNode)
        return query;

    const boostText = source.slice(boostNode.from, boostNode.to);
    const boost = Number(boostText.slice(1));
    if (!Number.isFinite(boost))
        return query;

    return {
        ...query,
        boost,
        span: {
            from: query.span.from,
            to: node.to,
        },
        raw: source.slice(query.span.from, node.to),
    };
}

function primitiveNode(node: SyntaxNode, source: string, defaultOperator: 'and' | 'or'): Query | null {
    const child = namedChildren(node)[0];
    if (!child)
        return null;

    switch (child.name) {
        case 'TermClause':
            return termClause(child, source);
        case 'PhraseClause':
            return phraseClause(child, source);
        case 'Regex':
            return regexClause(child, source);
        case 'Group':
            return groupClause(child, source, defaultOperator);
        case 'EntityToken':
            return entityNode(child, source)
        default:
            return null;
    }
}

function termClause(node: SyntaxNode, source: string): Query | null {
    const child = namedChildren(node)[0];
    if (!child)
        return null;

    if (child.name === 'FuzzyTerm')
        return fuzzyTerm(child, source);

    if (child.name === 'PrefixWildcardTerm')
        return wildcardTerm(child, source);

    return null;
}

function fuzzyTerm(node: SyntaxNode, source: string): FuzzyQuery | TermQuery | null {
    const term = childNamed(node, 'Term');
    if (!term)
        return null;

    const value = unescape(source.slice(term.from, term.to));
    const fuzzy = childNamed(node, 'Fuzzy');
    if (!fuzzy)
        return withBase({type: 'term', value} satisfies Omit<TermQuery, keyof ASTBase>, node, source);

    const integer = childNamed(fuzzy, 'Integer');
    const distance = integer
        ? Number(source.slice(integer.from, integer.to))
        : undefined;

    return withBase({
        type: 'fuzzy',
        value, ...(distance !== undefined ? {distance} : {}),
    } satisfies Omit<FuzzyQuery, keyof ASTBase>, node, source);
}

function wildcardTerm(node: SyntaxNode, source: string): WildcardQuery | null {
    const term = childNamed(node, 'Term');
    if (!term)
        return null

    const value = unescape(source.slice(term.from, term.to));
    return withBase({type: 'wildcard', value} satisfies Omit<WildcardQuery, keyof ASTBase>, node, source);
}

function phraseClause(node: SyntaxNode, source: string): PhraseQuery | null {
    const phrase = childNamed(node, 'Phrase');
    if (!phrase)
        return null;

    const raw = source.slice(phrase.from, phrase.to);
    const value = unescape(raw.slice(1, -1));
    const proximity = childNamed(node, 'Proximity');

    let distance: number | undefined
    if (proximity) {
        const integer = childNamed(proximity, 'Integer');
        if (integer)
            distance = Number(source.slice(integer.from, integer.to));
    }

    return withBase({
        type: 'phrase', value, ...(distance !== undefined ? {proximity: distance} : {}),
    } satisfies Omit<PhraseQuery, keyof ASTBase>, node, source);
}

function regexClause(node: SyntaxNode, source: string): RegexQuery | null {
    const raw = source.slice(node.from, node.to);
    if (raw.length < 2)
        return null;

    const value = unescape(raw.slice(1, -1));
    return withBase({type: 'regex', value} satisfies Omit<RegexQuery, keyof ASTBase>, node, source);
}

function groupClause(node: SyntaxNode, source: string, defaultOperator: 'and' | 'or'): Query | null {
    const expressions = childrenNamed(node, 'Expression')
        .map(child => expression(child, source, defaultOperator))
        .filter((x): x is Query => x !== null);

    if (expressions.length === 0)
        return null;

    return expressions.length === 1 ? expressions[0] : group(expressions, source, defaultOperator);
}

function entityNode(node: SyntaxNode, source: string): EntityQuery | null {
    const raw = source.slice(node.from, node.to);
    const match = entityTokenExactRegex.exec(raw);
    if (!match)
        return null;

    return withBase({
        type: 'entity',
        entityType: decodeURIComponent(match[1]),
        id: decodeURIComponent(match[2]),
        label: decodeURIComponent(match[3]),
    } satisfies Omit<EntityQuery, keyof ASTBase>, node, source);
}

function group(clauses: Query[], source: string, defaultOperator: 'and' | 'or'): BooleanQuery {
    return {
        type: defaultOperator,
        clauses: flattenBoolean(defaultOperator, clauses),
        span: {
            from: clauses[0].span.from,
            to: clauses[clauses.length - 1].span.to,
        },
        raw: source.slice(
            clauses[0].span.from,
            clauses[clauses.length - 1].span.to,
        ),
    };
}

function flattenBoolean(type: 'and' | 'or', clauses: Query[]): Query[] {
    const result: Query[] = []
    for (const clause of clauses) {
        if (clause.type === type && clause.boost === undefined)
            result.push(...clause.clauses);
        else
            result.push(clause);
    }

    return result;
}

function withBase<T extends object>(value: T, node: SyntaxNode, source: string): T & ASTBase {
    return {
        ...value,
        span: {
            from: node.from,
            to: node.to,
        },
        raw: source.slice(node.from, node.to),
    };
}

function namedChildren(node: SyntaxNode): SyntaxNode[] {
    const result: SyntaxNode[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling) {
        if (!child.type.isAnonymous)
            result.push(child);
    }

    return result;
}

function childrenNamed(node: SyntaxNode, name: string): SyntaxNode[] {
    return namedChildren(node).filter(child => child.name === name);
}

function childNamed(node: SyntaxNode, name: string): SyntaxNode | null {
    return namedChildren(node).find(child => child.name === name) ?? null;
}

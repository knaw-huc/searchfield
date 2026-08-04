import {LanguageSupport, LRLanguage} from '@codemirror/language';
import {styleTags, tags as t} from '@lezer/highlight';
import {parser} from './parser';

const luceneParser = parser.configure({
    props: [
        styleTags({
            Term: t.string,
            Phrase: t.string,

            And: t.operatorKeyword,
            Or: t.operatorKeyword,
            Not: t.operatorKeyword,

            Integer: t.number,
            Float: t.number,

            'Proximity/"~"': t.modifier,
            'Fuzzy/"~"': t.modifier,
            'Boost/"^"': t.modifier,
            'PrefixWildcardTerm/"*"': t.modifier,

            Regex: t.regexp,
            Escape: t.escape,
            '( )': t.paren,
        }),
    ]
});

const luceneLanguage = LRLanguage.define({
    parser: luceneParser,
    languageData: {
        name: 'lucene'
    }
});

export default function LuceneLanguageSupport() {
    return new LanguageSupport(luceneLanguage);
}

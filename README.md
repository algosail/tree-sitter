# @algosail/tree-sitter

Tree-sitter grammar for the Sail language.

## Build

```bash
npm run generate    # Generate parser from grammar.js
npm run build:wasm  # Build WASM (for web/Node)
npm run build:native # Build native bindings (node-gyp)
```

## Usage

```javascript
import Parser from 'web-tree-sitter'
import Sail from '@algosail/tree-sitter'

const parser = new Parser()
const lang = await Sail()
parser.setLanguage(lang)
const tree = parser.parse('@main ( -- ) DUP DROP')
```

## Grammar Overview

- **Top-level**: comment, import, group, word
- **Imports**: `+Module path` or `+Module +pkg`
- **Groups/tags**: `&Maybe a |Just a |Nothing` (sum), **product**: `&Point :x Num :y Num`
- **Words**: `@name ( sig ) body`
- **Signature**: `( inputs -> outputs )` (RFC-0.1 §12.2)

## RFC-lex-0.1 strategy

Phrase structure is parsed here; **token-level** behaviour (full ECMA-262 `InputElementRegExp` / `InputElementDiv`, all numeric forms, template literals) is **not** guaranteed to match [RFC-lex-0.1](../RFC-lex-0.1.md) exactly. Two coherent directions: (1) add a **dedicated lexer** that implements RFC-lex and feed tokens into a slimmer tree-sitter layer, or (2) keep tree-sitter as the primary surface and **document** intentional lexical subsets and divergences next to grammar tests. Grammar notes live in `grammar.js` (RFC-0.1 §12.2 / RFC-lex pointers). Sync edits with `zed/grammars/sail/grammar.js` when the Sail grammar changes.
- **Expressions**: quotation `( )`, list_literal `[ ]`, builtin_word, word_ref, tag_ref, raw_value, slot_write/read

## Files

| File | Role |
|------|------|
| `grammar.js` | Grammar definition |
| `queries/highlights.scm` | Syntax highlighting |
| `src/` | Generated C (after `generate`) |
| `tree-sitter-sail.wasm` | WASM parser (after `build:wasm`) |

## Dependencies

None. Grammar uses regex `/[A-Z][A-Z0-9_]*/` for builtin words — typecheck rejects unknown ones.

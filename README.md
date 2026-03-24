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
- **Groups/tags**: `&Maybe a #Just a #Nothing`
- **Words**: `@name ( sig ) body`
- **Signature**: `( inputs -- outputs )`
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

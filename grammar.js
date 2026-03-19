/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'sail',

  extras: ($) => [/\s+/],

  conflicts: ($) => [
    // '(' can start a comment OR a signature — tree-sitter resolves by
    // looking for '--' inside.
    [$.comment, $.signature],
    [$.comment, $.sig_quotation],
    // After word_def's signature, '(' is ambiguous: body comment vs next
    // top-level item. Declare as GLR self-conflict so both are explored.
    [$.word_def],
    // tag_group contains tag_def children; both can follow an uppercase name
    [$.tag_def, $.tag_group],
    // module_alias and type_name are both /[A-Z][a-zA-Z0-9_]*/
    // [$.type_name, $.module_alias],
    // type_variable and identifier are both lowercase words
    [$.type_variable, $.identifier],
  ],

  rules: {
    source_file: ($) => repeat($._top_level),

    _top_level: ($) =>
      choice($.comment, $.module_def, $.import_decl, $.tag_group, $.map_def, $.word_def),

    // Comment / doc block:  ( any text )
    // Intentionally simple — no nested-paren support inside comment text.
    comment: ($) => seq('(', optional($.comment_content), ')'),
    comment_content: ($) => /[^()]+/,

    // Module definition:  !ModuleName
    module_def: ($) => field('name', $.module_name),
    module_name: ($) => /![A-Z][a-zA-Z0-9_]*/,

    // Import:  |path/or/npm:pkg  Alias
    import_decl: ($) => seq(field('path', $.import_path), field('alias', $.module_alias)),

    import_path: ($) => /\|[^\s]+/,

    module_alias: ($) => /~[A-Z][a-zA-Z0-9_]*/,

    // Tag group:  &Name typeParam*  (>TagCase typeParam*)*
    tag_group: ($) =>
      seq(field('name', $.tag_group_name), repeat($.type_variable), repeat($.tag_def)),

    tag_group_name: ($) => /&[A-Z][a-zA-Z0-9_]*/,

    tag_def: ($) => seq(field('name', $.tag_name), repeat($.type_variable)),

    tag_name: ($) => />[A-Z][a-zA-Z0-9_]*/,

    // Map definition:  %Name  (:field Type)*
    map_def: ($) => seq(field('name', $.map_name), repeat($.map_field)),

    map_name: ($) => /%[A-Z][a-zA-Z0-9_]*/,

    map_field: ($) => seq(field('key', $.map_field_name), field('type', $.type_name)),

    map_field_name: ($) => /:[a-z][a-zA-Z0-9_]*/,

    // Word definition:  @name ( sig ) expr*
    // Signature is required per the spec ("Word definition must have a signature").
    // prec.right makes the body's repeat greedy: prefer consuming '(' as a body
    // comment rather than ending the word_def early.
    word_def: ($) =>
      prec.right(seq(field('name', $.word_name), field('sig', $.signature), repeat($._expr))),

    word_name: ($) => /@[a-z][a-zA-Z0-9_]*/,

    // Signature:  ( inputs -- outputs +effects )
    // The required '--' token is what makes it unambiguous vs a comment.
    signature: ($) => seq('(', repeat($._sig_item), $.sig_arrow, repeat($._sig_item), ')'),

    sig_arrow: ($) => token('--'),

    _sig_item: ($) =>
      choice(
        $.effect_add,
        $.effect_remove,
        $.spread,
        $.type_name,
        $.type_variable,
        $.sig_list,
        $.sig_quotation,
      ),

    // [ Type Type ... ] — list / tuple type in a signature
    sig_list: ($) => seq('[', repeat($._sig_item), ']'),

    // ( a b -- c d ) — higher-order function type nested inside a signature
    sig_quotation: ($) => seq('(', repeat($._sig_item), $.sig_arrow, repeat($._sig_item), ')'),

    // +IO, +FAIL, etc.
    effect_add: ($) => /\+[A-Z][a-zA-Z0-9_]*/,

    // -IO, -FAIL, etc.  (uppercase after dash avoids matching negative numbers)
    effect_remove: ($) => /-[A-Z][a-zA-Z0-9_]*/,

    // ..a, ..row — spread / row-variable in a signature
    spread: ($) => /\.\.[a-zA-Z][a-zA-Z0-9_]*/,

    // Uppercase type: Int, Str, Maybe, List, etc.
    type_name: ($) => /[A-Z][a-zA-Z0-9_]*/,

    // Lowercase type variable: a, b, elem, etc.
    type_variable: ($) => /[a-z][a-zA-Z0-9_]*/,

    // Expressions inside word bodies
    _expr: ($) =>
      choice(
        $.comment, // doc / inline comment block
        $.quotation,
        $.builtin_word,
        $.word_call,
        $.module_call,
        $.map_access,
        $.tag_constructor,
        $.tag_pattern,
        $.slot_push,
        $.slot_pop,
        $.raw_string,
        $.number,
        $.identifier,
      ),

    // [ expr* ] — quotation (anonymous code block or list literal)
    quotation: ($) => seq('[', repeat($._expr), ']'),

    // All-caps stack-manipulation and control-flow builtins.
    // Listed as a single token() so they take priority over $.identifier.
    builtin_word: ($) =>
      token(
        choice(
          'DUP',
          'SWAP',
          'DROP',
          'OVER',
          'ROT',
          'ROTR',
          'NIP',
          'TUCK',
          'DUP2',
          'DROP2',
          'SWAP2',
          'CALL',
          'MATCH',
          'COMPOSE',
          'IF',
          'MAP',
          'GETL',
          'SETL',
          'UPDL',
          'APP',
          'ERROR',
        ),
      ),

    // /wordName — call a locally defined word
    word_call: ($) => /\/[a-z][a-zA-Z0-9_]*/,

    // ~Module/word  or  ~Module — module-qualified word call
    module_call: ($) => /~[A-Z][a-zA-Z0-9_]*(\/[a-zA-Z][a-zA-Z0-9_]*)?/,

    // *Map/field — map field accessor / lens
    map_access: ($) => /\*[A-Z][a-zA-Z0-9_]*\/[a-z][a-zA-Z0-9_]*/,

    // #TagName — construct a tagged union value
    tag_constructor: ($) => /#[A-Z][a-zA-Z0-9_]*/,

    // _TagName — match/destructure a tag in MATCH
    tag_pattern: ($) => /_[A-Z][a-zA-Z0-9_]*/,

    // .name — pop the top of the stack into a named local slot
    slot_push: ($) => /\.[a-z][a-zA-Z0-9_]*/,

    // ,name — push a named local slot back onto the stack
    slot_pop: ($) => /,[a-z][a-zA-Z0-9_]*/,

    // 'raw string literal'
    raw_string: ($) => /\'[^\']*\'/,

    // Numeric literal: integer or decimal
    number: ($) => /[0-9]+(\.[0-9]+)?/,

    // Generic bare identifier (raw data tokens, unrecognised lowercase words)
    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,
  },
})

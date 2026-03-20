/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'sail',

  extras: ($) => [/\s+/],

  conflicts: ($) => [
    // GLR self-conflicts: after the rule's main tokens, '(' is ambiguous —
    // it could be the doc comment for THIS node or the start of the NEXT
    // top-level construct. Cannot be resolved by LALR(1).
    [$.group],
    [$.tag],
    [$.map],
    [$.field],

    // After word_def + sig + optional(doc), a comment is ambiguous:
    // it could be the doc field OR an _expr in the body.
    [$.word, $._expr],
  ],

  rules: {
    source_file: ($) => repeat($._top_level),
    _top_level: ($) => choice($.comment, $.import, $.group, $.map, $.word),

    // ~Module
    module_def: ($) => /\+[A-Z][a-zA-Z0-9_]*/,
    // ~Module
    module_ref: ($) => /~[A-Z][a-zA-Z0-9_]*/,
    // &Group
    group_def: ($) => /&[A-Z][a-zA-Z0-9_]*/,
    // &Group
    group_ref: ($) => /&[A-Z][a-zA-Z0-9_]*/,
    // #Tag
    tag_def: ($) => /#[A-Z][a-zA-Z0-9_]*/,
    // #Tag
    tag_ref: ($) => /#[A-Z][a-zA-Z0-9_]*/,
    // _Tag
    tag_pattern: ($) => /\_[A-Z][a-zA-Z0-9_]*/,
    // _
    default_pattern: ($) => token('_'),
    // $Map
    map_def: ($) => /\$[A-Z][a-zA-Z0-9_]*/,
    // $Map
    map_ref: ($) => /\$[A-Z][a-zA-Z0-9_]*/,
    // .field
    field_def: ($) => /\.[a-z][a-zA-Z0-9_]*/,
    // $Map.field
    field_ref: ($) => /\$[A-Z][a-zA-Z0-9_]*\.[a-z][a-zA-Z0-9_]*/,
    // @word
    word_def: ($) => /@[a-z][a-zA-Z0-9_]*/,
    // /word
    word_ref: ($) => /\/[a-z][a-zA-Z0-9_]*/,

    // ~Module&Group
    module_group_ref: ($) => /~[A-Z][a-zA-Z0-9_]*&[A-Z][a-zA-Z0-9_]*/,
    // ~Module#Tag
    module_tag_ref: ($) => /~[A-Z][a-zA-Z0-9_]*#[A-Z][a-zA-Z0-9_]*/,
    // ~Module#Tag
    module_tag_pattern: ($) => /~[A-Z][a-zA-Z0-9_]*\_[A-Z][a-zA-Z0-9_]*/,
    // ~Module$Map
    module_map_ref: ($) => /~[A-Z][a-zA-Z0-9_]*\$[A-Z][a-zA-Z0-9_]*/,
    // ~Module$Map.field
    module_field_ref: ($) => /~[A-Z][a-zA-Z0-9_]*\$[A-Z][a-zA-Z0-9_]*\.[a-z][a-zA-Z0-9_]*/,
    // ~Module/word
    module_word_ref: ($) => /~[A-Z][a-zA-Z0-9_]*\/[a-z][a-zA-Z0-9_]*/,

    // Uppercase type: Int, Str, Maybe, List, etc.
    type: ($) => /[A-Z][a-zA-Z0-9_]*/,
    // Lowercase type variable: a, b, elem, etc.
    type_var: ($) => /[a-z][a-zA-Z0-9_]*/,
    // Lowercase type variable: a, b, elem, etc.
    spread: ($) => /\.\.[a-z][a-zA-Z0-9_]*/,

    // +Effect
    effect_add: ($) => /\+[A-Z][a-zA-Z0-9_]*/,
    // -Effect
    effect_remove: ($) => /\-[A-Z][a-zA-Z0-9_]*/,

    // :name
    slot_write: ($) => /:[a-z][a-zA-Z0-9_]*/,

    // ;name
    slot_read: ($) => /;[a-z][a-zA-Z0-9_]*/,

    // 'raw string literal'
    raw_string: ($) => /\'[^\']*\'/,

    // Catch-all: any non-whitespace sequence that doesn't match a more specific
    // rule. prec(-1) gives it the lowest priority so every other token wins
    // when there is a tie. Structural characters ( ) [ ] are excluded because
    // they are needed by the parser to delimit blocks and comments.
    raw_value: ($) => token(prec(-1, /[^\s\[\]()']+/)),

    // Comment / doc block:  ( any text )
    // comment_content is recursive: it can contain plain text and/or nested
    // parenthesised groups, so  ( use f(x) here )  parses correctly.
    comment: ($) => seq('(', optional($.comment_content), ')'),
    comment_content: ($) => repeat1(choice(/[^()]+/, $.comment)),

    // Import:  +Alias path/or/+pkg
    import: ($) => seq(field('module', $.module_def), field('path', $.path)),
    path: ($) => /[^\s]+/,
    // seq('+', field('url', alias(/[^\s]+/, $.url))),

    // Tag group:  &Name typeParam*  (#TagCase typeParam*)*
    group: ($) =>
      seq(
        field('def', $.group_def),
        repeat($.type_var),
        optional(field('doc', $.comment)),
        repeat($.tag),
      ),
    tag: ($) =>
      seq(
        field('def', $.tag_def),
        optional(field('type_param', $.type_var)),
        optional(field('doc', $.comment)),
      ),
    group_type: ($) =>
      seq(field('group', choice($.group_ref, $.module_group_ref)), optional($._generic)),
    _generic: ($) => seq('{', field('params', repeat($._generic_content)), '}'),
    _generic_content: ($) => choice($.type, $.group_type, $.map_ref, $.module_map_ref),

    // Map definition:  %Name  (.field Type)*
    map: ($) => seq(field('def', $.map_def), optional(field('doc', $.comment)), repeat($.field)),
    field: ($) =>
      seq(
        field('key', $.field_def),
        field('type', $._field_types),
        optional(field('doc', $.comment)),
      ),
    _field_types: ($) => choice($.type, $.group_type, $.map_ref, $.module_map_ref),

    // Word definition:  @name ( sig ) expr*
    // Signature is required per the spec ("Word definition must have a signature").
    // prec.right makes the body's repeat greedy: prefer consuming '(' as a body
    // comment rather than ending the word_def early.
    word: ($) =>
      prec.right(
        seq(
          field('name_def', $.word_def),
          field('sig', $.signature),
          optional(field('doc', $.comment)),
          field('body', repeat($._expr)),
        ),
      ),

    // Signature:  ( inputs -- outputs +effects )
    // The required '--' token is what makes it unambiguous vs a comment.
    signature: ($) => seq('(', repeat($._sig_item), $.sig_arrow, repeat($._sig_item), ')'),
    sig_arrow: ($) => token('--'),
    _sig_item: ($) =>
      choice(
        $.effect_add,
        $.effect_remove,
        $.spread,
        $.type,
        $.type_var,
        $.sig_list,
        $.sig_quotation,
        $.group_type,
        $.map_ref,
        $.module_map_ref,
      ),

    // [ Type Type ... ] — list / tuple type in a signature
    sig_list: ($) => seq('[', repeat($._sig_item), ']'),

    // ( a b -- c d ) — higher-order function type nested inside a signature
    sig_quotation: ($) => seq('(', repeat($._sig_item), $.sig_arrow, repeat($._sig_item), ')'),

    // Expressions inside word bodies
    _expr: ($) =>
      choice(
        $.comment, // doc / inline comment block
        $.quotation,
        $.builtin_word,
        $.word_ref,
        $.module_word_ref,
        $.tag_ref,
        $.module_tag_ref,
        $.tag_pattern,
        $.module_tag_pattern,
        $.default_pattern,
        $.field_ref,
        $.module_field_ref,
        $.slot_write,
        $.slot_read,
        $.raw_string,
        $.raw_value,
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
  },
})

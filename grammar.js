/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const UPPERNAME = /[A-Z][a-zA-Z0-9_]*/
const LOWERNAME = /[a-z][a-zA-Z0-9_]*/

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
    // After tag_group_name + type_variables, '(' is ambiguous: doc comment
    // for this tag_group vs a top-level comment that follows it.
    [$.tag_group],
    [$.tag_def],
    [$.map_def],
    [$.map_field],
    // tag_group contains tag_def children; both can follow an uppercase name
    [$.tag_def, $.tag_group],
    // module_alias and type_name are both /[A-Z][a-zA-Z0-9_]*/
    // [$.type_name, $.module_alias],
    // type_variable and identifier are both lowercase words
  ],

  rules: {
    source_file: ($) => repeat($._top_level),

    _top_level: ($) => choice($.comment, $.import_decl, $.tag_group, $.map_def, $.word_def),

    // Comment / doc block:  ( any text )
    // comment_content is recursive: it can contain plain text and/or nested
    // parenthesised groups, so  ( use f(x) here )  parses correctly.
    comment: ($) => seq('(', optional($.comment_content), ')'),
    comment_content: ($) => repeat1(choice(/[^()]+/, $.comment)),

    // Import:  +path/or/+pkg  Alias
    import_decl: ($) => seq(field('path', $.import_path), field('alias', $.module_alias)),
    import_path: ($) => seq('+', field('url', alias(/[^\s]+/, $.url))),
    module_alias: ($) => seq('~', field('module', alias(UPPERNAME, $.module_ref))),

    // Tag group:  &Name typeParam*  (#TagCase typeParam*)*
    tag_group: ($) =>
      seq(
        field('name_def', $.tag_group_name),
        repeat($.type_variable),
        optional(field('doc', $.comment)),
        repeat($.tag_def),
      ),
    tag_group_name: ($) => seq('&', field('name', alias(UPPERNAME, $.group_ref))),
    tag_def: ($) =>
      seq(
        field('name_def', $.tag_name),
        optional(field('type_param', $.type_variable)),
        optional(field('doc', $.comment)),
      ),
    tag_name: ($) => seq('#', field('name', alias(UPPERNAME, $.tag_ref))),

    // Map definition:  %Name  (.field Type)*
    map_def: ($) =>
      seq(field('name_def', $.map_name), optional(field('doc', $.comment)), repeat($.map_field)),
    map_name: ($) => seq('$', field('name', alias(UPPERNAME, $.map_ref))),
    map_field: ($) =>
      seq(
        field('key', $.map_field_name),
        field('type', $.type_name),
        optional(field('doc', $.comment)),
      ),
    map_field_name: ($) => seq('.', field('name', alias(LOWERNAME, $.field_ref))),

    // Word definition:  @name ( sig ) expr*
    // Signature is required per the spec ("Word definition must have a signature").
    // prec.right makes the body's repeat greedy: prefer consuming '(' as a body
    // comment rather than ending the word_def early.
    word_def: ($) =>
      prec.right(seq(field('name_def', $.word_name), field('sig', $.signature), repeat($._expr))),
    word_name: ($) => seq('@', field('name', alias(LOWERNAME, $.word_ref))),

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
    effect_add: ($) => seq('+', field('name', alias(UPPERNAME, $.effect_ref))),

    // -IO, -FAIL, etc.  (uppercase after dash avoids matching negative numbers)
    effect_remove: ($) => seq('-', field('name', alias(UPPERNAME, $.effect_ref))),

    // ..a, ..row — spread / row-variable in a signature
    spread: ($) => seq('..', field('name', alias(/[a-zA-Z][a-zA-Z0-9_]*/, $.spread_ref))),

    // Uppercase type: Int, Str, Maybe, List, etc.
    type_name: ($) => UPPERNAME,

    // Lowercase type variable: a, b, elem, etc.
    type_variable: ($) => LOWERNAME,

    // Expressions inside word bodies
    _expr: ($) =>
      choice(
        $.comment, // doc / inline comment block
        $.quotation,
        $.builtin_word,
        $.word_call,
        $.module_word_call,
        $.module_tag_constructor,
        $.module_map_access,
        $.map_access,
        $.tag_constructor,
        $.tag_pattern,
        $.default_pattern,
        $.slot_push,
        $.slot_pop,
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

    // /wordName — call a locally defined word
    word_call: ($) => seq('/', field('word', alias(LOWERNAME, $.word_ref))),

    // ~Module/word — module-qualified word call
    // Broken into named fields so the AST exposes module_ref and word_ref nodes.
    module_word_call: ($) =>
      seq(
        '~',
        field('module', alias(UPPERNAME, $.module_ref)),
        '/',
        field('word', alias(LOWERNAME, $.word_ref)),
      ),

    // ~Module#TagName — module-qualified tag constructor
    module_tag_constructor: ($) =>
      seq(
        '~',
        field('module', alias(UPPERNAME, $.module_ref)),
        '#',
        field('tag', alias(UPPERNAME, $.tag_ref)),
      ),

    // ~Module,Map.field — module-qualified map field accessor / lens
    module_map_access: ($) =>
      seq(
        '~',
        field('module', alias(UPPERNAME, $.module_ref)),
        ',',
        field('map', alias(UPPERNAME, $.map_ref)),
        '.',
        field('field', alias(LOWERNAME, $.field_ref)),
      ),

    // ,Map.field — local map field accessor / lens
    map_access: ($) =>
      seq(
        ',',
        field('map', alias(UPPERNAME, $.map_ref)),
        '.',
        field('field', alias(LOWERNAME, $.field_ref)),
      ),

    // #TagName — construct a tagged union value
    tag_constructor: ($) => seq('#', field('name', alias(UPPERNAME, $.tag_ref))),

    // _TagName — match/destructure a tag in MATCH
    tag_pattern: ($) => seq('_', field('name', alias(UPPERNAME, $.tag_ref))),

    // _ — match/destructure a default in MATCH
    default_pattern: ($) => token('_'),

    // :name — pop the top of the stack into a named local slot
    slot_push: ($) => seq(':', field('name', alias(LOWERNAME, $.slot_ref))),

    // ;name — push a named local slot back onto the stack
    slot_pop: ($) => seq(';', field('name', alias(LOWERNAME, $.slot_ref))),

    // 'raw string literal'
    raw_string: ($) => /\'[^\']*\'/,

    // Catch-all: any non-whitespace sequence that doesn't match a more specific
    // rule. prec(-1) gives it the lowest priority so every other token wins
    // when there is a tie. Structural characters ( ) [ ] are excluded because
    // they are needed by the parser to delimit blocks and comments.
    raw_value: ($) => token(prec(-1, /[^\s\[\]()']+/)),
  },
})

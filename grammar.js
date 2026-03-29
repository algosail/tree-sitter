/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
//
// Phrase structure: RFC-0.1 §12.2. Lexical tokens: RFC-lex-0.1.
// Node name `group` / `tag` kept for existing parser queries (parser/lib/group.js).

module.exports = grammar({
  name: 'sail',

  extras: ($) => [/\s+/],

  conflicts: ($) => [
    [$._type_expr, $.generic_type_expr],
    [$.tag],
    [$.product_field],
    [$.generic_type_expr, $.sig_type_expr],
    [$.word, $._expr],
  ],

  rules: {
    source_file: ($) => repeat($._top_level),
    _top_level: ($) => choice($.comment, $.import, $.group, $.product_type, $.word),

    module_def: ($) => token(/\+[A-Z][a-zA-Z0-9_]*/),
    module_type_ref: ($) => token(/~[A-Z][a-zA-Z0-9_]*\/[A-Z][a-zA-Z0-9_]*/),
    module_word_ref: ($) => token(/~[A-Z][a-zA-Z0-9_]*\/[a-z][a-zA-Z0-9_]*/),

    type_name: ($) => token(/[A-Z][a-zA-Z0-9_]*/),
    type_var: ($) => token(/[a-z][a-zA-Z0-9_]*/),

    tag_name: ($) => token(/[A-Z][a-zA-Z0-9_]*/),
    field_name: ($) => token(/[a-z][a-zA-Z0-9_]*/),

    group_def: ($) => token(/&[A-Z][a-zA-Z0-9_]*/),

    word_def: ($) => token(/@[a-z][a-zA-Z0-9_]*/),
    word_ref: ($) => token(/\/[a-z][a-zA-Z0-9_]*/),

    word_name: ($) => token(/[a-z][a-zA-Z0-9_]*/),

    effect_add: ($) => token(/\+(Async|Fail)/),
    effect_remove: ($) => token(/-(Async|Fail)/),

    stack_var: ($) => token(/~[a-z][a-zA-Z0-9_]*/),

    ident: ($) => token(/[a-zA-Z_][a-zA-Z0-9_]*/),

    path: ($) => /[^\s()]+/,

    comment: ($) => seq('--', optional($.comment_content), '--'),
    // No lookahead in tree-sitter regex: forbid `--` inside content via `([^-]|-[^-])*`.
    comment_content: ($) => token(prec(-1, /([^-]|-[^-])*/)),

    import: ($) =>
      seq(
        field('module', $.module_def),
        choice(
          field('path', $.path),
          seq('(', repeat($.import_item), ')', field('path', $.path)),
        ),
      ),

    import_item: ($) => choice($.word_import_item, $.type_import_item),
    word_import_item: ($) => seq('@', field('name', $.word_name)),
    type_import_item: ($) => seq('&', field('type', $.type_name)),

    group: ($) =>
      seq(
        field('def', $.group_def),
        repeat($.type_var),
        optional(field('doc', $.comment)),
        repeat1($.tag),
      ),

    tag: ($) =>
      seq(
        '|',
        field('def', $.tag_name),
        optional(field('payload', $._type_expr)),
        optional(field('doc', $.comment)),
      ),

    product_type: ($) =>
      seq(
        field('def', $.group_def),
        repeat($.type_var),
        optional(field('doc', $.comment)),
        repeat1($.product_field),
      ),

    product_field: ($) =>
      seq(
        ':',
        field('name', $.field_name),
        $._type_expr,
        optional(field('doc', $.comment)),
      ),

    _type_expr: ($) =>
      choice(
        $.map_type_expr,
        $.dict_type_expr,
        $.list_type_expr,
        seq('(', $._type_expr, ')'),
        $.generic_type_expr,
        $.module_type_ref,
        $.type_name,
        $.type_var,
      ),

    list_type_expr: ($) => seq('List', $._type_expr),
    dict_type_expr: ($) => seq('Dict', $._type_expr),
    map_type_expr: ($) => seq('Map', $._type_expr, $._type_expr),

    generic_type_expr: ($) =>
      prec.right(
        seq(choice($.type_name, $.module_type_ref), $._type_expr, repeat($._type_expr)),
      ),

    word: ($) =>
      prec.right(
        seq(
          field('name_def', $.word_def),
          field('sig', $.signature),
          optional(field('doc', $.comment)),
          field('body', repeat($._expr)),
        ),
      ),

    signature: ($) => seq('(', repeat($._sig_item), $.sig_arrow, repeat($._sig_item), ')'),
    sig_arrow: ($) => '->',

    _sig_item: ($) =>
      choice(
        $.effect_add,
        $.effect_remove,
        $.named_quotation_sig,
        $.quotation_sig,
        $.stack_var,
        $.sig_type_expr,
      ),

    sig_type_expr: ($) =>
      choice(seq('(', $._type_expr, ')'), $.module_type_ref, $.type_name, $.type_var),

    quotation_sig: ($) => seq('(', repeat($._sig_item), $.sig_arrow, repeat($._sig_item), ')'),

    named_quotation_sig: ($) => seq($.ident, ':', $.quotation_sig),

    quotation: ($) => seq('(', repeat($._expr), ')'),

    list_literal: ($) => seq('[', repeat($.literal), ']'),

    _expr: ($) =>
      choice(
        $.comment,
        $.quotation,
        $.list_literal,
        $.literal,
        $.builtin_word,
        $.word_ref,
        $.module_word_ref,
        $.slot_write,
        $.slot_read,
      ),

    literal: ($) =>
      choice(
        $.string_literal,
        $.regexp_literal,
        $.bigint_literal,
        $.num_literal,
        $.bool_literal,
        $.nil_literal,
      ),

    nil_literal: ($) => 'nil',
    bool_literal: ($) => choice('true', 'false'),

    bigint_literal: ($) =>
      token(/([0-9][0-9_]*|0[xX][0-9a-fA-F_]+)n/),

    num_literal: ($) =>
      token(
        /[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9_]+)?|0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+/,
      ),

    string_literal: ($) =>
      choice(
        token(seq('"', repeat(choice(/[^"\\\n]+/, /\\./)), '"')),
        token(seq("'", repeat(choice(/[^'\\\n]+/, /\\./)), "'")),
      ),

    regexp_literal: ($) => token(/\/([^/\\\n]|\\.)+\/[gimsuy]*/),

    builtin_word: ($) => token(prec(-1, /[a-z][a-zA-Z0-9_]*/)),

    slot_write: ($) => seq(':', field('name', $.field_name)),
    slot_read: ($) => seq(';', field('name', $.field_name)),
  },
})

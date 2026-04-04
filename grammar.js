/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "sail",

  extras: ($) => [/\s+/],

  conflicts: ($) => [
    [$.data_type, $.sum_type, $.product_type],
    [$.word, $._expr],
    [$._type_expr, $.generic_type_expr],
  ],

  rules: {
    source_file: ($) => repeat($._top_level),
    _top_level: ($) => choice($.comment, $.import, $.type, $.word),

    module_def: ($) => token(/\+[A-Z][a-zA-Z0-9]*/),
    module_type_ref: ($) => token(/~[A-Z][a-zA-Z0-9]*\/[A-Z][a-zA-Z0-9]*/),
    module_word_ref: ($) => token(/~[A-Z][a-zA-Z0-9]*\/[a-z][a-zA-Z0-9]*/),

    type_name: ($) => token(/[A-Z][a-zA-Z0-9]*/),
    type_var: ($) => token(/[a-z][a-z]*/),

    case_name: ($) => token(/[A-Z][a-zA-Z0-9]*/),
    field_name: ($) => token(/[a-z][a-zA-Z0-9]*/),

    type_def: ($) => token(/\$[A-Z][a-zA-Z0-9]*/),
    case_def: ($) => token(/\|[A-Z][a-zA-Z0-9]*/),
    field_def: ($) => token(/\:[a-z][a-zA-Z0-9]*/),

    word_def: ($) => token(/@[a-z][a-zA-Z0-9]*/),
    word_ref: ($) => token(/\/[a-z][a-zA-Z0-9]*/),
    word_name: ($) => token(/[a-z][a-zA-Z0-9]*/),

    effect_add: ($) => token(/\+(Async|Fail)/),
    effect_remove: ($) => token(/-(Async|Fail)/),

    stack_var: ($) => token(/~[a-z]*/),
    quotation_name: ($) => token(/[a-z][a-zA-Z0-9]*:/),

    ident: ($) => token(/[a-z][a-zA-Z0-9]*/),

    file_path: ($) => /\.\.?\/[a-zA-Z0-9_./-]+/,
    npm_package: ($) =>
      token(
        /@[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*|[a-zA-Z][a-zA-Z0-9._-]*(\/[a-zA-Z0-9._-]+)*/,
      ),

    import_source: ($) => choice($.file_path, $.npm_package),

    slot_write: ($) => token(/\:[a-z][a-zA-Z0-9]*/),
    slot_read: ($) => token(/\;[a-z][a-zA-Z0-9]*/),

    comment: ($) => seq("--", optional($.comment_content), "--"),
    // No lookahead in tree-sitter regex: forbid `--` inside content via `([^-]|-[^-])*`.
    comment_content: ($) => token(prec(-1, /[^-]+(-[^-]+)*/)),

    import: ($) =>
      seq(
        field("module", $.module_def),
        choice(
          field("source", $.import_source),
          seq(
            "(",
            repeat($.import_item),
            ")",
            field("source", $.import_source),
          ),
        ),
      ),
    import_item: ($) => choice($.type_name, $.word_name),

    type: ($) => choice($.data_type, $.sum_type, $.product_type),

    data_type: ($) => field("def", $.type_def),

    sum_type: ($) =>
      seq(
        field("def", $.type_def),
        repeat($.type_var),
        optional(field("doc", $.comment)),
        $.case,
        repeat($.case),
      ),
    case: ($) =>
      prec.right(
        seq(
          field("def", $.case_def),
          optional($._type_expr),
          optional(field("doc", $.comment)),
        ),
      ),

    product_type: ($) =>
      seq(
        field("def", $.type_def),
        repeat($.type_var),
        optional(field("doc", $.comment)),
        $.field,
        repeat($.field),
      ),

    field: ($) =>
      prec.right(
        seq(
          field("def", $.field_def),
          $._type_expr,
          optional(field("doc", $.comment)),
        ),
      ),

    _type_expr: ($) =>
      choice(
        $.map_type_expr,
        $.dict_type_expr,
        $.list_type_expr,
        $.set_type_expr,
        $.generic_type_expr,
        $.module_type_ref,
        $.type_name,
        $.type_var,
      ),

    list_type_expr: ($) => seq("(", "List", $._type_expr, ")"),
    set_type_expr: ($) => seq("(", "Set", $._type_expr, ")"),
    dict_type_expr: ($) => seq("(", "Dict", $._type_expr, ")"),
    map_type_expr: ($) => seq("(", "Map", $._type_expr, $._type_expr, ")"),

    generic_type_expr: ($) =>
      seq(
        "(",
        choice($.type_name, $.module_type_ref),
        $._type_expr,
        repeat($._type_expr),
        ")",
      ),

    word: ($) =>
      prec.right(
        seq(
          field("name_def", $.word_def),
          field("sig", $.signature),
          optional(field("doc", $.comment)),
          field("body", repeat($._expr)),
        ),
      ),

    signature: ($) =>
      seq(
        "(",
        repeat($._sig_item),
        $.sig_arrow,
        repeat($._sig_item),
        repeat($.effects),
        ")",
      ),
    sig_arrow: ($) => "->",

    effects: ($) => choice($.effect_add, $.effect_remove),

    _sig_item: ($) =>
      choice($.named_quotation_sig, $.quotation_sig, $.stack_var, $._type_expr),

    quotation_sig: ($) =>
      seq(
        "(",
        repeat($._sig_item),
        $.sig_arrow,
        repeat($._sig_item),
        repeat($.effects),
        ")",
      ),

    named_quotation_sig: ($) => seq($.quotation_name, $.quotation_sig),

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

    quotation: ($) => seq("(", repeat($._expr), ")"),

    list_literal: ($) => seq("[", repeat($.literal), "]"),

    literal: ($) =>
      choice(
        $.string_literal,
        $.regexp_literal,
        $.bigint_literal,
        $.num_literal,
        $.bool_literal,
        $.nil_literal,
      ),

    nil_literal: ($) => "nil",
    bool_literal: ($) => choice("true", "false"),

    bigint_literal: ($) => token(/([0-9][0-9_]*|0[xX][0-9a-fA-F_]+)n/),

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

    builtin_word: ($) => token(prec(-1, /[a-z][a-zA-Z0-9]*/)),
  },
});

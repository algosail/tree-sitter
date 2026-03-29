; Imports
(module_def) @namespace
(module_type_ref) @type
(module_word_ref) @function.call
(path) @string.special

; ADT
(group_def) @type
(tag_name) @constructor

; Product types
(field_name) @property

; Words
(word_def) @function
(word_ref) @function.call

; Types in signatures
(type_name) @type
(type_var) @variable.parameter

; Signatures
(sig_arrow) @operator

; Effects
(effect_add) @attribute
(effect_remove) @attribute

; Slots
(slot_write) @variable
(slot_read) @variable

; Builtins (lowercase bare words, RFC-0.1)
(builtin_word) @keyword.function

; Literals
(string_literal) @string
(num_literal) @number
(bigint_literal) @number
(bool_literal) @constant.builtin
(nil_literal) @constant.builtin
(regexp_literal) @string.regexp

; Identifiers in named quotation sigs
(ident) @variable.special

; Comments
(comment) @comment

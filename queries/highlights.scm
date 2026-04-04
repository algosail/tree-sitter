; Imports
(module_def) @namespace
(module_type_ref) @type
(module_word_ref) @function.call
(file_path) @string.special
(npm_package) @string.special

; Type definitions
(type_def) @type.definition
(case_def) @constructor
(field_def) @property

; Words
(word_def) @function
(word_ref) @function.call

; Type expressions
(type_name) @type
(type_var) @variable.parameter

; Signatures
(sig_arrow) @operator
(stack_var) @variable.parameter
(quotation_name) @label

; Effects
(effect_add) @attribute
(effect_remove) @attribute

; Slots
(slot_write) @variable
(slot_read) @variable

; Builtins (lowercase bare words)
(builtin_word) @keyword.function

; Literals
(string_literal) @string
(num_literal) @number
(bigint_literal) @number
(bool_literal) @constant.builtin
(nil_literal) @constant.builtin
(regexp_literal) @string.regexp

; Comments
(comment) @comment

; TypeScript / TSX symbol queries (Module 104)
(function_declaration
  name: (identifier) @name) @function

(generator_function_declaration
  name: (identifier) @name) @function

(class_declaration
  name: (type_identifier) @name) @class

(abstract_class_declaration
  name: (type_identifier) @name) @class

(method_definition
  name: (property_identifier) @name) @method

(method_definition
  name: (private_property_identifier) @name) @method

(interface_declaration
  name: (type_identifier) @name) @interface

(type_alias_declaration
  name: (type_identifier) @name) @type

(enum_declaration
  name: (identifier) @name) @type

(lexical_declaration
  (variable_declarator
    name: (identifier) @name) @variable)

(variable_declaration
  (variable_declarator
    name: (identifier) @name) @variable)

(function_expression
  name: (identifier) @name) @function

(generator_function
  name: (identifier) @name) @function

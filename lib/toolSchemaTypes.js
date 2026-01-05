/**
 * @fileoverview TypeScript/JSDoc type definitions for tool schema structures
 */

/**
 * @typedef {Object} ToolConfigField
 * @property {string} type - Field type: 'string', 'integer', 'number', 'object', 'boolean', 'array'
 * @property {string} description - Human-readable description of the field
 * @property {boolean} required - Whether the field is required
 * @property {*} default - Default value for the field (if any)
 * @property {string|null} env_var - Environment variable name to use (if any)
 * @property {Array<*>|null} enum - Array of allowed values (if field is an enum)
 */

/**
 * @typedef {Object} ToolConfigSchema
 * @property {string} name - Tool name/identifier
 * @property {string} description - Tool description
 * @property {Object<string, ToolConfigField>} config_fields - Map of field names to field definitions
 */

/**
 * @typedef {Object} ToolSchemaResponse
 * @property {Array<ToolConfigSchema>} schemas - Array of tool schemas
 */

/**
 * @typedef {Object} ConfiguredTool
 * @property {string} name - Tool name
 * @property {Object} config - Tool configuration object with field values
 */

export {};


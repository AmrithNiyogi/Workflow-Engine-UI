'use client';

/**
 * @fileoverview Dynamic Tool Schema Form Component
 * 
 * This component renders a dynamic form based on a tool's configuration schema.
 * It fetches the schema from the API and renders appropriate input fields for
 * each configuration field defined in the schema.
 * 
 * Supported field types:
 * - string: Text input
 * - integer/number: Number input
 * - boolean: Checkbox
 * - object/array: JSON textarea editor
 * - enum: Dropdown select
 * 
 * Features:
 * - Automatic field type detection and rendering
 * - Required field validation
 * - Type validation (integer, number, JSON, etc.)
 * - Enum value validation
 * - Default value pre-filling
 * - Environment variable hints
 * - Field descriptions
 * - Inline error messages
 * 
 * @module ToolSchemaForm
 */

import { useState, useEffect } from 'react';
import NeoInput from '@/components/NeoInput';
import NeoTextarea from '@/components/NeoTextarea';
import NeoSelect from '@/components/NeoSelect';
import NeoButton from '@/components/NeoButton';
import { getToolSchemas } from '@/lib/api';

/**
 * Dynamic form component for configuring tools based on their schemas
 * @param {Object} props
 * @param {string} props.toolName - Name of the tool to configure
 * @param {string|null} props.framework - Framework filter (optional)
 * @param {Object} props.initialConfig - Initial configuration values
 * @param {Function} props.onConfigChange - Callback when config changes (config, isValid)
 * @param {Function} props.onRemove - Callback when tool should be removed
 * @param {boolean} props.showRemove - Whether to show remove button
 */
export default function ToolSchemaForm({
  toolName,
  framework = null,
  initialConfig = {},
  onConfigChange,
  onRemove,
  showRemove = true,
}) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(initialConfig);
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch schema on mount or when toolName/framework changes
  useEffect(() => {
    if (!toolName) {
      setSchema(null);
      setLoading(false);
      return;
    }

    const fetchSchema = async () => {
      setLoading(true);
      setError(null);
      setValidationErrors({});

      try {
        const { data, error: apiError } = await getToolSchemas(framework);

        if (apiError) {
          setError(apiError);
          setSchema(null);
        } else {
          // Find the schema for this tool
          const toolSchema = data?.schemas?.find((s) => s.name === toolName);
          if (toolSchema) {
            setSchema(toolSchema);
            // Initialize config with default values
            const defaultConfig = {};
            if (toolSchema.config_fields) {
              Object.entries(toolSchema.config_fields).forEach(([fieldName, field]) => {
                if (field.default !== undefined && field.default !== null) {
                  defaultConfig[fieldName] = field.default;
                } else if (initialConfig[fieldName] !== undefined) {
                  let value = initialConfig[fieldName];
                  // If field is object/array and value is a string, try to parse it
                  if ((field.type === 'object' || field.type === 'array') && typeof value === 'string') {
                    try {
                      value = JSON.parse(value);
                    } catch (e) {
                      // Keep as string if parsing fails
                    }
                  }
                  defaultConfig[fieldName] = value;
                }
              });
            }
            setConfig({ ...defaultConfig, ...initialConfig });
          } else {
            setError(`No schema found for tool: ${toolName}`);
            setSchema(null);
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch tool schema');
        setSchema(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [toolName, framework]);

  // Validate and notify parent when config changes
  useEffect(() => {
    if (schema && onConfigChange) {
      const errors = validateConfig(config, schema);
      setValidationErrors(errors);
      const isValid = Object.keys(errors).length === 0;
      onConfigChange(config, isValid);
    }
  }, [config, schema, onConfigChange]);

  /**
   * Validate configuration against schema
   */
  const validateConfig = (configToValidate, schemaToValidate) => {
    const errors = {};

    if (!schemaToValidate?.config_fields) {
      return errors;
    }

    Object.entries(schemaToValidate.config_fields).forEach(([fieldName, field]) => {
      const value = configToValidate[fieldName];

      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors[fieldName] = 'This field is required';
        return;
      }

      // Skip validation if field is empty and not required
      if (value === undefined || value === null || value === '') {
        return;
      }

      // Validate type
      switch (field.type) {
        case 'integer':
          if (!Number.isInteger(Number(value)) && value !== '') {
            errors[fieldName] = 'Must be an integer';
          }
          break;
        case 'number':
          if (isNaN(Number(value)) && value !== '') {
            errors[fieldName] = 'Must be a number';
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors[fieldName] = 'Must be a boolean';
          }
          break;
        case 'object':
          try {
            if (typeof value === 'string') {
              JSON.parse(value);
            }
          } catch (e) {
            errors[fieldName] = 'Must be valid JSON';
          }
          break;
        case 'array':
          try {
            if (typeof value === 'string') {
              JSON.parse(value);
            }
          } catch (e) {
            errors[fieldName] = 'Must be valid JSON array';
          }
          break;
      }

      // Validate enum
      if (field.enum && field.enum.length > 0) {
        if (!field.enum.includes(value)) {
          errors[fieldName] = `Must be one of: ${field.enum.join(', ')}`;
        }
      }
    });

    return errors;
  };

  /**
   * Handle field value change
   */
  const handleFieldChange = (fieldName, field, value) => {
    let processedValue = value;

    // Process value based on type
    switch (field.type) {
      case 'integer':
        processedValue = value === '' ? '' : parseInt(value, 10);
        if (isNaN(processedValue)) processedValue = value; // Keep string if invalid
        break;
      case 'number':
        processedValue = value === '' ? '' : parseFloat(value);
        if (isNaN(processedValue)) processedValue = value; // Keep string if invalid
        break;
      case 'boolean':
        processedValue = value === 'true' || value === true;
        break;
      case 'object':
      case 'array':
        // Keep as string for JSON editor
        processedValue = value;
        break;
      default:
        processedValue = value;
    }

    setConfig((prev) => ({
      ...prev,
      [fieldName]: processedValue,
    }));
  };

  /**
   * Build label content for a field
   */
  const buildFieldLabel = (fieldName, field) => {
    return (
      <>
        {fieldName}
        {field.required && <span className="text-[#FFB6C1]"> *</span>}
        {field.env_var && (
          <span className="text-xs text-gray-600 ml-2">
            (env: {field.env_var})
          </span>
        )}
      </>
    );
  };

  /**
   * Render a form field based on schema
   */
  const renderField = (fieldName, field) => {
    const value = config[fieldName] ?? '';
    const hasError = validationErrors[fieldName];
    const fieldId = `tool-${toolName}-${fieldName}`;

    // Render enum as dropdown
    if (field.enum && field.enum.length > 0) {
      return (
        <div key={fieldName} className="mb-4">
          <NeoSelect
            label={buildFieldLabel(fieldName, field)}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, field, e.target.value)}
            options={field.enum.map((val) => ({ value: val, label: String(val) }))}
            required={field.required}
            className={hasError ? 'border-[#FFB6C1]' : ''}
          />
          {field.description && (
            <p className="text-sm text-gray-700 mt-1 mb-2">{field.description}</p>
          )}
          {hasError && (
            <p className="text-sm text-[#FFB6C1] font-bold mt-1">{hasError}</p>
          )}
        </div>
      );
    }

    // Render boolean as checkbox
    if (field.type === 'boolean') {
      return (
        <div key={fieldName} className="mb-4">
          <label className="block font-bold text-black mb-2">
            {fieldName}
            {field.required && <span className="text-[#FFB6C1]"> *</span>}
            {field.env_var && (
              <span className="text-xs text-gray-600 ml-2">
                (env: {field.env_var})
              </span>
            )}
          </label>
          <label className="flex items-center border-4 border-black p-2 bg-white cursor-pointer hover:bg-[#90EE90] w-fit">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => handleFieldChange(fieldName, field, e.target.checked)}
              className="mr-2 w-4 h-4 border-2 border-black"
            />
            <span className="font-semibold text-black text-sm">
              {value === true || value === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </label>
          {field.description && (
            <p className="text-sm text-gray-700 mt-1 mb-2">{field.description}</p>
          )}
          {hasError && (
            <p className="text-sm text-[#FFB6C1] font-bold mt-1">{hasError}</p>
          )}
        </div>
      );
    }

    // Render object/array as textarea (JSON editor)
    if (field.type === 'object' || field.type === 'array') {
      let displayValue = value;
      if (typeof value === 'object' && value !== null) {
        try {
          displayValue = JSON.stringify(value, null, 2);
        } catch (e) {
          displayValue = String(value);
        }
      }

      return (
        <div key={fieldName} className="mb-4">
          <NeoTextarea
            label={buildFieldLabel(fieldName, field)}
            value={displayValue}
            onChange={(e) => handleFieldChange(fieldName, field, e.target.value)}
            placeholder={`Enter valid JSON ${field.type === 'array' ? 'array' : 'object'}`}
            required={field.required}
            rows={6}
            className={hasError ? 'border-[#FFB6C1]' : ''}
          />
          {field.description && (
            <p className="text-sm text-gray-700 mt-1 mb-2">{field.description}</p>
          )}
          {hasError && (
            <p className="text-sm text-[#FFB6C1] font-bold mt-1">{hasError}</p>
          )}
        </div>
      );
    }

    // Render number/integer as number input
    if (field.type === 'integer' || field.type === 'number') {
      return (
        <div key={fieldName} className="mb-4">
          <NeoInput
            label={buildFieldLabel(fieldName, field)}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, field, e.target.value)}
            placeholder={field.default !== undefined ? String(field.default) : ''}
            required={field.required}
            className={hasError ? 'border-[#FFB6C1]' : ''}
          />
          {field.description && (
            <p className="text-sm text-gray-700 mt-1 mb-2">{field.description}</p>
          )}
          {hasError && (
            <p className="text-sm text-[#FFB6C1] font-bold mt-1">{hasError}</p>
          )}
        </div>
      );
    }

    // Default: render as text input
    return (
      <div key={fieldName} className="mb-4">
        <NeoInput
          label={buildFieldLabel(fieldName, field)}
          type="text"
          value={value}
          onChange={(e) => handleFieldChange(fieldName, field, e.target.value)}
          placeholder={field.default !== undefined ? String(field.default) : ''}
          required={field.required}
          className={hasError ? 'border-[#FFB6C1]' : ''}
        />
        {field.description && (
          <p className="text-sm text-gray-700 mt-1 mb-2">{field.description}</p>
        )}
        {hasError && (
          <p className="text-sm text-[#FFB6C1] font-bold mt-1">{hasError}</p>
        )}
      </div>
    );
  };

  if (!toolName) {
    return (
      <div className="neo-card p-4">
        <p className="text-black font-semibold">Please select a tool to configure.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="neo-card p-4">
        <p className="text-black font-semibold">Loading tool schema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neo-card-colored bg-[#FFB6C1] p-4">
        <p className="font-bold text-black">Error: {error}</p>
        <p className="text-sm text-black mt-2">
          You can still configure this tool manually, but schema-based validation is not available.
        </p>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="neo-card p-4">
        <p className="text-black font-semibold">
          No schema available for tool: {toolName}
        </p>
        <p className="text-sm text-gray-700 mt-2">
          This tool may not have a configuration schema defined.
        </p>
      </div>
    );
  }

  const configFields = schema.config_fields || {};
  const fieldNames = Object.keys(configFields);

  return (
    <div className="neo-card p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-black text-black mb-2">{schema.name}</h3>
          {schema.description && (
            <p className="text-sm text-gray-700">{schema.description}</p>
          )}
        </div>
        {showRemove && onRemove && (
          <NeoButton variant="danger" onClick={onRemove} type="button">
            Remove
          </NeoButton>
        )}
      </div>

      {fieldNames.length === 0 ? (
        <p className="text-black font-semibold">
          This tool has no configuration fields.
        </p>
      ) : (
        <div className="space-y-4">
          {fieldNames.map((fieldName) => renderField(fieldName, configFields[fieldName]))}
        </div>
      )}
    </div>
  );
}


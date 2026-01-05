'use client';

/**
 * @fileoverview Tool Configuration Manager Component
 * 
 * This component provides a complete UI for managing tool configurations for agents.
 * It fetches available tool schemas from the API, allows users to select tools,
 * and provides dynamic forms for configuring each tool based on its schema.
 * 
 * Features:
 * - Fetches tool schemas from /api/agents/tool-schemas
 * - Supports framework filtering
 * - Caches schemas to avoid repeated API calls
 * - Validates tool configurations
 * - Handles multiple tool configurations
 * - Provides visual feedback for loading, errors, and validation
 * 
 * @module ToolConfigurationManager
 */

import { useState, useEffect, useMemo } from 'react';
import NeoSelect from '@/components/NeoSelect';
import NeoButton from '@/components/NeoButton';
import ToolSchemaForm from '@/components/ToolSchemaForm';
import { getToolSchemas } from '@/lib/api';

/**
 * Schema cache to avoid repeated API calls
 * Key: framework string or 'all' for no framework filter
 * Value: Array of tool schemas
 */
const schemaCache = new Map();

/**
 * Tool Configuration Manager Component
 * Manages tool selection and configuration for agents
 * @param {Object} props
 * @param {string|null} props.framework - Framework filter
 * @param {Array<Object>} props.configuredTools - Array of configured tools: [{name: string, config: object}]
 * @param {Function} props.onToolsChange - Callback when tools change (configuredTools)
 */
export default function ToolConfigurationManager({
  framework = null,
  configuredTools = [],
  onToolsChange,
}) {
  const [availableSchemas, setAvailableSchemas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedToolName, setSelectedToolName] = useState('');
  const [toolConfigs, setToolConfigs] = useState([]);
  const [toolValidation, setToolValidation] = useState({}); // {toolIndex: isValid}

  // Initialize tool configs from props
  useEffect(() => {
    if (configuredTools && configuredTools.length > 0) {
      setToolConfigs(configuredTools.map((tool) => ({ ...tool })));
    }
  }, []); // Only on mount

  // Fetch available tool schemas
  useEffect(() => {
    const fetchSchemas = async () => {
      setLoading(true);
      setError(null);

      // Check cache first
      const cacheKey = framework || 'all';
      if (schemaCache.has(cacheKey)) {
        setAvailableSchemas(schemaCache.get(cacheKey));
        setLoading(false);
        return;
      }

      try {
        const { data, error: apiError } = await getToolSchemas(framework);

        if (apiError) {
          setError(apiError);
          setAvailableSchemas([]);
        } else {
          const schemas = data?.schemas || [];
          setAvailableSchemas(schemas);
          // Cache the results
          schemaCache.set(cacheKey, schemas);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch tool schemas');
        setAvailableSchemas([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchemas();
  }, [framework]);

  // Notify parent when tool configs change
  useEffect(() => {
    if (onToolsChange) {
      // Filter out invalid tools
      const validTools = toolConfigs
        .map((tool, index) => ({
          tool,
          index,
          isValid: toolValidation[index] !== false,
        }))
        .filter(({ isValid }) => isValid)
        .map(({ tool }) => tool);

      onToolsChange(validTools);
    }
  }, [toolConfigs, toolValidation, onToolsChange]);

  /**
   * Handle adding a new tool
   */
  const handleAddTool = () => {
    if (!selectedToolName) {
      return;
    }

    // Check if tool is already added
    if (toolConfigs.some((tool) => tool.name === selectedToolName)) {
      setError(`Tool "${selectedToolName}" is already configured`);
      return;
    }

    const newTool = {
      name: selectedToolName,
      config: {},
    };

    setToolConfigs([...toolConfigs, newTool]);
    setSelectedToolName('');
    setError(null);
  };

  /**
   * Handle removing a tool
   */
  const handleRemoveTool = (index) => {
    const newConfigs = toolConfigs.filter((_, i) => i !== index);
    setToolConfigs(newConfigs);
    
    // Clean up validation state
    const newValidation = { ...toolValidation };
    delete newValidation[index];
    // Reindex remaining tools
    const reindexed = {};
    newConfigs.forEach((_, i) => {
      if (toolValidation[i + 1] !== undefined) {
        reindexed[i] = toolValidation[i + 1];
      }
    });
    setToolValidation(reindexed);
  };

  /**
   * Handle tool config change
   */
  const handleToolConfigChange = (index, config, isValid) => {
    const newConfigs = [...toolConfigs];
    newConfigs[index] = {
      ...newConfigs[index],
      config,
    };
    setToolConfigs(newConfigs);

    // Update validation state
    setToolValidation((prev) => ({
      ...prev,
      [index]: isValid,
    }));
  };

  /**
   * Get available tool options (excluding already configured tools)
   */
  const availableToolOptions = useMemo(() => {
    const configuredNames = new Set(toolConfigs.map((tool) => tool.name));
    return availableSchemas
      .filter((schema) => !configuredNames.has(schema.name))
      .map((schema) => ({
        value: schema.name,
        label: `${schema.name}${schema.description ? ` - ${schema.description}` : ''}`,
      }));
  }, [availableSchemas, toolConfigs]);

  return (
    <div className="mb-6">
      <div className="neo-card p-4 mb-4">
        <h2 className="text-2xl font-black text-black mb-4 border-b-4 border-black pb-2">
          Tool Configuration
        </h2>

        {loading && (
          <div className="mb-4">
            <p className="text-black font-semibold">Loading available tools...</p>
          </div>
        )}

        {error && (
          <div className="neo-card-colored bg-[#FFB6C1] p-3 mb-4">
            <p className="font-bold text-black">⚠️ Error: {error}</p>
          </div>
        )}

        {!loading && availableSchemas.length === 0 && !error && (
          <div className="neo-card-colored bg-[#FFD700] p-3 mb-4">
            <p className="font-bold text-black">
              No tool schemas available{framework ? ` for framework: ${framework}` : ''}.
            </p>
          </div>
        )}

        {/* Tool Selection */}
        {availableSchemas.length > 0 && (
          <div className="mb-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <NeoSelect
                  label="Select Tool to Configure"
                  value={selectedToolName}
                  onChange={(e) => {
                    setSelectedToolName(e.target.value);
                    setError(null);
                  }}
                  options={[
                    { value: '', label: '-- Select a tool --' },
                    ...availableToolOptions,
                  ]}
                />
              </div>
              <NeoButton
                variant="primary"
                onClick={handleAddTool}
                disabled={!selectedToolName}
                type="button"
              >
                Add Tool
              </NeoButton>
            </div>
            {availableToolOptions.length === 0 && toolConfigs.length > 0 && (
              <p className="text-sm text-gray-700 mt-2">
                All available tools have been configured.
              </p>
            )}
          </div>
        )}

        {/* Configured Tools List */}
        {toolConfigs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xl font-black text-black mb-4">
              Configured Tools ({toolConfigs.length})
            </h3>
            <div className="space-y-4">
              {toolConfigs.map((tool, index) => (
                <div key={`${tool.name}-${index}`} className="border-4 border-black p-2 bg-white">
                  <ToolSchemaForm
                    toolName={tool.name}
                    framework={framework}
                    initialConfig={tool.config}
                    onConfigChange={(config, isValid) =>
                      handleToolConfigChange(index, config, isValid)
                    }
                    onRemove={() => handleRemoveTool(index)}
                    showRemove={true}
                  />
                  {toolValidation[index] === false && (
                    <div className="mt-2 p-2 bg-[#FFB6C1] border-2 border-black">
                      <p className="text-sm font-bold text-black">
                        ⚠️ This tool configuration has validation errors.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {toolConfigs.length === 0 && !loading && (
          <div className="neo-card-colored bg-[#87CEEB] p-4">
            <p className="font-bold text-black">
              No tools configured yet. Select a tool above to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


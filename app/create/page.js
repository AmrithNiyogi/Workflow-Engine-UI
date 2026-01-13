'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import NeoInput from '@/components/NeoInput';
import NeoTextarea from '@/components/NeoTextarea';
import NeoSelect from '@/components/NeoSelect';
import NeoButton from '@/components/NeoButton';
import CustomToolForm from '@/components/CustomToolForm';
import MCPServerForm from '@/components/MCPServerForm';
import { createAgent, listTools } from '@/lib/api';
import { FRAMEWORKS, CAPABILITIES, STATUS_OPTIONS } from '@/lib/constants';

export default function CreateAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('langchain');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState('');
  const [capabilities, setCapabilities] = useState(['conversation']);
  const [tools, setTools] = useState([]);
  const [toolConfigs, setToolConfigs] = useState({}); // { toolName: { propertyName: value } }
  const [customTools, setCustomTools] = useState([]);
  const [mcpServers, setMcpServers] = useState({});
  const [enableShortTermPostgres, setEnableShortTermPostgres] = useState(false);
  const [tags, setTags] = useState('');
  const [maxIterations, setMaxIterations] = useState(5);
  const [timeout, setTimeout] = useState('');
  const [status, setStatus] = useState('draft');
  const [owner, setOwner] = useState('');
  const [category, setCategory] = useState('');
  const [availableTools, setAvailableTools] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  // Handle navigation after success
  useEffect(() => {
    if (success) {
      const timer = window.setTimeout(() => {
        router.push('/agents');
      }, 2000);
      return () => window.clearTimeout(timer);
    }
  }, [success, router]);

  // Fetch available tools on mount
  useEffect(() => {
    const fetchTools = async () => {
      setToolsLoading(true);
      const { data, error } = await listTools(0, 100);
      if (!error && data) {
        // Handle different response structures: data.tools or data directly (array)
        const tools = Array.isArray(data) ? data : (data.tools || data.items || []);
        console.log('Tools response:', { data, tools, toolsLength: tools.length });
        setAvailableTools(tools);
      } else {
        console.error('Error fetching tools:', error);
      }
      setToolsLoading(false);
    };
    fetchTools();
  }, []);

  const handleAddCustomTool = (tool, newTools = null) => {
    if (newTools !== null) {
      setCustomTools(newTools);
    } else if (tool) {
      setCustomTools([...customTools, tool]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name || !framework || !systemPrompt || !model || !owner || !category) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    // Build tools array - strings for tools without properties, objects for tools with properties
    const builtInTools = tools.map(toolName => {
      const toolConfig = toolConfigs[toolName];
      const tool = availableTools.find(t => t.name === toolName);
      
      // If tool has properties and config exists, return object with name and config
      if (tool && tool.properties && Object.keys(tool.properties).length > 0 && toolConfig && Object.keys(toolConfig).length > 0) {
        return {
          name: toolName,
          config: toolConfig
        };
      }
      // Otherwise return as string
      return toolName;
    });
    
    // Combine built-in tools and custom tools
    const allTools = [...builtInTools, ...customTools];

    if (!owner || !category) {
      setError('Owner and Category are required fields');
      return;
    }

    // Build framework_config with MCP servers if configured
    const frameworkConfig = {};
    if (Object.keys(mcpServers).length > 0) {
      frameworkConfig.mcp_servers = mcpServers;
    }

    // Build memory configuration
    const memory = enableShortTermPostgres ? {
      short_term: {
        type: 'short_term_postgres'
      }
    } : undefined;

    const agentData = {
      name,
      framework,
      system_prompt: systemPrompt,
      description: description || null,
      llm_config: {
        model,
        temperature,
        max_tokens: maxTokens ? parseInt(maxTokens) : null,
      },
      capabilities,
      tools: allTools,
      memory,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
      max_iterations: maxIterations,
      timeout: timeout ? parseFloat(timeout) : null,
      status,
      owner,
      category,
      framework_config: Object.keys(frameworkConfig).length > 0 ? frameworkConfig : {},
    };

    const { data, error: apiError } = await createAgent(agentData);

    setLoading(false);

    if (apiError) {
      setError(apiError);
    } else {
      setSuccess(true);
      // Navigation will be handled by useEffect
    }
  };

  const modelPlaceholder = 'sangria_text_generations_claude';

  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#87CEEB] mb-6">
          <h1 className="text-4xl font-black text-black">Create New Agent</h1>
        </div>

        <MCPServerForm 
          onAddServer={(servers) => setMcpServers(servers)} 
          mcpServers={mcpServers} 
        />

        <CustomToolForm 
          onAddTool={(tool, newTools) => {
            if (newTools !== null && newTools !== undefined) {
              setCustomTools(newTools);
            } else if (tool) {
              setCustomTools([...customTools, tool]);
            }
          }} 
          customTools={customTools}
          mcpServers={mcpServers}
        />

        <form onSubmit={handleSubmit} className="neo-card">
          <h2 className="text-2xl font-black text-black mb-6 border-b-4 border-black pb-2">
            Basic Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeoInput
              label="Agent Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Assistant"
              required
            />
            <NeoSelect
              label="Framework"
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              options={FRAMEWORKS.map(f => ({ value: f, label: f }))}
              required
            />
          </div>

          <NeoTextarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the agent"
            rows={2}
          />

          <NeoTextarea
            label="System Prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful AI assistant..."
            required
            rows={4}
          />

          <h2 className="text-2xl font-black text-black mb-6 mt-8 border-b-4 border-black pb-2">
            LLM Configuration
          </h2>
          <p className="text-black font-semibold mb-4 text-sm">
            Note: Provider, Base URL, and API Key are automatically configured from environment variables.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeoInput
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={modelPlaceholder}
              required
            />
            <div>
              <label className="block font-bold text-black mb-2">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full border-4 border-black"
              />
            </div>
          </div>

          <NeoInput
            label="Max Tokens"
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            placeholder="Optional"
          />

          <h2 className="text-2xl font-black text-black mb-6 mt-8 border-b-4 border-black pb-2">
            Agent Metadata
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NeoSelect
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
              required
            />
            <NeoInput
              label="Owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Agent owner"
              required
            />
            <NeoInput
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Agent category"
              required
            />
          </div>

          <h2 className="text-2xl font-black text-black mb-6 mt-8 border-b-4 border-black pb-2">
            Additional Configuration
          </h2>

          <div className="mb-4">
            <label className="block font-bold text-black mb-2">Capabilities</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {CAPABILITIES.map((cap) => (
                <label key={cap} className="flex items-center border-4 border-black p-2 bg-white cursor-pointer hover:bg-[#90EE90]">
                  <input
                    type="checkbox"
                    checked={capabilities.includes(cap)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCapabilities([...capabilities, cap]);
                      } else {
                        setCapabilities(capabilities.filter(c => c !== cap));
                      }
                    }}
                    className="mr-2 w-4 h-4 border-2 border-black"
                  />
                  <span className="font-semibold text-black text-sm">{cap}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block font-bold text-black mb-2">Available Tools</label>
            {Object.keys(mcpServers).length > 0 && (
              <div className="bg-[#FFD700] border-4 border-black p-3 mb-3">
                <p className="font-bold text-black text-sm">
                  ⚠️ MCP servers are configured. Built-in and custom tools will be ignored. Only MCP tools will be used.
                </p>
              </div>
            )}
            {toolsLoading ? (
              <div className="neo-card p-4">
                <p className="text-black font-semibold">Loading tools...</p>
              </div>
            ) : availableTools.length === 0 ? (
              <div className="neo-card-colored bg-[#FFD700] p-3">
                <p className="font-bold text-black text-sm">No tools available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableTools.map((tool) => (
                  <label 
                    key={tool.name} 
                    className={`flex items-start border-4 border-black p-3 cursor-pointer ${
                      Object.keys(mcpServers).length > 0 
                        ? 'bg-gray-300 opacity-50 cursor-not-allowed' 
                        : 'bg-white hover:bg-[#FFC0CB]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={tools.includes(tool.name)}
                      disabled={Object.keys(mcpServers).length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTools([...tools, tool.name]);
                          // Initialize empty config for tools with properties
                          if (tool.properties && Object.keys(tool.properties).length > 0) {
                            setToolConfigs(prev => ({
                              ...prev,
                              [tool.name]: {}
                            }));
                          }
                        } else {
                          setTools(tools.filter(t => t !== tool.name));
                          setToolConfigs(prev => {
                            const newConfigs = { ...prev };
                            delete newConfigs[tool.name];
                            return newConfigs;
                          });
                        }
                      }}
                      className="mr-2 mt-1 w-4 h-4 border-2 border-black flex-shrink-0"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-black text-sm block">{tool.name}</span>
                      {tool.description && (
                        <span className="text-xs text-gray-700 block mt-1">{tool.description}</span>
                      )}
                      {tool.tool_type && (
                        <span className="text-xs text-gray-600 block mt-1">Type: {tool.tool_type}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tool Properties Configuration */}
          {tools.filter(toolName => {
            const tool = availableTools.find(t => t.name === toolName);
            return tool && tool.properties && Object.keys(tool.properties).length > 0;
          }).length > 0 && (
            <div className="mb-4 mt-6">
              <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                Tool Configuration
              </h3>
              {tools.map(toolName => {
                const tool = availableTools.find(t => t.name === toolName);
                if (!tool || !tool.properties || Object.keys(tool.properties).length === 0) {
                  return null;
                }

                return (
                  <div key={toolName} className="mb-6 p-4 border-4 border-black bg-white">
                    <h4 className="font-bold text-black mb-3 text-lg">{tool.name} Properties</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(tool.properties).map(([propName, propDef]) => {
                        const propType = propDef?.type || 'string';
                        const currentValue = toolConfigs[toolName]?.[propName] || '';
                        
                        return (
                          <div key={propName}>
                            {propType === 'password' ? (
                              <NeoInput
                                label={propName}
                                type="password"
                                value={currentValue}
                                onChange={(e) => {
                                  setToolConfigs(prev => ({
                                    ...prev,
                                    [toolName]: {
                                      ...prev[toolName],
                                      [propName]: e.target.value
                                    }
                                  }));
                                }}
                              />
                            ) : (
                              <NeoInput
                                label={propName}
                                type="text"
                                value={currentValue}
                                onChange={(e) => {
                                  setToolConfigs(prev => ({
                                    ...prev,
                                    [toolName]: {
                                      ...prev[toolName],
                                      [propName]: e.target.value
                                    }
                                  }));
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-4">
            <label className="block font-bold text-black mb-2">Memory</label>
            <div className="bg-[#87CEEB] border-4 border-black p-3 mb-3">
              <p className="font-bold text-black text-sm mb-2">
                💾 Memory Configuration
              </p>
              <p className="text-black text-xs font-semibold mb-3">
                Enable short-term postgres memory to maintain conversation state across multiple executions using PostgreSQL checkpointing.
              </p>
              <label className="flex items-center border-4 border-black p-3 bg-white cursor-pointer hover:bg-[#90EE90]">
                <input
                  type="checkbox"
                  checked={enableShortTermPostgres}
                  onChange={(e) => setEnableShortTermPostgres(e.target.checked)}
                  className="mr-3 w-5 h-5 border-2 border-black"
                />
                <div className="flex-1">
                  <span className="font-bold text-black text-base block">
                    Enable Short-Term Postgres Memory
                  </span>
                  <span className="text-black text-xs font-semibold block mt-1">
                    Uses PostgreSQL to persist conversation state. Requires session_id when executing tasks.
                  </span>
                </div>
              </label>
              {enableShortTermPostgres && (
                <div className="mt-3 bg-[#90EE90] border-2 border-black p-2">
                  <p className="text-black text-xs font-bold">
                    ✅ Short-term postgres memory enabled. Make sure to provide a session_id when executing tasks to maintain conversation context.
                  </p>
                </div>
              )}
            </div>
          </div>

          <NeoInput
            label="Tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="assistant, research, production"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeoInput
              label="Max Iterations"
              type="number"
              value={maxIterations}
              onChange={(e) => setMaxIterations(parseInt(e.target.value))}
              min="1"
              max="6"
            />
            <NeoInput
              label="Timeout (seconds)"
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
              placeholder="Optional"
              step="0.1"
            />
          </div>

          {error && (
            <div className="neo-card-colored bg-[#FFB6C1] mt-4">
              <p className="font-bold text-black">❌ Error: {error}</p>
            </div>
          )}

          {success && (
            <div className="neo-card-colored bg-[#90EE90] mt-4">
              <p className="font-bold text-black">✅ Agent created successfully! Redirecting...</p>
            </div>
          )}

          <div className="mt-6">
            <NeoButton
              type="submit"
              variant="success"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Agent'}
            </NeoButton>
          </div>
        </form>
      </div>
    </div>
  );
}


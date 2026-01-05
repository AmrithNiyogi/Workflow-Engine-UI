'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import AgentCard from '@/components/AgentCard';
import NeoButton from '@/components/NeoButton';
import NeoInput from '@/components/NeoInput';
import NeoTextarea from '@/components/NeoTextarea';
import NeoSelect from '@/components/NeoSelect';
import { listAgents, deleteAgent, updateAgent, listTools } from '@/lib/api';
import { FRAMEWORKS, CAPABILITIES, STATUS_OPTIONS } from '@/lib/constants';

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAgent, setEditingAgent] = useState(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editFramework, setEditFramework] = useState('');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editTemperature, setEditTemperature] = useState(0.7);
  const [editMaxTokens, setEditMaxTokens] = useState('');
  const [editCapabilities, setEditCapabilities] = useState([]);
  const [editTools, setEditTools] = useState([]);
  const [editToolConfigs, setEditToolConfigs] = useState({}); // { toolName: { propertyName: value } }
  const [editTags, setEditTags] = useState('');
  const [editMaxIterations, setEditMaxIterations] = useState(10);
  const [editStatus, setEditStatus] = useState('draft');
  const [editOwner, setEditOwner] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [filterActive, setFilterActive] = useState(null); // null = all, true = active only
  const [availableTools, setAvailableTools] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, [filterActive]);

  // Fetch available tools on mount
  useEffect(() => {
    const fetchTools = async () => {
      setToolsLoading(true);
      const { data, error } = await listTools(0, 100);
      if (!error && data?.tools) {
        setAvailableTools(data.tools);
      }
      setToolsLoading(false);
    };
    fetchTools();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await listAgents(0, 100, null, null, filterActive);
    
    if (apiError) {
      setError(apiError);
    } else {
      setAgents(data?.agents || []);
    }
    setLoading(false);
  };

  const handleEdit = (agent) => {
    setEditingAgent(agent);
    setEditName(agent.name || '');
    setEditFramework(agent.framework || 'langchain');
    setEditSystemPrompt(agent.system_prompt || '');
    setEditDescription(agent.description || '');
    setEditModel(agent.llm_config?.model || '');
    setEditTemperature(agent.llm_config?.temperature || 0.7);
    setEditMaxTokens(agent.llm_config?.max_tokens?.toString() || '');
    setEditCapabilities(agent.capabilities || []);
    
    // Parse tools - can be strings or objects with name and config
    const tools = agent.tools || [];
    const toolNames = tools.map(t => typeof t === 'string' ? t : t.name);
    const toolConfigs = {};
    tools.forEach(t => {
      if (typeof t === 'object' && t.name && t.config) {
        toolConfigs[t.name] = t.config;
      }
    });
    
    setEditTools(toolNames);
    setEditToolConfigs(toolConfigs);
    setEditTags(agent.tags?.join(', ') || '');
    setEditMaxIterations(agent.max_iterations || 10);
    setEditStatus(agent.status || 'draft');
    setEditOwner(agent.owner || '');
    setEditCategory(agent.category || '');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    // Build tools array - strings for tools without properties, objects for tools with properties
    const allTools = editTools.map(toolName => {
      const toolConfig = editToolConfigs[toolName];
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

    const updateData = {
      name: editName,
      framework: editFramework,
      system_prompt: editSystemPrompt,
      description: editDescription || null,
      llm_config: {
        model: editModel,
        temperature: editTemperature,
        max_tokens: editMaxTokens ? parseInt(editMaxTokens) : null,
      },
      capabilities: editCapabilities,
      tools: allTools,
      tags: editTags ? editTags.split(',').map(t => t.trim()).filter(t => t) : [],
      max_iterations: editMaxIterations,
      status: editStatus,
      owner: editOwner,
      category: editCategory,
    };

    const { error: apiError } = await updateAgent(editingAgent.id, updateData);

    setSaving(false);

    if (apiError) {
      setError(apiError);
    } else {
      setEditingAgent(null);
      loadAgents();
    }
  };

  const handleDelete = async (agentId) => {
    const { error: apiError } = await deleteAgent(agentId);
    
    if (apiError) {
      setError(apiError);
    } else {
      loadAgents();
    }
  };

  const handleExecute = (agent) => {
    router.push(`/execute?agentId=${agent.id}`);
  };

  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#87CEEB] mb-6 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-4xl font-black text-black">Agent List</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="font-bold text-black">Filter:</label>
              <select
                value={filterActive === null ? 'all' : filterActive ? 'active' : 'inactive'}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterActive(value === 'all' ? null : value === 'active');
                }}
                className="px-4 py-2 border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none focus:ring-4 focus:ring-[#87CEEB]"
              >
                <option value="all">All Agents</option>
                <option value="active">Active Only</option>
              </select>
            </div>
            <NeoButton variant="primary" onClick={loadAgents} disabled={loading}>
              {loading ? 'Loading...' : '🔄 Refresh'}
            </NeoButton>
          </div>
        </div>

        {error && (
          <div className="neo-card-colored bg-[#FFB6C1] mb-6">
            <p className="font-bold text-black">❌ Error: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="neo-card">
            <p className="font-bold text-black text-center">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="neo-card">
            <p className="font-bold text-black text-center">No agents found. Create your first agent!</p>
          </div>
        ) : (
          <>
            <div className="neo-card-colored bg-[#90EE90] mb-6">
              <p className="font-bold text-black text-xl">Found {agents.length} agent(s)</p>
            </div>

            {agents.map((agent) => (
              <div key={agent.id}>
                <AgentCard
                  agent={agent}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onExecute={handleExecute}
                />
                
                {editingAgent && editingAgent.id === agent.id && (
                  <div className="neo-card-colored bg-[#FFD700] mt-4">
                    <div className="flex justify-between items-center mb-4 border-b-4 border-black pb-2">
                      <h2 className="text-3xl font-black text-black">
                        Edit Agent: {editingAgent.name}
                      </h2>
                      <NeoButton
                        type="button"
                        variant="danger"
                        onClick={() => setEditingAgent(null)}
                        className="text-sm"
                      >
                        ✕ Close
                      </NeoButton>
                    </div>

                    <form onSubmit={handleSave} className="max-h-[80vh] overflow-y-auto pr-2">
                      <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <NeoInput
                          label="Agent Name"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          required
                        />
                        <NeoSelect
                          label="Framework"
                          value={editFramework}
                          onChange={(e) => setEditFramework(e.target.value)}
                          options={FRAMEWORKS.map(f => ({ value: f, label: f }))}
                          required
                        />
                      </div>

                      <NeoTextarea
                        label="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                      />

                      <NeoTextarea
                        label="System Prompt"
                        value={editSystemPrompt}
                        onChange={(e) => setEditSystemPrompt(e.target.value)}
                        required
                        rows={4}
                      />

                      <h3 className="text-xl font-black text-black mt-6 mb-4 border-b-4 border-black pb-2">
                        LLM Configuration
                      </h3>
                      <p className="text-black font-semibold mb-4 text-sm">
                        Note: Provider, Base URL, and API Key are automatically configured from environment variables.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NeoInput
                          label="Model"
                          value={editModel}
                          onChange={(e) => setEditModel(e.target.value)}
                          required
                        />
                        <div>
                          <label className="block font-bold text-black mb-2">
                            Temperature: {editTemperature}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={editTemperature}
                            onChange={(e) => setEditTemperature(parseFloat(e.target.value))}
                            className="w-full border-4 border-black"
                          />
                        </div>
                      </div>

                      <NeoInput
                        label="Max Tokens"
                        type="number"
                        value={editMaxTokens}
                        onChange={(e) => setEditMaxTokens(e.target.value)}
                      />

                      <div className="mb-4 mt-6">
                        <label className="block font-bold text-black mb-2">Capabilities</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          {CAPABILITIES.map((cap) => (
                            <label key={cap} className="flex items-center border-4 border-black p-2 bg-white cursor-pointer hover:bg-[#90EE90]">
                              <input
                                type="checkbox"
                                checked={editCapabilities.includes(cap)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditCapabilities([...editCapabilities, cap]);
                                  } else {
                                    setEditCapabilities(editCapabilities.filter(c => c !== cap));
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
                        <label className="block font-bold text-black mb-2">Tools</label>
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
                              <label key={tool.name} className="flex items-start border-4 border-black p-3 bg-white cursor-pointer hover:bg-[#FFC0CB]">
                                <input
                                  type="checkbox"
                                  checked={editTools.includes(tool.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditTools([...editTools, tool.name]);
                                      // Initialize empty config for tools with properties
                                      if (tool.properties && Object.keys(tool.properties).length > 0) {
                                        setEditToolConfigs(prev => ({
                                          ...prev,
                                          [tool.name]: {}
                                        }));
                                      }
                                    } else {
                                      setEditTools(editTools.filter(t => t !== tool.name));
                                      setEditToolConfigs(prev => {
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
                      {editTools.filter(toolName => {
                        const tool = availableTools.find(t => t.name === toolName);
                        return tool && tool.properties && Object.keys(tool.properties).length > 0;
                      }).length > 0 && (
                        <div className="mb-4 mt-6">
                          <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                            Tool Configuration
                          </h3>
                          {editTools.map(toolName => {
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
                                    const currentValue = editToolConfigs[toolName]?.[propName] || '';
                                    
                                    return (
                                      <div key={propName}>
                                        {propType === 'password' ? (
                                          <NeoInput
                                            label={propName}
                                            type="password"
                                            value={currentValue}
                                            onChange={(e) => {
                                              setEditToolConfigs(prev => ({
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
                                              setEditToolConfigs(prev => ({
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

                      <h3 className="text-xl font-black text-black mt-6 mb-4 border-b-4 border-black pb-2">
                        Agent Metadata
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <NeoSelect
                          label="Status"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
                        />
                        <NeoInput
                          label="Owner"
                          value={editOwner}
                          onChange={(e) => setEditOwner(e.target.value)}
                          required
                        />
                        <NeoInput
                          label="Category"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          required
                        />
                      </div>

                      <NeoInput
                        label="Tags (comma-separated)"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                      />

                      <NeoInput
                        label="Max Iterations"
                        type="number"
                        value={editMaxIterations}
                        onChange={(e) => setEditMaxIterations(parseInt(e.target.value))}
                        min="1"
                      />

                      <div className="flex gap-4 mt-6">
                        <NeoButton type="submit" variant="success" disabled={saving}>
                          {saving ? 'Saving...' : '💾 Save Changes'}
                        </NeoButton>
                        <NeoButton
                          type="button"
                          variant="danger"
                          onClick={() => setEditingAgent(null)}
                        >
                          Cancel
                        </NeoButton>
                      </div>
                    </form>
                </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}


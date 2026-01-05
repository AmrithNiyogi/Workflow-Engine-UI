'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import NeoButton from '@/components/NeoButton';
import NeoInput from '@/components/NeoInput';
import NeoTextarea from '@/components/NeoTextarea';
import NeoSelect from '@/components/NeoSelect';
import { listComponents, createComponent, updateComponent, deleteComponent, executeComponent, listAgents } from '@/lib/api';
import { COMPONENT_TYPES, HTTP_METHODS, FRAMEWORKS } from '@/lib/constants';

export default function ComponentsPage() {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingComponent, setEditingComponent] = useState(null);
  const [executingComponent, setExecutingComponent] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [agents, setAgents] = useState([]);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState('');

  // Create form state
  const [createType, setCreateType] = useState('init');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createOutputType, setCreateOutputType] = useState('');
  
  // INIT component inputs
  const [createInitInputs, setCreateInitInputs] = useState([{ name: '', type: 'string', description: '', required: true, values: '' }]);
  
  // API component inputs
  const [createApiUrl, setCreateApiUrl] = useState('');
  const [createApiMethod, setCreateApiMethod] = useState('GET');
  const [createApiHeaders, setCreateApiHeaders] = useState('');
  const [createApiQueryParams, setCreateApiQueryParams] = useState('');
  const [createApiBody, setCreateApiBody] = useState('');
  
  // LLM component inputs
  const [createLlmKey, setCreateLlmKey] = useState('');
  const [createLlmModel, setCreateLlmModel] = useState('');
  const [createLlmPromptName, setCreateLlmPromptName] = useState('');
  const [createLlmPromptVars, setCreateLlmPromptVars] = useState('');
  const [createLlmTemperature, setCreateLlmTemperature] = useState(0.7);
  const [createLlmInputs, setCreateLlmInputs] = useState('');
  
  // AGENT component inputs
  const [createAgentId, setCreateAgentId] = useState('');
  const [createAgentFramework, setCreateAgentFramework] = useState('langchain');
  const [createAgentTemperature, setCreateAgentTemperature] = useState(0.7);
  const [createAgentQuery, setCreateAgentQuery] = useState('');

  // Edit form state (similar structure)
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOutputType, setEditOutputType] = useState('');
  const [editInitInputs, setEditInitInputs] = useState([]);
  const [editApiInputs, setEditApiInputs] = useState(null);
  const [editLlmInputs, setEditLlmInputs] = useState(null);
  const [editAgentInputs, setEditAgentInputs] = useState(null);

  // Execute form state
  const [executeInputs, setExecuteInputs] = useState({});

  useEffect(() => {
    loadComponents();
    loadAgents();
  }, []);

  const loadComponents = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await listComponents(0, 100, filterName || null, filterType || null);
    
    if (apiError) {
      setError(apiError);
    } else {
      setComponents(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  const loadAgents = async () => {
    const { data } = await listAgents();
    if (data) {
      setAgents(data?.agents || []);
    }
  };

  useEffect(() => {
    loadComponents();
  }, [filterName, filterType]);

  const handleEdit = (component) => {
    setEditingComponent(component);
    setEditName(component.name || '');
    setEditDescription(component.description || '');
    setEditOutputType(component.output_type || '');
    
    if (component.type === 'init') {
      setEditInitInputs(Array.isArray(component.inputs) ? component.inputs : []);
    } else if (component.type === 'api') {
      setEditApiInputs(component.inputs || {});
    } else if (component.type === 'llm') {
      setEditLlmInputs(component.inputs || {});
    } else if (component.type === 'agent') {
      setEditAgentInputs(component.inputs || {});
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const updateData = {
      name: editName,
      description: editDescription || null,
      output_type: editOutputType || null,
    };

    if (editingComponent.type === 'init') {
      updateData.inputs = editInitInputs;
    } else if (editingComponent.type === 'api') {
      updateData.apiConfig = editApiInputs;
    }

    const { error: apiError } = await updateComponent(editingComponent.id, updateData);

    setSaving(false);

    if (apiError) {
      setError(apiError);
    } else {
      setEditingComponent(null);
      loadComponents();
    }
  };

  const handleDelete = async (componentId) => {
    if (!confirm('Are you sure you want to delete this component?')) {
      return;
    }

    const { error: apiError } = await deleteComponent(componentId);
    
    if (apiError) {
      setError(apiError);
    } else {
      loadComponents();
    }
  };

  const handleExecute = (component) => {
    setExecutingComponent(component);
    setExecuteResult(null);
    
    // Initialize execute inputs based on component type
    if (component.type === 'init' && Array.isArray(component.inputs)) {
      const inputs = {};
      component.inputs.forEach(input => {
        inputs[input.name] = input.values || '';
      });
      setExecuteInputs(inputs);
    } else {
      setExecuteInputs({});
    }
  };

  const handleExecuteSubmit = async (e) => {
    e.preventDefault();
    setExecuting(true);
    setError(null);
    setExecuteResult(null);

    try {
      const { data, error: apiError } = await executeComponent(executingComponent.id, executeInputs);

      setExecuting(false);

      if (apiError) {
        setError(apiError);
      } else {
        setExecuteResult(data);
      }
    } catch (err) {
      setExecuting(false);
      setError(err.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let componentData = {
      name: createName,
      type: createType,
      description: createDescription || null,
      output_type: createOutputType || null,
    };

    try {
      if (createType === 'init') {
        componentData.inputs = createInitInputs.filter(inp => inp.name && inp.type);
      } else if (createType === 'api') {
        componentData.inputs = {
          url: createApiUrl,
          method: createApiMethod,
          headers: createApiHeaders ? JSON.parse(createApiHeaders) : null,
          query_params: createApiQueryParams ? JSON.parse(createApiQueryParams) : null,
          body: createApiBody ? JSON.parse(createApiBody) : null,
        };
      } else if (createType === 'llm') {
        componentData.inputs = {
          llmkey: createLlmKey,
          model_name: createLlmModel,
          prompt: createLlmPromptName ? {
            prompt_name: createLlmPromptName,
            variables: createLlmPromptVars ? JSON.parse(createLlmPromptVars) : null,
          } : null,
          inputs: createLlmInputs ? JSON.parse(createLlmInputs) : null,
          temperature: createLlmTemperature,
        };
      } else if (createType === 'agent') {
        componentData.inputs = {
          agent_id: createAgentId,
          framework: createAgentFramework,
          temperature: createAgentTemperature,
          query: createAgentQuery,
        };
      }

      const { data, error: apiError } = await createComponent(componentData);

      setSaving(false);

      if (apiError) {
        setError(apiError);
      } else {
        // Reset form
        setShowCreateForm(false);
        setCreateName('');
        setCreateDescription('');
        setCreateOutputType('');
        setCreateInitInputs([{ name: '', type: 'string', description: '', required: true, values: '' }]);
        setCreateApiUrl('');
        setCreateApiMethod('GET');
        setCreateApiHeaders('');
        setCreateApiQueryParams('');
        setCreateApiBody('');
        loadComponents();
      }
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Invalid JSON in form fields');
    }
  };

  const addInitInput = () => {
    setCreateInitInputs([...createInitInputs, { name: '', type: 'string', description: '', required: true, values: '' }]);
  };

  const removeInitInput = (index) => {
    setCreateInitInputs(createInitInputs.filter((_, i) => i !== index));
  };

  const updateInitInput = (index, field, value) => {
    const newInputs = [...createInitInputs];
    newInputs[index] = { ...newInputs[index], [field]: value };
    setCreateInitInputs(newInputs);
  };

  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#87CEEB] mb-6 flex justify-between items-center">
          <h1 className="text-4xl font-black text-black">Component List</h1>
          <div className="flex gap-2">
            <NeoButton variant="primary" onClick={loadComponents} disabled={loading}>
              {loading ? 'Loading...' : '🔄 Refresh'}
            </NeoButton>
            <NeoButton variant="success" onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? '✖️ Cancel' : '➕ Create Component'}
            </NeoButton>
          </div>
        </div>

        {error && (
          <div className="neo-card-colored bg-[#FFB6C1] mb-6">
            <p className="font-bold text-black">❌ Error: {error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="neo-card mb-6">
          <h2 className="text-2xl font-black text-black mb-4 border-b-4 border-black pb-2">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeoInput
              label="Filter by Name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Search components..."
            />
            <NeoSelect
              label="Filter by Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                ...COMPONENT_TYPES.map(t => ({ value: t, label: t.toUpperCase() }))
              ]}
            />
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="neo-card-colored bg-[#FFD700] mb-6">
            <h2 className="text-3xl font-black text-black mb-6 border-b-4 border-black pb-2">
              Create New Component
            </h2>

            <form onSubmit={handleCreate}>
              <NeoSelect
                label="Component Type"
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
                options={COMPONENT_TYPES.map(t => ({ value: t, label: t.toUpperCase() }))}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NeoInput
                  label="Component Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
                <NeoInput
                  label="Output Type"
                  value={createOutputType}
                  onChange={(e) => setCreateOutputType(e.target.value)}
                  placeholder="string, integer, json, etc."
                />
              </div>

              <NeoTextarea
                label="Description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={2}
              />

              {/* INIT Component Form */}
              {createType === 'init' && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-black text-black border-b-4 border-black pb-2">
                      Inputs
                    </h3>
                    <NeoButton type="button" variant="success" onClick={addInitInput}>
                      ➕ Add Input
                    </NeoButton>
                  </div>
                  {createInitInputs.map((input, index) => (
                    <div key={index} className="neo-card-colored bg-[#90EE90] mb-4 p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-black">Input {index + 1}</h4>
                        <NeoButton type="button" variant="danger" onClick={() => removeInitInput(index)}>
                          🗑️ Remove
                        </NeoButton>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <NeoInput
                          label="Name"
                          value={input.name}
                          onChange={(e) => updateInitInput(index, 'name', e.target.value)}
                          required
                        />
                        <NeoSelect
                          label="Type"
                          value={input.type}
                          onChange={(e) => updateInitInput(index, 'type', e.target.value)}
                          options={[
                            { value: 'string', label: 'String' },
                            { value: 'integer', label: 'Integer' },
                            { value: 'float', label: 'Float' },
                            { value: 'boolean', label: 'Boolean' },
                            { value: 'list', label: 'List' },
                            { value: 'json', label: 'JSON' },
                          ]}
                          required
                        />
                      </div>
                      <NeoInput
                        label="Description"
                        value={input.description}
                        onChange={(e) => updateInitInput(index, 'description', e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={input.required}
                          onChange={(e) => updateInitInput(index, 'required', e.target.checked)}
                          className="w-4 h-4 border-2 border-black"
                        />
                        <label className="font-bold text-black">Required</label>
                      </div>
                      <NeoInput
                        label="Default Value"
                        value={input.values || ''}
                        onChange={(e) => updateInitInput(index, 'values', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* API Component Form */}
              {createType === 'api' && (
                <div className="mt-6">
                  <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                    API Configuration
                  </h3>
                  <NeoInput
                    label="URL"
                    value={createApiUrl}
                    onChange={(e) => setCreateApiUrl(e.target.value)}
                    required
                  />
                  <NeoSelect
                    label="HTTP Method"
                    value={createApiMethod}
                    onChange={(e) => setCreateApiMethod(e.target.value)}
                    options={HTTP_METHODS.map(m => ({ value: m, label: m }))}
                    required
                  />
                  <NeoTextarea
                    label="Headers (JSON)"
                    value={createApiHeaders}
                    onChange={(e) => setCreateApiHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer token"}'
                    rows={2}
                  />
                  <NeoTextarea
                    label="Query Parameters (JSON)"
                    value={createApiQueryParams}
                    onChange={(e) => setCreateApiQueryParams(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={2}
                  />
                  <NeoTextarea
                    label="Body (JSON)"
                    value={createApiBody}
                    onChange={(e) => setCreateApiBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                  />
                </div>
              )}

              {/* LLM Component Form */}
              {createType === 'llm' && (
                <div className="mt-6">
                  <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                    LLM Configuration
                  </h3>
                  <NeoInput
                    label="LLM Key"
                    value={createLlmKey}
                    onChange={(e) => setCreateLlmKey(e.target.value)}
                    required
                  />
                  <NeoInput
                    label="Model Name"
                    value={createLlmModel}
                    onChange={(e) => setCreateLlmModel(e.target.value)}
                    required
                  />
                  <NeoInput
                    label="Prompt Name"
                    value={createLlmPromptName}
                    onChange={(e) => setCreateLlmPromptName(e.target.value)}
                  />
                  <NeoTextarea
                    label="Prompt Variables (JSON)"
                    value={createLlmPromptVars}
                    onChange={(e) => setCreateLlmPromptVars(e.target.value)}
                    placeholder='{"var1": "value1"}'
                    rows={2}
                  />
                  <NeoTextarea
                    label="Inputs (JSON)"
                    value={createLlmInputs}
                    onChange={(e) => setCreateLlmInputs(e.target.value)}
                    placeholder='{"input": "value"}'
                    rows={2}
                  />
                  <div>
                    <label className="block font-bold text-black mb-2">
                      Temperature: {createLlmTemperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={createLlmTemperature}
                      onChange={(e) => setCreateLlmTemperature(parseFloat(e.target.value))}
                      className="w-full border-4 border-black"
                    />
                  </div>
                </div>
              )}

              {/* AGENT Component Form */}
              {createType === 'agent' && (
                <div className="mt-6">
                  <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                    Agent Configuration
                  </h3>
                  <NeoSelect
                    label="Agent"
                    value={createAgentId}
                    onChange={(e) => setCreateAgentId(e.target.value)}
                    options={[
                      { value: '', label: '-- Select an agent --' },
                      ...agents.map(a => ({ value: a.id, label: `${a.name} (${a.framework})` }))
                    ]}
                    required
                  />
                  <NeoSelect
                    label="Framework"
                    value={createAgentFramework}
                    onChange={(e) => setCreateAgentFramework(e.target.value)}
                    options={FRAMEWORKS.map(f => ({ value: f, label: f }))}
                    required
                  />
                  <NeoTextarea
                    label="Query"
                    value={createAgentQuery}
                    onChange={(e) => setCreateAgentQuery(e.target.value)}
                    required
                    rows={3}
                  />
                  <div>
                    <label className="block font-bold text-black mb-2">
                      Temperature: {createAgentTemperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={createAgentTemperature}
                      onChange={(e) => setCreateAgentTemperature(parseFloat(e.target.value))}
                      className="w-full border-4 border-black"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <NeoButton type="submit" variant="success" disabled={saving}>
                  {saving ? 'Creating...' : '💾 Create Component'}
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="danger"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </NeoButton>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="neo-card">
            <p className="font-bold text-black text-center">Loading components...</p>
          </div>
        ) : components.length === 0 ? (
          <div className="neo-card">
            <p className="font-bold text-black text-center">No components found. Create your first component!</p>
          </div>
        ) : (
          <>
            <div className="neo-card-colored bg-[#90EE90] mb-6">
              <p className="font-bold text-black text-xl">Found {components.length} component(s)</p>
            </div>

            {components.map((component) => (
              <div key={component.id} className="neo-card-colored bg-[#90EE90] mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-black mb-2">
                      🧩 {component.name || 'Unnamed'}
                    </h3>
                    <div className="space-y-1">
                      <p className="font-bold text-black">
                        <span className="text-[#87CEEB]">Type:</span> {component.type}
                      </p>
                      <p className="font-bold text-black">
                        <span className="text-[#87CEEB]">Slug:</span> {component.slug}
                      </p>
                      {component.description && (
                        <p className="font-bold text-black">
                          <span className="text-[#87CEEB]">Description:</span> {component.description}
                        </p>
                      )}
                      {component.output_type && (
                        <p className="font-bold text-black">
                          <span className="text-[#87CEEB]">Output Type:</span> {component.output_type}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <NeoButton
                      variant="primary"
                      onClick={() => handleEdit(component)}
                      className="text-sm px-4 py-2"
                    >
                      ✏️ Edit
                    </NeoButton>
                    <NeoButton
                      variant="danger"
                      onClick={() => handleDelete(component.id)}
                      className="text-sm px-4 py-2"
                    >
                      🗑️ Delete
                    </NeoButton>
                    <NeoButton
                      variant="warning"
                      onClick={() => handleExecute(component)}
                      className="text-sm px-4 py-2"
                    >
                      ▶️ Execute
                    </NeoButton>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Edit Form */}
        {editingComponent && (
          <div className="neo-card-colored bg-[#FFD700] mt-8">
            <h2 className="text-3xl font-black text-black mb-6 border-b-4 border-black pb-2">
              Edit Component: {editingComponent.name}
            </h2>

            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NeoInput
                  label="Component Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
                <NeoInput
                  label="Output Type"
                  value={editOutputType}
                  onChange={(e) => setEditOutputType(e.target.value)}
                />
              </div>

              <NeoTextarea
                label="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />

              {editingComponent.type === 'init' && (
                <div className="mt-6">
                  <h3 className="text-xl font-black text-black mb-4 border-b-4 border-black pb-2">
                    Inputs
                  </h3>
                  <p className="text-black font-semibold mb-4 text-sm">
                    Note: Input editing for INIT components is limited. Full editing may require recreating the component.
                  </p>
                  <div className="bg-[#FFF8DC] border-4 border-black p-4">
                    <pre className="text-xs overflow-auto text-black">
                      {JSON.stringify(editInitInputs, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <NeoButton type="submit" variant="success" disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="danger"
                  onClick={() => setEditingComponent(null)}
                >
                  Cancel
                </NeoButton>
              </div>
            </form>
          </div>
        )}

        {/* Execute Modal */}
        {executingComponent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="neo-card-colored bg-[#87CEEB] max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b-4 border-black pb-2">
                <h3 className="text-2xl font-black text-black">
                  ▶️ Execute: {executingComponent.name}
                </h3>
                <button
                  onClick={() => {
                    setExecutingComponent(null);
                    setExecuteResult(null);
                    setExecuteInputs({});
                  }}
                  className="text-2xl font-black text-black hover:text-red-600"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleExecuteSubmit}>
                {executingComponent.type === 'init' && Array.isArray(executingComponent.inputs) && (
                  <div className="mb-4">
                    <h4 className="text-xl font-black text-black mb-4">Input Values</h4>
                    {executingComponent.inputs.map((input, index) => (
                      <NeoInput
                        key={index}
                        label={`${input.name} (${input.type})${input.required ? ' *' : ''}`}
                        value={executeInputs[input.name] || ''}
                        onChange={(e) => setExecuteInputs({ ...executeInputs, [input.name]: e.target.value })}
                        required={input.required}
                        placeholder={input.description || `Enter ${input.name}`}
                      />
                    ))}
                  </div>
                )}

                {executingComponent.type !== 'init' && (
                  <div className="mb-4">
                    <p className="font-bold text-black mb-2">
                      This component type ({executingComponent.type}) uses its stored configuration.
                      No additional inputs required.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="neo-card-colored bg-[#FFB6C1] mb-4">
                    <p className="font-bold text-black">❌ Error: {error}</p>
                  </div>
                )}

                {executeResult && (
                  <div className="neo-card-colored bg-[#90EE90] mb-4">
                    <h4 className="text-xl font-black text-black mb-2">✅ Execution Result:</h4>
                    <div className="bg-[#FFF8DC] border-4 border-black p-4">
                      <pre className="text-xs overflow-auto text-black">
                        {JSON.stringify(executeResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <NeoButton type="submit" variant="success" disabled={executing}>
                    {executing ? 'Executing...' : '▶️ Execute'}
                  </NeoButton>
                  <NeoButton
                    type="button"
                    variant="danger"
                    onClick={() => {
                      setExecutingComponent(null);
                      setExecuteResult(null);
                      setExecuteInputs({});
                    }}
                  >
                    Close
                  </NeoButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

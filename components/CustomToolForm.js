'use client';

import { useState, useEffect } from 'react';
import NeoInput from './NeoInput';
import NeoTextarea from './NeoTextarea';
import NeoSelect from './NeoSelect';
import NeoButton from './NeoButton';
import { testCustomTool } from '@/lib/api';
import { HTTP_METHODS } from '@/lib/constants';

export default function CustomToolForm({ onAddTool, customTools: propCustomTools = [], mcpServers = {} }) {
  const [customTools, setCustomTools] = useState(propCustomTools);
  const [toolName, setToolName] = useState('');
  const [toolDesc, setToolDesc] = useState('');
  const [toolUrl, setToolUrl] = useState('');
  const [toolMethod, setToolMethod] = useState('GET');
  const [toolHeaders, setToolHeaders] = useState('{}');
  const [toolBody, setToolBody] = useState('{}');
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Sync with parent prop
  useEffect(() => {
    setCustomTools(propCustomTools);
  }, [propCustomTools]);

  const handleTest = async () => {
    if (!toolName || !toolUrl) {
      alert('Tool name and URL are required!');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const headers = JSON.parse(toolHeaders || '{}');
      const body = JSON.parse(toolBody || '{}');

      const testPayload = {
        name: toolName,
        description: toolDesc || `Custom API tool: ${toolName}`,
        base_url: toolUrl,
        method: toolMethod,
        headers,
        body,
        test_input: testInput || null,
      };

      const { data, error } = await testCustomTool(testPayload);

      if (error) {
        setTestResult({ success: false, error });
      } else {
        setTestResult(data);
      }
    } catch (e) {
      setTestResult({ success: false, error: `Invalid JSON: ${e.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleAdd = () => {
    if (!toolName || !toolUrl) {
      alert('Tool name and URL are required!');
      return;
    }

    try {
      const headers = JSON.parse(toolHeaders || '{}');
      const body = JSON.parse(toolBody || '{}');

      const customTool = {
        name: `custom_api_${toolName}`,
        description: toolDesc || `Custom API tool: ${toolName}`,
        type: 'api',
        config: {
          base_url: toolUrl,
          method: toolMethod,
          headers,
          body,
        },
      };

      const newTools = [...customTools, customTool];
      setCustomTools(newTools);
      
      if (onAddTool) {
        onAddTool(customTool, newTools);
      }
      
      // Reset form
      setToolName('');
      setToolDesc('');
      setToolUrl('');
      setToolMethod('GET');
      setToolHeaders('{}');
      setToolBody('{}');
      setTestInput('');
      setTestResult(null);
      setShowForm(false);
    } catch (e) {
      alert(`Invalid JSON: ${e.message}`);
    }
  };

  const handleRemove = (index) => {
    const newTools = customTools.filter((_, i) => i !== index);
    setCustomTools(newTools);
    if (onAddTool) {
      onAddTool(null, newTools);
    }
  };

  const hasMcpServers = Object.keys(mcpServers).length > 0;

  return (
    <div className="mb-6">
      <div className="neo-card-colored bg-[#90EE90] mb-4">
        <h3 className="text-2xl font-black text-black mb-4">Custom API Tools</h3>
        {hasMcpServers && (
          <div className="bg-[#FFD700] border-4 border-black p-3 mb-4">
            <p className="font-bold text-black text-sm">
              ⚠️ MCP servers are configured. Custom API tools will be ignored. Only MCP tools will be used.
            </p>
          </div>
        )}
        
        {customTools.length > 0 && (
          <div className="mb-4">
            <p className="font-bold text-black mb-2">Added Tools ({customTools.length}):</p>
            {customTools.map((tool, idx) => (
              <div key={idx} className="bg-[#FFF8DC] border-4 border-black p-3 mb-2 flex justify-between items-center">
                <span className="font-bold text-black">
                  {tool.name} ({tool.config.method} {tool.config.base_url})
                </span>
                <NeoButton
                  variant="danger"
                  onClick={() => handleRemove(idx)}
                  className="text-sm px-3 py-1"
                >
                  Remove
                </NeoButton>
              </div>
            ))}
          </div>
        )}

        <NeoButton
          variant="primary"
          onClick={() => setShowForm(!showForm)}
          className="mb-4"
          disabled={hasMcpServers}
        >
          {showForm ? '− Hide Form' : '+ Add Custom API Tool'}
        </NeoButton>

        {showForm && !hasMcpServers && (
          <div className="bg-[#FFF8DC] border-4 border-black p-4 mt-4">
            <NeoInput
              label="Tool Name"
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="my_api_tool"
              required
            />
            <NeoTextarea
              label="Tool Description"
              value={toolDesc}
              onChange={(e) => setToolDesc(e.target.value)}
              placeholder="Description of what this API tool does"
            />
            <NeoInput
              label="API Base URL"
              value={toolUrl}
              onChange={(e) => setToolUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              required
            />
            <NeoSelect
              label="HTTP Method"
              value={toolMethod}
              onChange={(e) => setToolMethod(e.target.value)}
              options={HTTP_METHODS.map(m => ({ value: m, label: m }))}
            />
            <NeoTextarea
              label="Headers (JSON)"
              value={toolHeaders}
              onChange={(e) => setToolHeaders(e.target.value)}
              placeholder='{"Content-Type": "application/json"}'
              rows={3}
            />
            <NeoTextarea
              label="Request Body (JSON)"
              value={toolBody}
              onChange={(e) => setToolBody(e.target.value)}
              placeholder='{"key": "value"}'
              rows={3}
            />
            <NeoInput
              label="Test Input (Optional)"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder='{"key": "value"} or plain text'
            />

            <div className="flex gap-4 mt-4">
              <NeoButton
                variant="warning"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? 'Testing...' : '🧪 Test Tool'}
              </NeoButton>
              <NeoButton
                variant="success"
                onClick={handleAdd}
              >
                Add Custom Tool
              </NeoButton>
            </div>

            {testResult && (
              <div className={`mt-4 p-4 border-4 border-black ${
                testResult.success ? 'bg-[#90EE90]' : 'bg-[#FFB6C1]'
              }`}>
                <p className="font-bold text-black mb-2">
                  {testResult.success ? '✅ Test Successful!' : '❌ Test Failed'}
                </p>
                {testResult.error && (
                  <p className="text-black font-semibold">{testResult.error}</p>
                )}
                {testResult.response_data && (
                  <details className="mt-2">
                    <summary className="font-bold text-black cursor-pointer">View Response</summary>
                    <pre className="mt-2 p-2 bg-[#FFF8DC] border-2 border-black text-xs overflow-auto text-black">
                      {JSON.stringify(testResult.response_data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

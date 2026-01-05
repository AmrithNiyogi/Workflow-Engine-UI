'use client';

import { useState, useEffect } from 'react';
import NeoInput from './NeoInput';
import NeoSelect from './NeoSelect';
import NeoButton from './NeoButton';
import { listMcpTools } from '@/lib/api';

const TRANSPORT_OPTIONS = [
  { value: 'sse', label: 'SSE (Server-Sent Events)' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'stdio', label: 'STDIO' },
];

export default function MCPServerForm({ onAddServer, mcpServers: propMcpServers = {} }) {
  const [mcpServers, setMcpServers] = useState(propMcpServers);
  const [serverTools, setServerTools] = useState({}); // Store tools for each server
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverTransport, setServerTransport] = useState('sse');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync with parent prop
  useEffect(() => {
    setMcpServers(propMcpServers);
  }, [propMcpServers]);

  const handleAdd = async () => {
    if (!serverName || !serverUrl) {
      alert('Server name and URL are required!');
      return;
    }

    // Validate URL format
    try {
      new URL(serverUrl);
    } catch (e) {
      alert('Invalid URL format. Please enter a valid URL (e.g., http://localhost:8001/sse)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch tools from MCP server
      const { data, error: apiError } = await listMcpTools({
        server_name: serverName,
        transport: serverTransport,
        url: serverUrl,
      });

      if (apiError) {
        setError(apiError);
        return;
      }

      if (!data || !data.success) {
        setError(data?.error || 'Failed to fetch tools from MCP server');
        return;
      }

      // Store the tools for this server
      const tools = data.tools || [];
      setServerTools({
        ...serverTools,
        [serverName]: tools,
      });

      const newServer = {
        transport: serverTransport,
        url: serverUrl,
      };

      const newServers = {
        ...mcpServers,
        [serverName]: newServer,
      };

      setMcpServers(newServers);
      
      if (onAddServer) {
        onAddServer(newServers);
      }
      
      // Reset form
      setServerName('');
      setServerUrl('');
      setServerTransport('sse');
      setShowForm(false);
      setError(null);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (serverNameToRemove) => {
    const newServers = { ...mcpServers };
    delete newServers[serverNameToRemove];
    setMcpServers(newServers);
    
    // Remove tools for this server
    const newServerTools = { ...serverTools };
    delete newServerTools[serverNameToRemove];
    setServerTools(newServerTools);
    
    if (onAddServer) {
      onAddServer(newServers);
    }
  };

  const serverEntries = Object.entries(mcpServers);

  return (
    <div className="mb-6">
      <div className="neo-card-colored bg-[#87CEEB] mb-4">
        <h3 className="text-2xl font-black text-black mb-4">MCP Servers</h3>
        <p className="text-black font-semibold mb-4 text-sm">
          MCP (Model Context Protocol) servers provide tools to your agent. When MCP servers are configured, 
          only MCP tools will be used (basic and custom tools will be ignored).
        </p>
        
        {serverEntries.length > 0 && (
          <div className="mb-4">
            <p className="font-bold text-black mb-2">Added MCP Servers ({serverEntries.length}):</p>
            {serverEntries.map(([name, config]) => {
              const tools = serverTools[name] || [];
              return (
                <div key={name} className="bg-[#FFF8DC] border-4 border-black p-3 mb-2">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="font-bold text-black">{name}</span>
                      <span className="text-black ml-2 text-sm">
                        ({config.transport} - {config.url})
                      </span>
                    </div>
                    <NeoButton
                      variant="danger"
                      onClick={() => handleRemove(name)}
                      className="text-sm px-3 py-1"
                    >
                      Remove
                    </NeoButton>
                  </div>
                  {tools.length > 0 ? (
                    <div className="mt-2">
                      <p className="font-semibold text-black text-sm mb-1">
                        Available Tools ({tools.length}):
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {tools.map((tool, idx) => (
                          <div key={idx} className="bg-white border-2 border-black p-2">
                            <p className="font-bold text-black text-xs">{tool.name}</p>
                            {tool.description && (
                              <p className="text-black text-xs mt-1 opacity-80">
                                {tool.description}
                              </p>
                            )}
                            {tool.parameters && Object.keys(tool.parameters).length > 0 && (
                              <details className="mt-1">
                                <summary className="text-xs font-semibold text-black cursor-pointer">
                                  Parameters
                                </summary>
                                <ul className="text-xs text-black mt-1 ml-2">
                                  {Object.entries(tool.parameters).map(([paramName, paramInfo]) => (
                                    <li key={paramName}>
                                      <span className="font-semibold">{paramName}</span>
                                      {paramInfo.description && (
                                        <span className="opacity-80">: {paramInfo.description}</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-black text-xs mt-2 opacity-60">
                      No tools found or tools not yet loaded
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <NeoButton
          variant="primary"
          onClick={() => setShowForm(!showForm)}
          className="mb-4"
        >
          {showForm ? '− Hide Form' : '+ Add MCP Server'}
        </NeoButton>

        {showForm && (
          <div className="bg-[#FFF8DC] border-4 border-black p-4 mt-4">
            <NeoInput
              label="Server Name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="math"
              required
              help="A unique name for this MCP server (e.g., 'math', 'filesystem', 'database')"
            />
            <NeoInput
              label="Server URL"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:8001/sse"
              required
              help="The URL where the MCP server is running"
            />
            <NeoSelect
              label="Transport Type"
              value={serverTransport}
              onChange={(e) => setServerTransport(e.target.value)}
              options={TRANSPORT_OPTIONS}
              help="The transport protocol used by the MCP server"
            />

            {error && (
              <div className="bg-[#FFB6C1] border-4 border-black p-3 mt-4">
                <p className="font-bold text-black text-sm">❌ Error: {error}</p>
              </div>
            )}

            <div className="flex gap-4 mt-4">
              <NeoButton
                variant="success"
                onClick={handleAdd}
                disabled={loading}
              >
                {loading ? 'Loading Tools...' : 'Add MCP Server'}
              </NeoButton>
              <NeoButton
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setServerName('');
                  setServerUrl('');
                  setServerTransport('sse');
                  setError(null);
                }}
                disabled={loading}
              >
                Cancel
              </NeoButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



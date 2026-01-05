import { API_BASE_URL } from './constants';

/**
 * Make API request to backend
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || `HTTP ${response.status}`);
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}

/**
 * List all agents
 */
export async function listAgents(skip = 0, limit = 100, search = null, framework = null, list_active = null) {
  const params = new URLSearchParams({ skip, limit });
  if (search) params.append('search', search);
  if (framework) params.append('framework', framework);
  if (list_active !== null) params.append('list_active', list_active.toString());
  
  return apiRequest(`/api/agents?${params}`);
}

/**
 * Get a single agent by ID
 */
export async function getAgent(agentId) {
  return apiRequest(`/api/agents/${agentId}`);
}

/**
 * Create a new agent
 */
export async function createAgent(agentData) {
  return apiRequest('/api/agents', {
    method: 'POST',
    body: JSON.stringify(agentData),
  });
}

/**
 * Update an agent
 */
export async function updateAgent(agentId, agentData) {
  return apiRequest(`/api/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(agentData),
  });
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId) {
  return apiRequest(`/api/agents/${agentId}`, {
    method: 'DELETE',
  });
}

/**
 * Execute an agent
 */
export async function executeAgent(agentId, executeRequest) {
  // Execute endpoint only accepts task and framework
  const requestBody = {
    task: executeRequest.task,
    framework: executeRequest.framework,
  };
  
  return apiRequest(`/api/agents/${agentId}/execute`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
}

/**
 * Execute an agent with streaming thinking logs (SSE)
 * @param {string} agentId - Agent ID
 * @param {object} executeRequest - Execution request
 * @param {function} onEvent - Callback for each SSE event (event, data)
 * @returns {Promise} Promise that resolves when stream completes
 */
export async function executeAgentWithLogs(agentId, executeRequest, onEvent) {
  const { API_BASE_URL } = await import('./constants');
  
  // Framework is required - fetch agent if not provided
  let framework = executeRequest.framework;
  if (!framework) {
    const { data: agentData } = await getAgent(agentId);
    if (agentData && agentData.framework) {
      framework = agentData.framework;
    } else {
      // Default to langchain if agent has no framework
      framework = 'langchain';
    }
  }
  
  // Build query parameters for execute-with-logs
  const params = new URLSearchParams();
  if (executeRequest.task) params.append('task', executeRequest.task);
  params.append('framework', framework);
  
  const logsUrl = `${API_BASE_URL}/api/agents/${agentId}/execute-with-logs?${params}`;
  
  // Start both endpoints in parallel
  const executePromise = executeAgent(agentId, executeRequest).catch(error => {
    if (onEvent) {
      onEvent('error', { error: error.message });
    }
    throw error;
  });
  
  const logsResponsePromise = fetch(logsUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream',
    },
  });
  
  // Wait for both to start, then process logs stream
  const [executeResult, logsResponse] = await Promise.all([
    executePromise,
    logsResponsePromise
  ]);
  
  // Handle execute response (if needed)
  if (executeResult && executeResult.error) {
    if (onEvent) {
      onEvent('error', { error: executeResult.error });
    }
    throw new Error(executeResult.error);
  }
  
  // Process the logs stream
  try {
    const response = logsResponse;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = 'message';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim();
          continue;
        }
        
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              
              if (onEvent) {
                onEvent(currentEventType, data);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, dataStr);
            }
          }
          // Reset event type after processing data
          currentEventType = 'message';
        }
      }
    }

    return { success: true };
  } catch (error) {
    if (onEvent) {
      onEvent('error', { error: error.message });
    }
    throw error;
  }
}

/**
 * Test a custom API tool
 */
export async function testCustomTool(toolConfig) {
  return apiRequest('/api/agents/test-custom-tool', {
    method: 'POST',
    body: JSON.stringify(toolConfig),
  });
}

/**
 * List tools from an MCP server
 */
export async function listMcpTools(mcpServerConfig) {
  return apiRequest('/api/agents/mcp-tools', {
    method: 'POST',
    body: JSON.stringify(mcpServerConfig),
  });
}

/**
 * Get tool schemas from the API
 * @param {string|null} framework - Optional framework filter (e.g., 'langchain', 'ollama', 'crewai')
 * @returns {Promise<{data: Array, error: string|null}>} Tool schemas or error
 */
export async function getToolSchemas(framework = null) {
  const params = new URLSearchParams();
  if (framework) {
    params.append('framework', framework);
  }
  
  const endpoint = `/api/agents/tool-schemas${params.toString() ? `?${params}` : ''}`;
  return apiRequest(endpoint);
}

/**
 * List all available tools
 * @param {number} skip - Number of tools to skip (pagination)
 * @param {number} limit - Maximum number of tools to return
 * @param {string|Array<string>|null} toolType - Optional tool type filter
 * @returns {Promise<{data: Object, error: string|null}>} Tools list or error
 */
export async function listTools(skip = 0, limit = 100, toolType = null) {
  const params = new URLSearchParams({ skip: skip.toString(), limit: limit.toString() });
  if (toolType) {
    if (Array.isArray(toolType)) {
      toolType.forEach(type => params.append('tool_type', type));
    } else {
      params.append('tool_type', toolType);
    }
  }
  
  return apiRequest(`/api/agents/tools?${params}`);
}

/**
 * List all workflows
 */
export async function listWorkflows(skip = 0, limit = 100, search = null, pattern = null) {
  const params = new URLSearchParams({ skip, limit });
  if (search) params.append('search', search);
  if (pattern) params.append('pattern', pattern);
  
  return apiRequest(`/api/workflows?${params}`);
}

/**
 * Get a single workflow by ID
 */
export async function getWorkflow(workflowId) {
  return apiRequest(`/api/workflows/${workflowId}`);
}

/**
 * Create a new workflow
 */
export async function createWorkflow(workflowData) {
  return apiRequest('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflowData),
  });
}

/**
 * Update a workflow
 */
export async function updateWorkflow(workflowId, workflowData) {
  return apiRequest(`/api/workflows/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(workflowData),
  });
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(workflowId) {
  return apiRequest(`/api/workflows/${workflowId}`, {
    method: 'DELETE',
  });
}

/**
 * Create a new execution
 */
export async function createExecution(workflowId, context = {}) {
  return apiRequest('/api/executions', {
    method: 'POST',
    body: JSON.stringify({
      workflow_id: workflowId,
      context: context,
    }),
  });
}

/**
 * Execute a workflow with streaming execution events (SSE)
 * @param {string} workflowId - Workflow ID
 * @param {object} context - Execution context
 * @param {function} onEvent - Callback for each SSE event (event, data)
 * @returns {Promise} Promise that resolves when stream completes
 */
export async function executeWorkflowWithSSE(workflowId, context = {}, onEvent) {
  const { API_BASE_URL } = await import('./constants');
  const url = `${API_BASE_URL}/api/executions/sse`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        context: context,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = 'message';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim();
          continue;
        }
        
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              
              if (onEvent) {
                onEvent(currentEventType, data);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, dataStr);
            }
          }
          // Reset event type after processing data
          currentEventType = 'message';
        }
      }
    }

    return { success: true };
  } catch (error) {
    if (onEvent) {
      onEvent('error', { error: error.message });
    }
    throw error;
  }
}

/**
 * Get a single execution by ID
 */
export async function getExecution(executionId) {
  return apiRequest(`/api/executions/${executionId}`);
}

/**
 * Cancel an execution
 */
export async function cancelExecution(executionId) {
  return apiRequest(`/api/executions/${executionId}/cancel`, {
    method: 'POST',
  });
}

/**
 * List all executions
 */
export async function listExecutions(skip = 0, limit = 100, workflowId = null, status = null) {
  const params = new URLSearchParams({ skip, limit });
  if (workflowId) params.append('workflow_id', workflowId);
  if (status) params.append('status', status);
  
  return apiRequest(`/api/executions?${params}`);
}

/**
 * List all components
 */
export async function listComponents(skip = 0, limit = 100, name = null, type = null) {
  const params = new URLSearchParams({ skip, limit });
  if (name) params.append('name', name);
  if (type) params.append('type', type);
  
  return apiRequest(`/api/components?${params}`);
}

/**
 * Get a single component by ID or slug
 */
export async function getComponent(identifier) {
  return apiRequest(`/api//components/${identifier}`);
}

/**
 * Create a new component
 */
export async function createComponent(componentData) {
  return apiRequest('/api/components', {
    method: 'POST',
    body: JSON.stringify(componentData),
  });
}

/**
 * Update a component
 */
export async function updateComponent(componentId, componentData) {
  return apiRequest(`/api/components/${componentId}`, {
    method: 'PATCH',
    body: JSON.stringify(componentData),
  });
}

/**
 * Delete a component
 */
export async function deleteComponent(componentId) {
  return apiRequest(`/api/components/${componentId}`, {
    method: 'DELETE',
  });
}

/**
 * Execute a component
 */
export async function executeComponent(componentId, inputData = {}) {
  return apiRequest(`/api/components/execute/${componentId}`, {
    method: 'POST',
    body: JSON.stringify(inputData),
  });
}




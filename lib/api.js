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
    
    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // If not JSON, try to get text
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text || `HTTP ${response.status}` };
      }
    }
    
    if (!response.ok) {
      // Provide more detailed error message
      const errorMessage = data.detail || data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
    return { data, error: null };
  } catch (error) {
    // If it's already an Error object, use its message, otherwise convert to string
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { data: null, error: errorMessage };
  }
}

/**
 * List all agents
 */
export async function listAgents(skip = 0, limit = 100, search = null, framework = null) {
  const params = new URLSearchParams({ skip, limit });
  if (search) params.append('search', search);
  if (framework) params.append('framework', framework);
  
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
  // Build request body with required and optional fields
  const requestBody = {
    task: executeRequest.task,
    framework: executeRequest.framework,
  };
  
  // Add session_id if it exists in the request (even if null, include it)
  if ('session_id' in executeRequest) {
    requestBody.session_id = executeRequest.session_id;
  }
  
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
  
  // Build query parameters
  const params = new URLSearchParams();
  params.append('task', executeRequest.task || '');
  params.append('framework', framework);
  if (executeRequest.parameters && Object.keys(executeRequest.parameters).length > 0) {
    params.append('parameters', JSON.stringify(executeRequest.parameters));
  }
  if (executeRequest.context && Object.keys(executeRequest.context).length > 0) {
    params.append('context', JSON.stringify(executeRequest.context));
  }
  // Include session_id if it exists in the request (even if null)
  if ('session_id' in executeRequest) {
    params.append('session_id', executeRequest.session_id || '');
  }
  
  const url = `${API_BASE_URL}/api/agents/${agentId}/execute-with-logs?${params.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
      },
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
 * Test a custom API tool
 */
export async function testCustomTool(toolConfig) {
  return apiRequest('/api/agents/test-custom-tool', {
    method: 'POST',
    body: JSON.stringify(toolConfig),
  });
}

/**
 * List all available tools
 */
export async function listTools(skip = 0, limit = 100) {
  const params = new URLSearchParams({ skip, limit });
  return apiRequest(`/api/agents/tools?${params}`);
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

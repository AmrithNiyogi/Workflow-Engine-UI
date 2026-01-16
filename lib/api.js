import { API_BASE_URL, getApiPrefix, API_GATEWAY_URL, CLIENT_ID, ENDPOINT } from './constants';

/**
 * Make API request to backend
 */
async function apiRequest(endpoint, options = {}) {
  // Ensure endpoint starts with the correct prefix
  const apiPrefix = getApiPrefix();
  let finalEndpoint = endpoint;
  
  // If endpoint doesn't start with /api, add the prefix
  if (!endpoint.startsWith('/api')) {
    finalEndpoint = `${apiPrefix}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  } else {
    // Replace /api with the correct prefix
    finalEndpoint = endpoint.replace(/^\/api/, apiPrefix);
  }
  
  // Use API_GATEWAY_URL if ENDPOINT is apigateway, otherwise use API_BASE_URL
  const baseUrl = ENDPOINT === 'apigateway' && API_GATEWAY_URL ? API_GATEWAY_URL : API_BASE_URL;
  const url = `${baseUrl}${finalEndpoint}`;
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
      try {
        data = await response.json();
      } catch (jsonError) {
        // If JSON parsing fails, try to get text
        const text = await response.text();
        data = { error: text || `HTTP ${response.status}` };
      }
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
      let errorMessage = data.detail || data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
      
      // Handle FastAPI validation errors
      if (Array.isArray(data.detail)) {
        const validationErrors = data.detail.map(err => {
          if (typeof err === 'object' && err.loc && err.msg) {
            return `${err.loc.join('.')}: ${err.msg}`;
          }
          return String(err);
        }).join('; ');
        errorMessage = validationErrors || errorMessage;
      } else if (data.detail && typeof data.detail === 'object' && data.detail.loc && data.detail.msg) {
        // Single validation error
        errorMessage = `${data.detail.loc.join('.')}: ${data.detail.msg}`;
      }
      
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
  
  // Include session_id if it exists in the request (even if null)
  if ('session_id' in executeRequest) {
    requestBody.session_id = executeRequest.session_id || null;
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
  const { API_BASE_URL, getApiPrefix, CLIENT_ID, ENDPOINT, API_GATEWAY_URL } = await import('./constants');
  const apiPrefix = getApiPrefix();
  
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
  
  // Helper function to parse SSE events
  const parseSSEEvents = async (reader) => {
    console.log('[SSE] Starting to parse SSE events, onEvent callback:', !!onEvent);
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = 'message';
    let eventCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('[SSE] Stream ended, processed', eventCount, 'events');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEventType = line.substring(7).trim();
          console.log('[SSE] Event type line:', currentEventType);
          continue;
        }
        
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr) {
            // Handle non-JSON data (like "Connected" connection messages)
            if (!dataStr.startsWith('{') && !dataStr.startsWith('[')) {
              // Not JSON - might be a plain text message
              if (dataStr === 'Connected' || dataStr.toLowerCase().includes('connect')) {
                console.log('[SSE] Connection established:', dataStr);
                currentEventType = 'message';
                continue;
              }
              // Skip non-JSON data that's not a connection message
              console.warn('[SSE] Skipping non-JSON data:', dataStr);
              currentEventType = 'message';
              continue;
            }
            
            try {
              const data = JSON.parse(dataStr);
              
              // Determine event type:
              // 1. Use event type from 'event:' line if available (standard SSE format)
              // 2. Fall back to data.type if currentEventType is still 'message' (gateway format)
              // 3. For 'action' events, check data.type to distinguish 'action' vs 'action_input'
              let eventType = currentEventType;
              
              // If no event type from 'event:' line, try to get it from data.type
              if (eventType === 'message' && data.type) {
                // Map data.type to event type (thought -> thinking, etc.)
                const typeMap = {
                  'thought': 'thinking',
                  'action': 'action',
                  'action_input': 'action_input',
                  'observation': 'observation',
                  'final_answer': 'final_answer',
                };
                eventType = typeMap[data.type] || data.type;
              }
              
              // If event type is 'action' and data.type is 'action_input', use 'action_input' as event type
              if (eventType === 'action' && data.type === 'action_input') {
                eventType = 'action_input';
              }
              
              // Extract content from various possible fields
              // Standard format: data.content
              // Gateway format: data.answer (for final_answer), data.message, etc.
              const content = data.content || data.answer || data.message || data.thought || data.action || data.observation || '';
              
              // Normalize the data structure - preserve all original fields
              const normalizedData = {
                ...data,
                content: content || data.content,
                // Preserve original fields for debugging and processing
                agent_id: data.agent_id,
                agent_name: data.agent_name,
                timestamp: data.timestamp,
                type: data.type, // Preserve the type field (thought, action, action_input, observation, final_answer)
                metadata: data.metadata, // Preserve metadata (tool, input, step, source, etc.)
              };
              
              eventCount++;
              // Debug logging (can be removed in production)
              console.log('[SSE Event]', {
                eventCount,
                eventType,
                currentEventType,
                dataType: data.type,
                hasContent: !!normalizedData.content,
                contentLength: normalizedData.content?.length || 0,
                hasOnEvent: !!onEvent,
              });
              
              if (onEvent) {
                console.log('[SSE] Calling onEvent callback for:', eventType);
                try {
                  onEvent(eventType, normalizedData);
                } catch (callbackError) {
                  console.error('[SSE] Error in onEvent callback:', callbackError);
                }
              } else {
                console.warn('[SSE] onEvent callback is not available!');
              }
            } catch (e) {
              // Handle non-JSON data gracefully
              if (dataStr === 'Connected' || dataStr.toLowerCase().includes('connect')) {
                console.log('[SSE] Connection message:', dataStr);
              } else {
                console.warn('[SSE] Failed to parse as JSON, skipping:', dataStr, e);
              }
            }
          }
          // Reset event type after processing data (for next event)
          currentEventType = 'message';
        }
      }
    }
    console.log('[SSE] Finished parsing, total events:', eventCount);
  };
  
  try {
    if (ENDPOINT === 'apigateway' && API_GATEWAY_URL && CLIENT_ID) {
      // Gateway mode: First connect to SSE endpoint, then trigger agent execution
      const sseConnectUrl = `${API_GATEWAY_URL}${apiPrefix}/sse/connect?client_id=${CLIENT_ID}`;
      
      console.log('[SSE] Connecting to gateway SSE endpoint:', sseConnectUrl);
      
      // Connect to SSE endpoint
      const sseResponse = await fetch(sseConnectUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
      });
      
      if (!sseResponse.ok) {
        const errorData = await sseResponse.json().catch(() => ({ error: `HTTP ${sseResponse.status}` }));
        throw new Error(errorData.detail || errorData.error || `Failed to connect to SSE endpoint: HTTP ${sseResponse.status}`);
      }
      
      // Close the SSE connect stream - we'll read from execution endpoint instead
      sseResponse.body.getReader().cancel();
      
      // Trigger agent execution (which streams events directly)
      const executeUrl = `${API_GATEWAY_URL}${apiPrefix}/agents/${agentId}/execute-with-logs`;
      
      console.log('[SSE] Triggering agent execution:', executeUrl);
      
      // Build request body
      const requestBody = {
        task: executeRequest.task || '',
        framework: framework,
      };
      
      // Add context if provided
      if (executeRequest.context && Object.keys(executeRequest.context).length > 0) {
        requestBody.context = executeRequest.context;
      }
      
      // Add session_id if provided
      if ('session_id' in executeRequest) {
        requestBody.session_id = executeRequest.session_id || null;
      }
      
      // Add response_format_html if provided
      if ('response_format_html' in executeRequest) {
        requestBody.response_format_html = executeRequest.response_format_html || false;
      }
      
      // Execution endpoint streams events directly - use POST with body
      const executeResponse = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify(requestBody),
      });
      
      if (!executeResponse.ok) {
        const errorData = await executeResponse.json().catch(() => ({ error: `HTTP ${executeResponse.status}` }));
        throw new Error(errorData.detail || errorData.error || `Failed to execute agent: HTTP ${executeResponse.status}`);
      }
      
      // Read SSE stream from execution endpoint
      const reader = executeResponse.body.getReader();
      await parseSSEEvents(reader);
      
      return { success: true };
    } else {
      // Direct mode: Use direct SSE connection to agent execution endpoint
      const url = `${API_BASE_URL}${apiPrefix}/agents/${agentId}/execute-with-logs`;
      
      // Build request body
      const requestBody = {
        task: executeRequest.task || '',
        framework: framework,
      };
      
      // Add context if provided
      if (executeRequest.context && Object.keys(executeRequest.context).length > 0) {
        requestBody.context = executeRequest.context;
      }
      
      // Add session_id if provided
      if ('session_id' in executeRequest) {
        requestBody.session_id = executeRequest.session_id || null;
      }
      
      // Add response_format_html if provided
      if ('response_format_html' in executeRequest) {
        requestBody.response_format_html = executeRequest.response_format_html || false;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      await parseSSEEvents(reader);

      return { success: true };
    }
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
 * Get tool schemas
 */
export async function getToolSchemas(framework = null) {
  const params = new URLSearchParams();
  if (framework) params.append('framework', framework);
  const queryString = params.toString();
  return apiRequest(`/api/agents/tool-schemas${queryString ? `?${queryString}` : ''}`);
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
  const { API_BASE_URL, getApiPrefix, CLIENT_ID, ENDPOINT, API_GATEWAY_URL } = await import('./constants');
  const apiPrefix = getApiPrefix();
  
  // Helper function to parse SSE events
  const parseSSEEvents = async (reader) => {
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
            // Handle non-JSON data (like "Connected" connection messages)
            if (!dataStr.startsWith('{') && !dataStr.startsWith('[')) {
              // Not JSON - might be a plain text message
              if (dataStr === 'Connected' || dataStr.toLowerCase().includes('connect')) {
                console.log('[SSE] Connection established:', dataStr);
                currentEventType = 'message';
                continue;
              }
              // Skip non-JSON data that's not a connection message
              console.warn('[SSE] Skipping non-JSON data:', dataStr);
              currentEventType = 'message';
              continue;
            }
            
            try {
              const data = JSON.parse(dataStr);
              
              // Determine event type:
              // 1. Use event type from 'event:' line if available (standard SSE format)
              // 2. Fall back to data.type if currentEventType is still 'message' (gateway format)
              let eventType = currentEventType;
              
              // If no event type from 'event:' line, try to get it from data.type
              if (eventType === 'message' && data.type) {
                // Map data.type to event type
                const typeMap = {
                  'thought': 'thinking',
                  'action': 'action',
                  'action_input': 'action_input',
                  'observation': 'observation',
                  'final_answer': 'final_answer',
                };
                eventType = typeMap[data.type] || data.type;
              }
              
              // Extract content from various possible fields
              const content = data.content || data.answer || data.message || data.thought || data.action || data.observation || '';
              
              // Normalize the data structure - preserve all original fields
              const normalizedData = {
                ...data,
                content: content || data.content,
                agent_id: data.agent_id,
                agent_name: data.agent_name,
                timestamp: data.timestamp,
                type: data.type,
                metadata: data.metadata,
              };
              
              if (onEvent) {
                onEvent(eventType, normalizedData);
              }
            } catch (e) {
              // Handle non-JSON data gracefully
              if (dataStr === 'Connected' || dataStr.toLowerCase().includes('connect')) {
                console.log('[SSE] Connection message:', dataStr);
              } else {
                console.warn('[SSE] Failed to parse as JSON, skipping:', dataStr, e);
              }
            }
          }
          // Reset event type after processing data (for next event)
          currentEventType = 'message';
        }
      }
    }
  };
  
  try {
    if (ENDPOINT === 'apigateway' && API_GATEWAY_URL && CLIENT_ID) {
      // Gateway mode: First connect to SSE endpoint, then trigger workflow execution
      const sseConnectUrl = `${API_GATEWAY_URL}${apiPrefix}/sse/connect?client_id=${CLIENT_ID}`;
      
      console.log('[SSE] Connecting to gateway SSE endpoint:', sseConnectUrl);
      
      // Connect to SSE endpoint with GET
      const sseResponse = await fetch(sseConnectUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
        },
        credentials: 'include', // Include cookies in the request
      });
      
      if (!sseResponse.ok) {
        const errorData = await sseResponse.json().catch(() => ({ error: `HTTP ${sseResponse.status}` }));
        throw new Error(errorData.detail || errorData.error || `Failed to connect to SSE endpoint: HTTP ${sseResponse.status}`);
      }
      
      // Close the SSE connect stream - we'll read from execution endpoint instead
      sseResponse.body.getReader().cancel();
      
      // Trigger workflow execution (which streams events directly)
      const executeUrl = `${API_GATEWAY_URL}${apiPrefix}/executions/sse`;
      
      console.log('[SSE] Triggering workflow execution:', executeUrl);
      
      // Execution endpoint streams events directly - use POST with body
      const executeResponse = await fetch(executeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify({
          workflow_id: workflowId,
          context: context,
        }),
      });
      
      if (!executeResponse.ok) {
        const errorData = await executeResponse.json().catch(() => ({ error: `HTTP ${executeResponse.status}` }));
        throw new Error(errorData.detail || errorData.error || `Failed to execute workflow: HTTP ${executeResponse.status}`);
      }
      
      // Read SSE stream from execution endpoint
      const reader = executeResponse.body.getReader();
      await parseSSEEvents(reader);
      
      return { success: true };
    } else {
      // Direct mode: Use direct SSE connection to workflow execution endpoint
      const url = `${API_BASE_URL}${apiPrefix}/executions/sse`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies in the request
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
      await parseSSEEvents(reader);

      return { success: true };
    }
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
  return apiRequest(`/api/components/${identifier}`);
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

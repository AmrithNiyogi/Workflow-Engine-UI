// Neo Brutalism Color Palette
export const COLORS = {
  lightGreen: '#90EE90',
  lightBlue: '#87CEEB',
  lightRed: '#FFB6C1',
  lightOrange: '#FFD700',
  lightPink: '#FFC0CB',
  black: '#000000',
  white: '#FFFFFF',
};

// API Configuration
// http://localhost:8000
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8003';
export const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
export const ENDPOINT = process.env.NEXT_PUBLIC_ENDPOINT || '';
export const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || '';

// Get API prefix based on ENDPOINT
export const getApiPrefix = () => {
  return ENDPOINT === 'apigateway' ? '/api/v1' : '/api';
};

// Available frameworks
export const FRAMEWORKS = ['langchain', 'ollama', 'crewai'];

// Available providers (deprecated - now set automatically)
export const PROVIDERS = ['ollama', 'litellm'];

// Available status options
export const STATUS_OPTIONS = ['draft', 'active'];

// Available capabilities
export const CAPABILITIES = [
  'conversation',
  'planning',
  'reflection',
  'memory_short_term',
  'memory_long_term',
  'tool_calling',
  'web_search',
  'document_analysis',
  'code_execution',
  'multi_modal',
];

// Available built-in tools
export const BUILTIN_TOOLS = [
  'calculator',
  'web_search',
  "neo4j_query",
  "message_trimmer"
];

// HTTP Methods
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

// Available component types
export const COMPONENT_TYPES = ['init', 'api', 'llm', 'agent'];

// Available workflow patterns
export const WORKFLOW_PATTERNS = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'parallel', label: 'Parallel' },
  { value: 'graph', label: 'Graph' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'conditional', label: 'Conditional' },
];


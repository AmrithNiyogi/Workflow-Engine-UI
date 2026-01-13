'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import Navigation from '@/components/Navigation';
import AgentNode from '@/components/AgentNode';
import WorkflowSidebar from '@/components/WorkflowSidebar';
import NeoButton from '@/components/NeoButton';
import NeoInput from '@/components/NeoInput';
import NeoTextarea from '@/components/NeoTextarea';
import NeoSelect from '@/components/NeoSelect';
import { listAgents, createWorkflow, updateWorkflow, getWorkflow, createExecution, getExecution, executeWorkflowWithSSE, updateAgent, listTools } from '@/lib/api';
import { WORKFLOW_PATTERNS, FRAMEWORKS, CAPABILITIES } from '@/lib/constants';

const nodeTypes = {
  agent: AgentNode,
};

let id = 0;
const getId = () => `node_${id++}`;

export default function CreateWorkflowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowPattern, setWorkflowPattern] = useState('sequential');
  const [workflowId, setWorkflowId] = useState(null);
  const [executionId, setExecutionId] = useState(null);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [executionResults, setExecutionResults] = useState(null);
  const [enableSSE, setEnableSSE] = useState(true); // Toggle for SSE execution
  const [executionEvents, setExecutionEvents] = useState([]); // Real-time execution events
  const [sessionId, setSessionId] = useState(''); // Session ID for maintaining conversation state
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Agent editing state
  const [editingAgent, setEditingAgent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editFramework, setEditFramework] = useState('langchain');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editTemperature, setEditTemperature] = useState(0.7);
  const [editMaxTokens, setEditMaxTokens] = useState('');
  const [editCapabilities, setEditCapabilities] = useState([]);
  const [editTools, setEditTools] = useState([]);
  const [editToolConfigs, setEditToolConfigs] = useState({});
  const [editEnableShortTermPostgres, setEditEnableShortTermPostgres] = useState(false);
  const [editTags, setEditTags] = useState('');
  const [editMaxIterations, setEditMaxIterations] = useState(5);
  const [editStatus, setEditStatus] = useState('draft');
  const [editOwner, setEditOwner] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [availableTools, setAvailableTools] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  useEffect(() => {
    loadAgents();
    loadTools();
    
    // Load workflow from URL if workflowId is provided
    const workflowIdParam = searchParams.get('workflowId');
    const shouldExecute = searchParams.get('execute') === 'true';
    
    if (workflowIdParam) {
      handleLoadWorkflow(workflowIdParam).then(() => {
        if (shouldExecute) {
          // Wait for state to update, then execute
          setTimeout(async () => {
            // Execute directly with the workflowId since we know it's loaded
            setExecuting(true);
            setError(null);
            setExecutionStatus('pending');
            setExecutionResults(null);
            setExecutionEvents([]);

            const context = {
              session_id: sessionId || null,
            };

            try {
              if (enableSSE) {
                // Use SSE execution
                await executeWorkflowWithSSE(workflowIdParam, context, (eventType, data) => {
                  setExecutionEvents(prev => [...prev, { eventType, data, timestamp: new Date().toISOString() }]);
                  
                  switch (eventType) {
                    case 'workflow_started':
                      setExecutionId(data.execution_id);
                      setExecutionStatus('running');
                      break;
                    case 'workflow_completed':
                      setExecutionStatus('completed');
                      setExecuting(false);
                      if (data.execution_id) {
                        getExecution(data.execution_id).then(({ data: execData }) => {
                          if (execData) {
                            setExecutionResults(execData);
                          }
                        });
                      }
                      break;
                    case 'workflow_failed':
                      setExecutionStatus('failed');
                      setExecuting(false);
                      setError(data.error || 'Workflow execution failed');
                      if (data.execution_id) {
                        getExecution(data.execution_id).then(({ data: execData }) => {
                          if (execData) {
                            setExecutionResults(execData);
                          }
                        });
                      }
                      break;
                    case 'error':
                      setError(data.error || 'An error occurred');
                      setExecuting(false);
                      break;
                  }
                });
              } else {
                // Use regular execution
                const result = await createExecution(workflowIdParam, context);
                
                if (result.error) {
                  setError(result.error);
                  setExecuting(false);
                } else {
                  setExecutionId(result.data.id);
                  setExecutionStatus(result.data.status);
                }
              }
            } catch (err) {
              setError(err.message || 'Failed to execute workflow');
              setExecuting(false);
            }
          }, 1000);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (executionId) {
      const interval = setInterval(async () => {
        const { data, error: apiError } = await getExecution(executionId);
        if (!apiError && data) {
          setExecutionStatus(data.status);
          if (data.results) {
            setExecutionResults(data);
          }
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(interval);
            setExecuting(false);
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [executionId]);

  const loadAgents = async () => {
    setLoading(true);
    const { data, error: apiError } = await listAgents();
    
    if (apiError) {
      setError(apiError);
    } else {
      setAgents(data?.agents || []);
    }
    setLoading(false);
  };

  const loadTools = async () => {
    setToolsLoading(true);
    const { data, error } = await listTools(0, 100);
    if (!error && data) {
      const tools = Array.isArray(data) ? data : (data.tools || data.items || []);
      setAvailableTools(tools);
    }
    setToolsLoading(false);
  };

  // Stable callback functions for node updates
  const handleTaskChange = useCallback((nodeId, task) => {
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              task: task,
            },
          };
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  const handleNodeDelete = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  const handleNodeEdit = useCallback((nodeId, agentId) => {
    const agent = agents.find(a => a.id === agentId);
    
    if (!agent) {
      setError(`Agent with ID ${agentId} not found. Please refresh the agents list.`);
      return;
    }

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
    setEditEnableShortTermPostgres(agent.memory?.short_term?.type === 'short_term_postgres');
    setEditTags(agent.tags?.join(', ') || '');
    setEditMaxIterations(agent.max_iterations || 5);
    setEditStatus(agent.status || 'draft');
    setEditOwner(agent.owner || '');
    setEditCategory(agent.category || '');
  }, [agents]);

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    if (!editingAgent) return;

    setSaving(true);
    setError(null);

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

    // Build memory configuration
    const memory = editEnableShortTermPostgres ? {
      short_term: {
        type: 'short_term_postgres'
      }
    } : undefined;

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
      memory,
      tags: editTags ? editTags.split(',').map(t => t.trim()).filter(t => t) : [],
      max_iterations: editMaxIterations,
      status: editStatus,
      owner: editOwner,
      category: editCategory,
    };

    // Update regular agent
    const { error: apiError } = await updateAgent(editingAgent.id, updateData);

    setSaving(false);

    if (apiError) {
      setError(apiError);
    } else {
      setEditingAgent(null);
      setSuccess('Agent updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      // Reload agents to get updated data
      const { data: agentsData } = await listAgents();
      if (agentsData?.agents) {
        setAgents(agentsData.agents);
        // Update nodes with new agent data
        setNodes((nds) => {
          return nds.map((node) => {
            if (node.data.agentId === editingAgent.id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  agentName: updateData.name,
                  framework: updateData.framework,
                },
              };
            }
            return node;
          });
        });
      }
    }
  };

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(
        {
          ...params,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        },
        eds
      ));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const agentData = JSON.parse(event.dataTransfer.getData('application/reactflow'));

      if (typeof agentData === 'undefined' || !agentData) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type: 'agent',
        position,
        data: {
          agentId: agentData.id,
          agentName: agentData.name,
          framework: agentData.framework,
          task: '',
          onTaskChange: handleTaskChange,
          onDelete: handleNodeDelete,
          onEdit: handleNodeEdit,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handleTaskChange, handleNodeDelete, handleNodeEdit]
  );

  const onDragStart = (event, agent) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(agent));
    event.dataTransfer.effectAllowed = 'move';
  };

  const convertToWorkflowAgents = () => {
    const agentIds = [...new Set(nodes.map(node => node.data.agentId))].filter(id => id);
    
    if (agentIds.length === 0) {
      throw new Error('At least one agent is required in the workflow');
    }
    
    // Build AgentCreateWorkflow objects - need all AgentCreate fields plus agent_id
    const agentsData = agentIds.map(agentId => {
      const agent = agents.find(a => a.id === agentId);
      
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found. Please refresh the agents list.`);
      }

      // Validate required fields
      if (!agent.name || !agent.framework || !agent.system_prompt || !agent.owner || !agent.category) {
        throw new Error(`Agent ${agent.name || agentId} is missing required fields (name, framework, system_prompt, owner, or category)`);
      }

      // Build tools array - strings for tools without properties, objects for tools with properties
      const agentTools = (agent.tools || []).map(tool => {
        if (typeof tool === 'string') {
          return tool;
        } else if (tool && typeof tool === 'object' && tool.name) {
          return {
            name: tool.name,
            config: tool.config || {}
          };
        }
        return tool;
      });

      // Build memory configuration
      const memory = agent.memory || undefined;

      // Build framework_config
      const frameworkConfig = agent.framework_config || {};

      return {
        agent_id: agentId,
        name: agent.name,
        framework: agent.framework,
        system_prompt: agent.system_prompt,
        description: agent.description || null,
        llm_config: {
          model: agent.llm_config?.model || '',
          temperature: agent.llm_config?.temperature ?? 0.7,
          max_tokens: agent.llm_config?.max_tokens || null,
        },
        capabilities: agent.capabilities || ['conversation'],
        tools: agentTools,
        tags: agent.tags || [],
        memory: memory,
        framework_config: frameworkConfig,
        max_iterations: agent.max_iterations || 5,
        timeout: agent.timeout || null,
        status: agent.status || 'draft',
        owner: agent.owner || '',
        category: agent.category || '',
      };
    });

    return agentsData;
  };

  const convertToWorkflowSteps = () => {
    // Create a map of node IDs to step indices
    const nodeIdToStepIndex = {};
    nodes.forEach((node, index) => {
      nodeIdToStepIndex[node.id] = index;
    });

    const steps = nodes.map((node, index) => {
      // Find all edges that point to this node (dependencies)
      const incomingEdges = edges.filter(edge => edge.target === node.id);
      const dependsOn = incomingEdges.map(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        return sourceNode ? nodeIdToStepIndex[sourceNode.id] : null;
      }).filter(index => index !== null)
        .map(index => String(index)); // Convert to strings as backend expects List[str]

      return {
        agent: node.data.agentId,
        task: node.data.task || '',
        depends_on: dependsOn,
        condition: null, // Can be added later for conditional workflows
      };
    });

    return steps;
  };

  const validateWorkflow = () => {
    if (!workflowName.trim()) {
      setError('Workflow name is required');
      return false;
    }

    if (nodes.length === 0) {
      setError('At least one agent node is required');
      return false;
    }

    // Check for nodes without tasks - be more lenient with whitespace
    // Also check if task is undefined, null, empty string, or just whitespace
    const nodesWithoutTasks = nodes.filter(node => {
      const task = node.data?.task;
      // Check if task is missing, null, undefined, empty string, or only whitespace
      if (!task) return true;
      if (typeof task !== 'string') return true;
      if (task.trim().length === 0) return true;
      return false;
    });
    
    if (nodesWithoutTasks.length > 0) {
      const nodeNames = nodesWithoutTasks.map(n => n.data?.agentName || n.id).join(', ');
      setError(`The following agent(s) need a task configured: ${nodeNames}`);
      // Debug: log the nodes to see what's in them
      console.log('Nodes without tasks:', nodesWithoutTasks.map(n => ({
        id: n.id,
        agentName: n.data?.agentName,
        task: n.data?.task,
        hasTask: !!n.data?.task
      })));
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateWorkflow()) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const steps = convertToWorkflowSteps();
      const agentsData = convertToWorkflowAgents();

      // Ensure steps is always a valid array
      const validSteps = Array.isArray(steps) ? steps : [];

      const workflowData = {
      name: workflowName,
      description: workflowDescription || null,
      pattern: workflowPattern,
      agents: agentsData,
      steps: validSteps,
      visual_data: {
        nodes: nodes.map(node => ({
          id: node.id,
          position: node.position,
          type: node.type,
          data: {
            agentId: node.data.agentId,
            agentName: node.data.agentName,
            framework: node.data.framework,
            task: node.data.task,
          },
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        })),
      },
      timeout: null,
      max_retries: workflowId ? 0 : 3,
      error_handling: 'stop',
      };

      let result;
      if (workflowId) {
        result = await updateWorkflow(workflowId, workflowData);
      } else {
        result = await createWorkflow(workflowData);
      }

      if (result.error) {
        setError(result.error);
      } else {
        setWorkflowId(result.data.id);
        setSuccess(`Workflow ${workflowId ? 'updated' : 'created'} successfully!`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!workflowId) {
      // Auto-save if not saved yet
      if (!validateWorkflow()) {
        return;
      }
      
      setSaving(true);
      try {
        const steps = convertToWorkflowSteps();
        const agentsData = convertToWorkflowAgents();

        const workflowData = {
          name: workflowName,
          description: workflowDescription || null,
          pattern: workflowPattern,
          agents: agentsData,
          steps: steps,
          visual_data: {
            nodes: nodes.map(node => ({
              id: node.id,
              position: node.position,
              type: node.type,
              data: {
                agentId: node.data.agentId,
                agentName: node.data.agentName,
                framework: node.data.framework,
                task: node.data.task,
              },
            })),
            edges: edges.map(edge => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
            })),
          },
          timeout: null,
          max_retries: 3,
          error_handling: 'stop',
        };

        const saveResult = await createWorkflow(workflowData);
        setSaving(false);
        
        if (saveResult.error) {
          setError(saveResult.error);
          setSaving(false);
          return;
        }
        
        setWorkflowId(saveResult.data.id);
        setSuccess('Workflow saved! Now executing...');
      } catch (err) {
        setSaving(false);
        setError(err.message || 'Failed to prepare workflow for execution');
        return;
      }
    }

    if (!validateWorkflow()) {
      return;
    }

    setExecuting(true);
    setError(null);
    setExecutionStatus('pending');
    setExecutionResults(null);
    setExecutionEvents([]); // Clear previous events

    // Collect context from nodes (if needed)
    const context = {
      session_id: sessionId || null,
    };

    try {
      if (enableSSE) {
        // Use SSE execution
        await executeWorkflowWithSSE(workflowId, context, (eventType, data) => {
          // Add event to the events list
          setExecutionEvents(prev => [...prev, { eventType, data, timestamp: new Date().toISOString() }]);
          
          // Handle specific events
          switch (eventType) {
            case 'workflow_started':
              setExecutionId(data.execution_id);
              setExecutionStatus('running');
              break;
            case 'step_progress':
              // Update progress in UI
              break;
            case 'agent_starting':
              // Agent is starting
              break;
            case 'agent_completed':
              // Agent completed successfully
              break;
            case 'agent_failed':
              // Agent failed
              break;
            case 'workflow_completed':
              setExecutionStatus('completed');
              setExecuting(false);
              // Fetch full execution results
              if (data.execution_id) {
                getExecution(data.execution_id).then(({ data: execData }) => {
                  if (execData) {
                    setExecutionResults(execData);
                  }
                });
              }
              break;
            case 'workflow_failed':
              setExecutionStatus('failed');
              setExecuting(false);
              setError(data.error || 'Workflow execution failed');
              // Fetch full execution results
              if (data.execution_id) {
                getExecution(data.execution_id).then(({ data: execData }) => {
                  if (execData) {
                    setExecutionResults(execData);
                  }
                });
              }
              break;
            case 'tool_input':
              // Tool input event - already added to executionEvents list above
              break;
            case 'tool_output':
              // Tool output event - already added to executionEvents list above
              break;
            case 'tool_error':
              // Tool error event - already added to executionEvents list above
              break;
            case 'error':
              setError(data.error || 'An error occurred');
              setExecuting(false);
              break;
          }
        });
      } else {
        // Use regular execution
        const result = await createExecution(workflowId, context);
        
        if (result.error) {
          setError(result.error);
          setExecuting(false);
        } else {
          setExecutionId(result.data.id);
          setExecutionStatus(result.data.status);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to execute workflow');
      setExecuting(false);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the workflow? This will remove all nodes and edges.')) {
      setNodes([]);
      setEdges([]);
      setWorkflowId(null);
      setWorkflowName('');
      setWorkflowDescription('');
      setExecutionId(null);
      setExecutionStatus(null);
      setExecutionResults(null);
      setError(null);
      setSuccess(null);
    }
  };

  const handleLoadWorkflow = async (workflowIdToLoad) => {
    setLoading(true);
    setError(null);
    
    const { data, error: apiError } = await getWorkflow(workflowIdToLoad);
    
    if (apiError) {
      setError(apiError);
      setLoading(false);
      return;
    }

    if (data) {
      setWorkflowId(data.id);
      setWorkflowName(data.name);
      setWorkflowDescription(data.description || '');
      setWorkflowPattern(data.pattern);

      // Restore visual data if available
      if (data.visual_data && data.visual_data.nodes) {
        const restoredNodes = data.visual_data.nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            onTaskChange: handleTaskChange,
            onDelete: handleNodeDelete,
            onEdit: handleNodeEdit,
          },
        }));
        setNodes(restoredNodes);
      }

      if (data.visual_data && data.visual_data.edges) {
        setEdges(data.visual_data.edges);
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FFF8DC] flex flex-col">
      <Navigation />
      
      <div className="flex-1 flex overflow-hidden">
        <WorkflowSidebar
          agents={agents}
          onDragStart={onDragStart}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <div className="flex-1 flex flex-col">
          <div className="border-b-4 border-black bg-[#87CEEB] p-2">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-black text-black">Workflow Builder</h1>
              <div className="flex gap-2 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableSSE}
                    onChange={(e) => setEnableSSE(e.target.checked)}
                    className="w-4 h-4 border-2 border-black accent-[#87CEEB]"
                  />
                  <span className="text-xs font-bold text-black">SSE Logs</span>
                </label>
                <NeoButton variant="warning" onClick={handleClear} className="px-2 py-1 text-xs">
                  Clear
                </NeoButton>
                <NeoButton
                  variant="success"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-2 py-1 text-xs"
                >
                  {saving ? 'Saving...' : workflowId ? '💾 Update' : '💾 Save'}
                </NeoButton>
                <NeoButton
                  variant="primary"
                  onClick={handleExecute}
                  disabled={executing || !workflowId}
                  className="px-2 py-1 text-xs"
                >
                  {executing ? 'Executing...' : '▶️ Execute'}
                </NeoButton>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-black mb-1">
                  Workflow Name <span className="text-[#FFB6C1]">*</span>
                </label>
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="My Workflow"
                  required
                  className="w-full px-2 py-1 text-sm border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-black mb-1">
                  Pattern <span className="text-[#FFB6C1]">*</span>
                </label>
                <select
                  value={workflowPattern}
                  onChange={(e) => setWorkflowPattern(e.target.value)}
                  required
                  className="w-full px-2 py-1 text-sm border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none"
                >
                  {WORKFLOW_PATTERNS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-black mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Workflow description..."
                  className="w-full px-2 py-1 text-sm border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none"
                />
              </div>
              {workflowId && (
                <div className="col-span-3">
                  <p className="text-xs font-semibold text-black">
                    Workflow ID: {workflowId}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-2">
              <label className="block text-xs font-bold text-black mb-1">
                Session ID (Optional - for conversation state persistence)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Session ID (optional - for conversation state persistence)"
                  className="flex-1 px-2 py-1 text-sm border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    setSessionId(newSessionId);
                  }}
                  className="px-3 py-1 border-4 border-black bg-[#90EE90] text-black font-bold hover:bg-[#7ED87E] transition-colors text-xs"
                  title="Generate Session ID"
                >
                  🆔 Generate
                </button>
                {sessionId && (
                  <button
                    type="button"
                    onClick={() => setSessionId('')}
                    className="px-3 py-1 border-4 border-black bg-[#FFB6C1] text-black font-bold hover:bg-[#FF9BB0] transition-colors text-xs"
                    title="Clear Session ID"
                  >
                    🗑️ Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-black mt-1 font-semibold">
                💡 Session ID maintains conversation state across workflow executions. Leave empty for stateless executions.
              </p>
            </div>
          </div>

          {error && (
            <div className="neo-card-colored bg-[#FFB6C1] m-4">
              <p className="font-bold text-black">❌ Error: {error}</p>
            </div>
          )}

          {success && (
            <div className="neo-card-colored bg-[#90EE90] m-4">
              <p className="font-bold text-black">✅ {success}</p>
            </div>
          )}

          {executionStatus && (
            <div className="neo-card-colored bg-[#FFD700] m-4">
              <p className="font-bold text-black">
                Execution Status: <span className="uppercase">{executionStatus}</span>
              </p>
              
              {/* Real-time execution events (SSE) */}
              {enableSSE && executionEvents.length > 0 && (
                <div className="mt-2 border-t-4 border-black pt-2">
                  <p className="font-semibold text-black mb-2">Execution Events:</p>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {executionEvents.map((event, idx) => {
                      const getEventColor = (eventType) => {
                        switch (eventType) {
                          case 'workflow_started':
                            return 'bg-[#90EE90]';
                          case 'agent_starting':
                            return 'bg-[#87CEEB]';
                          case 'agent_completed':
                            return 'bg-[#90EE90]';
                          case 'agent_failed':
                            return 'bg-[#FFB6C1]';
                          case 'step_progress':
                            return 'bg-[#FFD700]';
                          case 'workflow_completed':
                            return 'bg-[#90EE90]';
                          case 'workflow_failed':
                            return 'bg-[#FFB6C1]';
                          default:
                            return 'bg-white';
                        }
                      };
                      
                      return (
                        <div key={idx} className={`border-2 border-black p-2 ${getEventColor(event.eventType)}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-bold text-black text-xs uppercase">
                                {event.eventType.replace(/_/g, ' ')}
                              </p>
                              {event.data.agent && (
                                <p className="text-xs text-black font-semibold">
                                  Agent: {event.data.agent}
                                </p>
                              )}
                              {event.data.task && (
                                <p className="text-xs text-black font-semibold">
                                  Task: {event.data.task}
                                </p>
                              )}
                              {event.data.step && (
                                <p className="text-xs text-black font-semibold">
                                  Step {event.data.step} of {event.data.total || 'N/A'}
                                </p>
                              )}
                              {event.data.percentage !== undefined && (
                                <p className="text-xs text-black font-semibold">
                                  Progress: {event.data.percentage}%
                                </p>
                              )}
                              {event.data.error && (
                                <p className="text-xs text-red-600 font-semibold">
                                  Error: {event.data.error}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-black opacity-75">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Step Results */}
              {executionResults && executionResults.step_results && (
                <div className="mt-2 border-t-4 border-black pt-2">
                  <p className="font-semibold text-black mb-2">Step Results:</p>
                  <div className="space-y-2">
                    {executionResults.step_results.map((step, idx) => (
                      <div key={idx} className="border-2 border-black p-2 bg-white">
                        <p className="font-bold text-black text-sm">
                          Step {step.step}: {step.agent}
                        </p>
                        <p className="text-xs text-black font-semibold">
                          Task: {step.task}
                        </p>
                        <p className={`text-xs font-semibold ${step.success ? 'text-green-600' : 'text-red-600'}`}>
                          Status: {step.success ? 'Success' : 'Failed'}
                        </p>
                        {step.output && (
                          <p className="text-xs text-black mt-1">
                            Output: {typeof step.output === 'string' ? step.output : JSON.stringify(step.output)}
                          </p>
                        )}
                        {step.error && (
                          <p className="text-xs text-red-600 mt-1">
                            Error: {step.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 relative" ref={reactFlowWrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              connectionMode="loose"
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                },
              }}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  switch (node.type) {
                    case 'agent':
                      return '#87CEEB';
                    default:
                      return '#90EE90';
                  }
                }}
                style={{
                  backgroundColor: '#FFF8DC',
                  border: '4px solid black',
                }}
              />
            </ReactFlow>
          </div>
        </div>
      </div>

      {/* Agent Edit Modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="neo-card-colored bg-[#FFD700] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b-4 border-black pb-2 px-4 pt-4">
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

            <form onSubmit={handleSaveAgent} className="flex-1 overflow-y-auto px-4 pb-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {availableTools.map((tool) => (
                      <label key={tool.name} className="flex items-start border-4 border-black p-3 bg-white cursor-pointer hover:bg-[#FFC0CB]">
                        <input
                          type="checkbox"
                          checked={editTools.includes(tool.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditTools([...editTools, tool.name]);
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
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Tool Configuration */}
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

              <div className="mb-4">
                <label className="block font-bold text-black mb-2">Memory</label>
                <div className="bg-[#87CEEB] border-4 border-black p-3 mb-3">
                  <label className="flex items-center border-4 border-black p-3 bg-white cursor-pointer hover:bg-[#90EE90]">
                    <input
                      type="checkbox"
                      checked={editEnableShortTermPostgres}
                      onChange={(e) => setEditEnableShortTermPostgres(e.target.checked)}
                      className="mr-3 w-5 h-5 border-2 border-black"
                    />
                    <span className="font-bold text-black text-base">
                      Enable Short-Term Postgres Memory
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <NeoInput
                  label="Tags (comma-separated)"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                />
                <NeoInput
                  label="Max Iterations"
                  type="number"
                  value={editMaxIterations}
                  onChange={(e) => setEditMaxIterations(parseInt(e.target.value) || 5)}
                  min="1"
                  max="6"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <NeoSelect
                  label="Status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'active', label: 'Active' },
                  ]}
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

              <div className="flex gap-2 justify-end mt-6 border-t-4 border-black pt-4">
                <NeoButton
                  type="button"
                  variant="danger"
                  onClick={() => setEditingAgent(null)}
                >
                  Cancel
                </NeoButton>
                <NeoButton
                  type="submit"
                  variant="success"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : '💾 Save Agent'}
                </NeoButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


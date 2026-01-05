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
import { listAgents, createWorkflow, updateWorkflow, getWorkflow, createExecution, getExecution, executeWorkflowWithSSE } from '@/lib/api';
import { WORKFLOW_PATTERNS } from '@/lib/constants';

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
  
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAgents();
    
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

            const context = {};

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
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handleTaskChange, handleNodeDelete]
  );

  const onDragStart = (event, agent) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(agent));
    event.dataTransfer.effectAllowed = 'move';
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

    const steps = convertToWorkflowSteps();
    const agentIds = [...new Set(nodes.map(node => node.data.agentId))];

    const workflowData = {
      name: workflowName,
      description: workflowDescription || null,
      pattern: workflowPattern,
      agents: agentIds,
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

    try {
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
      const steps = convertToWorkflowSteps();
      const agentIds = [...new Set(nodes.map(node => node.data.agentId))];

      const workflowData = {
        name: workflowName,
        description: workflowDescription || null,
        pattern: workflowPattern,
        agents: agentIds,
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
        return;
      }
      
      setWorkflowId(saveResult.data.id);
      setSuccess('Workflow saved! Now executing...');
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
    const context = {};

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
    </div>
  );
}


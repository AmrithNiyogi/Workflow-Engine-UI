'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import NeoButton from '@/components/NeoButton';
import NeoInput from '@/components/NeoInput';
import NeoSelect from '@/components/NeoSelect';
import { listExecutions, getExecution, cancelExecution, listWorkflows } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ExecutionsPage() {
  const router = useRouter();
  const [executions, setExecutions] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [pollingInterval, setPollingInterval] = useState(null);

  useEffect(() => {
    loadWorkflows();
    loadExecutions();
  }, [workflowFilter, statusFilter]);

  useEffect(() => {
    // Poll for running executions
    const interval = setInterval(() => {
      const hasRunning = executions.some(exec => exec.status === 'running' || exec.status === 'pending');
      if (hasRunning) {
        loadExecutions();
      }
    }, 3000);

    setPollingInterval(interval);
    return () => clearInterval(interval);
  }, [executions.length, workflowFilter, statusFilter]);

  const loadWorkflows = async () => {
    const { data } = await listWorkflows(0, 1000);
    if (data) {
      setWorkflows(data.workflows || []);
    }
  };

  const loadExecutions = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await listExecutions(0, 100, workflowFilter || null, statusFilter || null);
    
    if (apiError) {
      setError(apiError);
    } else {
      setExecutions(data?.executions || []);
      setTotal(data?.total || 0);
    }
    setLoading(false);
  };

  const handleViewDetails = async (executionId) => {
    const { data, error: apiError } = await getExecution(executionId);
    
    if (apiError) {
      setError(apiError);
    } else {
      setSelectedExecution(data);
    }
  };

  const handleCancel = async (executionId) => {
    if (!confirm('Are you sure you want to cancel this execution?')) {
      return;
    }

    const { error: apiError } = await cancelExecution(executionId);
    
    if (apiError) {
      setError(apiError);
    } else {
      loadExecutions();
      if (selectedExecution && selectedExecution.id === executionId) {
        handleViewDetails(executionId);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-[#90EE90]';
      case 'running':
        return 'bg-[#87CEEB]';
      case 'failed':
        return 'bg-[#FFB6C1]';
      case 'cancelled':
        return 'bg-[#D3D3D3]';
      case 'pending':
        return 'bg-[#FFD700]';
      default:
        return 'bg-[#FFF8DC]';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getWorkflowName = (workflowId) => {
    const workflow = workflows.find(w => w.id === workflowId);
    return workflow ? workflow.name : workflowId;
  };

  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#87CEEB] mb-6 flex justify-between items-center">
          <h1 className="text-4xl font-black text-black">Execution Logs</h1>
          <NeoButton variant="primary" onClick={loadExecutions} disabled={loading}>
            {loading ? 'Loading...' : '🔄 Refresh'}
          </NeoButton>
        </div>

        {error && (
          <div className="neo-card-colored bg-[#FFB6C1] mb-6">
            <p className="font-bold text-black">❌ Error: {error}</p>
          </div>
        )}

        <div className="neo-card-colored bg-[#90EE90] mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NeoSelect
              label="Filter by Workflow"
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
              options={[
                { value: '', label: 'All Workflows' },
                ...workflows.map(w => ({ value: w.id, label: w.name }))
              ]}
            />
            <NeoSelect
              label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
            />
            <div className="flex items-end">
              <p className="font-bold text-black text-lg">
                Total: {total} execution(s)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-black text-black mb-4">Executions</h2>
            {loading ? (
              <div className="neo-card">
                <p className="font-bold text-black text-center">Loading executions...</p>
              </div>
            ) : executions.length === 0 ? (
              <div className="neo-card">
                <p className="font-bold text-black text-center">No executions found.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[800px] overflow-y-auto">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className={`neo-card-colored ${getStatusColor(execution.status)} cursor-pointer hover:opacity-80 transition-opacity ${
                      selectedExecution?.id === execution.id ? 'ring-4 ring-black' : ''
                    }`}
                    onClick={() => handleViewDetails(execution.id)}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="font-black text-black text-lg mb-1">
                            {getWorkflowName(execution.workflow_id)}
                          </h3>
                          <p className="text-xs font-semibold text-black mb-1">
                            ID: {execution.id}
                          </p>
                          <p className="text-xs font-semibold text-black mb-1">
                            Workflow: {execution.workflow_id.substring(0, 8)}...
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 border-2 border-black font-bold text-black text-sm uppercase ${getStatusColor(execution.status)}`}>
                            {execution.status}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-black mt-2">
                        <div>
                          <span className="font-bold">Created:</span> {formatDate(execution.created_at)}
                        </div>
                        <div>
                          <span className="font-bold">Completed:</span> {formatDate(execution.completed_at)}
                        </div>
                      </div>
                      {execution.status === 'running' || execution.status === 'pending' ? (
                        <div className="mt-2">
                          <NeoButton
                            variant="danger"
                            className="px-3 py-1 text-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(execution.id);
                            }}
                          >
                            Cancel
                          </NeoButton>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-black text-black mb-4">Execution Details</h2>
            {selectedExecution ? (
              <div className="neo-card-colored bg-[#FFD700]">
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-black text-black text-xl mb-2">Execution Information</h3>
                    <div className="space-y-2 text-sm">
                      <p className="font-bold text-black">
                        <span className="font-semibold">ID:</span> {selectedExecution.id}
                      </p>
                      <p className="font-bold text-black">
                        <span className="font-semibold">Workflow:</span> {getWorkflowName(selectedExecution.workflow_id)}
                      </p>
                      <p className="font-bold text-black">
                        <span className="font-semibold">Status:</span>{' '}
                        <span className={`px-2 py-1 border-2 border-black uppercase ${getStatusColor(selectedExecution.status)}`}>
                          {selectedExecution.status}
                        </span>
                      </p>
                      <p className="font-bold text-black">
                        <span className="font-semibold">Created:</span> {formatDate(selectedExecution.created_at)}
                      </p>
                      {selectedExecution.started_at && (
                        <p className="font-bold text-black">
                          <span className="font-semibold">Started:</span> {formatDate(selectedExecution.started_at)}
                        </p>
                      )}
                      {selectedExecution.completed_at && (
                        <p className="font-bold text-black">
                          <span className="font-semibold">Completed:</span> {formatDate(selectedExecution.completed_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedExecution.context && Object.keys(selectedExecution.context).length > 0 && (
                    <div className="border-t-4 border-black pt-4">
                      <h3 className="font-black text-black text-xl mb-2">Context</h3>
                      <div className="border-2 border-black p-3 bg-white">
                        <pre className="text-xs text-black font-semibold overflow-auto">
                          {JSON.stringify(selectedExecution.context, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {selectedExecution.step_results && selectedExecution.step_results.length > 0 && (
                    <div className="border-t-4 border-black pt-4">
                      <h3 className="font-black text-black text-xl mb-2">Step Results</h3>
                      <div className="space-y-2">
                        {selectedExecution.step_results.map((step, idx) => (
                          <div key={idx} className="border-2 border-black p-3 bg-white">
                            <div className="flex justify-between items-start mb-2">
                              <p className="font-bold text-black text-sm">
                                Step {step.step || idx + 1}: {step.agent || 'Unknown Agent'}
                              </p>
                              <span className={`px-2 py-1 border-2 border-black text-xs font-bold ${
                                step.success ? 'bg-[#90EE90]' : 'bg-[#FFB6C1]'
                              }`}>
                                {step.success ? 'SUCCESS' : 'FAILED'}
                              </span>
                            </div>
                            {step.task && (
                              <p className="text-xs text-black font-semibold mb-1">
                                Task: {step.task}
                              </p>
                            )}
                            {step.output && (
                              <div className="mt-2">
                                <p className="text-xs font-bold text-black mb-1">Output:</p>
                                <pre className="text-xs text-black bg-[#FFF8DC] p-2 border-2 border-black overflow-auto max-h-32">
                                  {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                                </pre>
                              </div>
                            )}
                            {step.error && (
                              <div className="mt-2">
                                <p className="text-xs font-bold text-red-600 mb-1">Error:</p>
                                <p className="text-xs text-red-600 bg-[#FFB6C1] p-2 border-2 border-black">
                                  {step.error}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedExecution.logs && selectedExecution.logs.length > 0 && (
                    <div className="border-t-4 border-black pt-4">
                      <h3 className="font-black text-black text-xl mb-2">Logs</h3>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {selectedExecution.logs.map((log, idx) => (
                          <div key={idx} className="border-2 border-black p-2 bg-white">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs font-bold text-black">
                                {log.timestamp ? formatDate(log.timestamp) : 'N/A'}
                              </span>
                              <span className={`px-2 py-1 border-2 border-black text-xs font-bold ${
                                log.level === 'error' ? 'bg-[#FFB6C1]' :
                                log.level === 'warning' ? 'bg-[#FFD700]' :
                                'bg-[#90EE90]'
                              }`}>
                                {log.level?.toUpperCase() || 'INFO'}
                              </span>
                            </div>
                            <p className="text-xs text-black font-semibold">{log.message}</p>
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <pre className="text-xs text-black mt-1 bg-[#FFF8DC] p-1 border border-black overflow-auto">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedExecution.errors && selectedExecution.errors.length > 0 && (
                    <div className="border-t-4 border-black pt-4">
                      <h3 className="font-black text-black text-xl mb-2">Errors</h3>
                      <div className="space-y-2">
                        {selectedExecution.errors.map((error, idx) => (
                          <div key={idx} className="border-2 border-black p-3 bg-[#FFB6C1]">
                            <p className="text-sm font-bold text-black">{error}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedExecution.results && (
                    <div className="border-t-4 border-black pt-4">
                      <h3 className="font-black text-black text-xl mb-2">Results</h3>
                      <div className="border-2 border-black p-3 bg-white">
                        <pre className="text-xs text-black font-semibold overflow-auto">
                          {JSON.stringify(selectedExecution.results, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {selectedExecution.metadata && Object.keys(selectedExecution.metadata).length > 0 && (
                    <div className="border-t-4 border-black pt-4">
                      <h3 className="font-black text-black text-xl mb-2">Metadata</h3>
                      <div className="border-2 border-black p-3 bg-white">
                        <pre className="text-xs text-black font-semibold overflow-auto">
                          {JSON.stringify(selectedExecution.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {(selectedExecution.status === 'running' || selectedExecution.status === 'pending') && (
                    <div className="border-t-4 border-black pt-4">
                      <NeoButton
                        variant="danger"
                        onClick={() => handleCancel(selectedExecution.id)}
                      >
                        Cancel Execution
                      </NeoButton>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="neo-card">
                <p className="font-bold text-black text-center">
                  Select an execution to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import NeoButton from '@/components/NeoButton';
import NeoInput from '@/components/NeoInput';
import NeoSelect from '@/components/NeoSelect';
import { listWorkflows, deleteWorkflow } from '@/lib/api';
import { WORKFLOW_PATTERNS } from '@/lib/constants';

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [patternFilter, setPatternFilter] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadWorkflows();
  }, [searchTerm, patternFilter]);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await listWorkflows(0, 100, searchTerm || null, patternFilter || null);
    
    if (apiError) {
      setError(apiError);
    } else {
      setWorkflows(data?.workflows || []);
      setTotal(data?.total || 0);
    }
    setLoading(false);
  };

  const handleDelete = async (workflowId, workflowName) => {
    if (!confirm(`Are you sure you want to delete workflow "${workflowName}"?`)) {
      return;
    }

    const { error: apiError } = await deleteWorkflow(workflowId);
    
    if (apiError) {
      setError(apiError);
    } else {
      loadWorkflows();
    }
  };

  const handleEdit = (workflowId) => {
    router.push(`/workflows/create?workflowId=${workflowId}`);
  };

  const handleExecute = (workflowId) => {
    router.push(`/workflows/create?workflowId=${workflowId}&execute=true`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#87CEEB] mb-6 flex justify-between items-center">
          <h1 className="text-4xl font-black text-black">Workflow List</h1>
          <div className="flex gap-2">
            <NeoButton variant="primary" onClick={loadWorkflows} disabled={loading}>
              {loading ? 'Loading...' : '🔄 Refresh'}
            </NeoButton>
            <Link href="/workflows/create">
              <NeoButton variant="success">➕ Create Workflow</NeoButton>
            </Link>
          </div>
        </div>

        {error && (
          <div className="neo-card-colored bg-[#FFB6C1] mb-6">
            <p className="font-bold text-black">❌ Error: {error}</p>
          </div>
        )}

        <div className="neo-card-colored bg-[#90EE90] mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NeoInput
              label="Search Workflows"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or description..."
            />
            <NeoSelect
              label="Filter by Pattern"
              value={patternFilter}
              onChange={(e) => setPatternFilter(e.target.value)}
              options={[
                { value: '', label: 'All Patterns' },
                ...WORKFLOW_PATTERNS
              ]}
            />
            <div className="flex items-end">
              <p className="font-bold text-black text-lg">
                Total: {total} workflow(s)
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="neo-card">
            <p className="font-bold text-black text-center">Loading workflows...</p>
          </div>
        ) : workflows.length === 0 ? (
          <div className="neo-card">
            <p className="font-bold text-black text-center mb-4">No workflows found. Create your first workflow!</p>
            <div className="text-center">
              <Link href="/workflows/create">
                <NeoButton variant="primary">➕ Create Workflow</NeoButton>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="neo-card-colored bg-[#FFD700]">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-black text-black mb-2">{workflow.name}</h2>
                      {workflow.description && (
                        <p className="text-black font-semibold mb-2">{workflow.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="font-bold text-black">
                          Pattern: <span className="uppercase">{workflow.pattern}</span>
                        </span>
                        <span className="font-bold text-black">
                          Agents: {workflow.agents?.length || 0}
                        </span>
                        <span className="font-bold text-black">
                          Steps: {workflow.steps?.length || 0}
                        </span>
                        <span className="font-bold text-black">
                          Created: {formatDate(workflow.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <NeoButton
                        variant="primary"
                        onClick={() => handleEdit(workflow.id)}
                      >
                        ✏️ Edit
                      </NeoButton>
                      <NeoButton
                        variant="success"
                        onClick={() => handleExecute(workflow.id)}
                      >
                        ▶️ Execute
                      </NeoButton>
                      <NeoButton
                        variant="danger"
                        onClick={() => handleDelete(workflow.id, workflow.name)}
                      >
                        🗑️ Delete
                      </NeoButton>
                    </div>
                  </div>
                  
                  {workflow.steps && workflow.steps.length > 0 && (
                    <div className="mt-4 border-t-4 border-black pt-4">
                      <h3 className="font-black text-black mb-2">Workflow Steps:</h3>
                      <div className="space-y-2">
                        {workflow.steps.map((step, idx) => (
                          <div key={idx} className="border-2 border-black p-2 bg-white">
                            <p className="font-bold text-black text-sm">
                              Step {idx + 1}: Agent {step.agent}
                              {step.depends_on && step.depends_on.length > 0 && (
                                <span className="text-xs font-semibold ml-2">
                                  (Depends on: {step.depends_on.join(', ')})
                                </span>
                              )}
                            </p>
                            {step.task && (
                              <p className="text-xs text-black mt-1">{step.task}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}







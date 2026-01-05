'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import NeoSelect from '@/components/NeoSelect';
import ChatBot from '@/components/ChatBot';
import { listAgents, executeAgent } from '@/lib/api';
import { FRAMEWORKS } from '@/lib/constants';

function ExecutePageContent() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [frameworkOverride, setFrameworkOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAgents();
    const agentId = searchParams.get('agentId');
    if (agentId) {
      setSelectedAgentId(agentId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedAgentId) {
      const agent = agents.find(a => a.id === selectedAgentId);
      setSelectedAgent(agent);
    }
  }, [selectedAgentId, agents]);

  const loadAgents = async () => {
    const { data } = await listAgents();
    if (data) {
      setAgents(data.agents || []);
    }
  };

  const handleSendMessage = async (message) => {
    if (!selectedAgentId || !message.trim()) {
      throw new Error('Please select an agent and enter a message');
    }

    setLoading(true);
    setError(null);

    try {
      const executeRequest = {
        task: message,
        parameters: {},
        context: {},
        framework: frameworkOverride || null,
      };

      const { data, error: apiError } = await executeAgent(selectedAgentId, executeRequest);

      setLoading(false);

      if (apiError) {
        throw new Error(apiError);
      }

      return data;
    } catch (e) {
      setLoading(false);
      setError(e.message);
      throw e;
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#FFD700] mb-6">
          <h1 className="text-4xl font-black text-black">💬 Chat with Agent</h1>
        </div>

        {/* Agent and Framework Selection */}
        <div className="neo-card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NeoSelect
              label="Select Agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              options={[
                { value: '', label: '-- Select an agent --' },
                ...agents.map(agent => ({ value: agent.id, label: `${agent.name} (${agent.framework})` }))
              ]}
              required
            />

            <NeoSelect
              label="Framework Override (Optional)"
              value={frameworkOverride}
              onChange={(e) => setFrameworkOverride(e.target.value)}
              options={[
                { value: '', label: 'Use agent default' },
                ...FRAMEWORKS.map(f => ({ value: f, label: f }))
              ]}
            />
          </div>

          {selectedAgent && (
            <div className="neo-card-colored bg-[#90EE90] mt-4 p-4">
              <p className="font-bold text-black mb-2">📋 Selected Agent Info:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p className="text-black font-semibold">Framework: {selectedAgent.framework}</p>
                <p className="text-black font-semibold">Model: {selectedAgent.llm_config?.model || 'N/A'}</p>
                {selectedAgent.description && (
                  <p className="text-black font-semibold col-span-2">
                    Description: {selectedAgent.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="neo-card-colored bg-[#FFB6C1] mb-6">
            <h2 className="text-2xl font-black text-black mb-2">Error</h2>
            <p className="font-bold text-black">{error}</p>
          </div>
        )}

        {/* ChatBot Component */}
        <div className="neo-card" style={{ minHeight: '600px' }}>
          <ChatBot
            agentId={selectedAgentId}
            frameworkOverride={frameworkOverride}
            onSendMessage={handleSendMessage}
            loading={loading}
            useStreaming={true}
          />
        </div>
      </div>
    </div>
  );
}

export default function ExecutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF8DC] flex items-center justify-center"><p className="font-bold text-black">Loading...</p></div>}>
      <ExecutePageContent />
    </Suspense>
  );
}


'use client';

import { useState } from 'react';
import NeoButton from './NeoButton';

const EMBED_HOST_URL = 'https://aistudio-workflow-v2-dev.sangria.tech';
const CLOUDFRONT_BUNDLE_URL = 'https://d2plkd9gyb9lkr.cloudfront.net/dev/bundle.min.js';

export default function AgentCard({ agent, onEdit, onDelete, onExecute }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(agent.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const getEmbedScript = () => {
    return `    <dotagent-chat
        agent_id="${agent.id}"
        host_url="${EMBED_HOST_URL}"
        window_title="${agent.name || 'Agent Chat'}">
    </dotagent-chat>

    <!-- Load the DotAgent Chat Widget from CloudFront -->
    <script src="${CLOUDFRONT_BUNDLE_URL}"></script>`;
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(getEmbedScript());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="neo-card-colored bg-[#90EE90] mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-black text-black mb-2">
            🤖 {agent.name || 'Unnamed'}
          </h3>
          <div className="space-y-1">
            <p className="font-bold text-black">
              <span className="text-[#87CEEB]">Framework:</span> {agent.framework}
            </p>
            <p className="font-bold text-black">
              <span className="text-[#87CEEB]">Model:</span> {agent.llm_config?.model || 'N/A'}
            </p>
            <p className="font-bold text-black">
              <span className="text-[#87CEEB]">Status:</span> 
              <span className={`ml-2 px-2 py-1 border-2 border-black ${
                agent.status === 'active' ? 'bg-[#90EE90]' : 'bg-[#FFD700]'
              }`}>
                {agent.status || 'draft'}
              </span>
            </p>
            <p className="font-bold text-black">
              <span className="text-[#87CEEB]">Owner:</span> {agent.owner || 'N/A'}
            </p>
            <p className="font-bold text-black">
              <span className="text-[#87CEEB]">Category:</span> {agent.category || 'N/A'}
            </p>
            {agent.tags && agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {agent.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="neo-badge bg-[#FFC0CB] text-black"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <NeoButton
            variant="primary"
            onClick={() => onEdit(agent)}
            className="text-sm px-4 py-2"
          >
            ✏️ Edit
          </NeoButton>
          <NeoButton
            variant={showDeleteConfirm ? 'danger' : 'danger'}
            onClick={handleDelete}
            className="text-sm px-4 py-2"
          >
            {showDeleteConfirm ? '⚠️ Confirm Delete' : '🗑️ Delete'}
          </NeoButton>
          <NeoButton
            variant="warning"
            onClick={() => onExecute(agent)}
            className="text-sm px-4 py-2"
          >
            ▶️ Execute
          </NeoButton>
          <NeoButton
            variant="secondary"
            onClick={() => setShowEmbedModal(true)}
            className="text-sm px-4 py-2"
          >
            📋 Get Embed Script
          </NeoButton>
        </div>
      </div>

      {agent.description && (
        <p className="text-black font-semibold mb-4">{agent.description}</p>
      )}

      <NeoButton
        variant="secondary"
        onClick={() => setShowDetails(!showDetails)}
        className="text-sm"
      >
        {showDetails ? '− Hide Details' : '+ View Full Details'}
      </NeoButton>

      {showDetails && (
        <div className="mt-4 bg-[#FFF8DC] border-4 border-black p-4">
          <pre className="text-xs overflow-auto text-black">
            {JSON.stringify(agent, null, 2)}
          </pre>
        </div>
      )}

      {showEmbedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="neo-card-colored bg-[#87CEEB] max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b-4 border-black pb-2">
              <h3 className="text-2xl font-black text-black">
                📋 Embed Script for {agent.name}
              </h3>
              <button
                onClick={() => {
                  setShowEmbedModal(false);
                  setCopied(false);
                }}
                className="text-2xl font-black text-black hover:text-red-600"
              >
                ×
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-black font-semibold mb-2">
                Copy and paste this code into your HTML page:
              </p>
              <div className="bg-[#FFF8DC] border-4 border-black p-4 relative">
                <pre className="text-xs overflow-auto text-black whitespace-pre-wrap">
                  {getEmbedScript()}
                </pre>
                <button
                  onClick={handleCopyScript}
                  className="absolute top-2 right-2 neo-button bg-[#90EE90] border-4 border-black px-3 py-1 text-sm font-bold text-black hover:bg-[#7ED87E]"
                >
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>
            <div className="neo-card-colored bg-[#90EE90] p-4 mb-4">
              <p className="font-bold text-black mb-2">📝 Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-black font-semibold text-sm">
                <li>Copy the code above</li>
                <li>Paste it into your HTML page where you want the chat widget to appear</li>
                <li>The widget will automatically load and connect to the agent</li>
              </ol>
            </div>
            <div className="flex justify-end">
              <NeoButton
                variant="primary"
                onClick={() => {
                  setShowEmbedModal(false);
                  setCopied(false);
                }}
              >
                Close
              </NeoButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

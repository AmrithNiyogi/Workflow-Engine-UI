'use client';

import Navigation from '@/components/Navigation';
import NeoButton from '@/components/NeoButton';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFF8DC]">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="neo-card-colored bg-[#87CEEB] mb-8">
          <h1 className="text-5xl font-black text-black mb-4">
            Welcome to DotAgent
          </h1>
          <p className="text-xl font-bold text-black">
            Manage your AI agents with Neo Brutalism style
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="neo-card-colored bg-[#90EE90]">
            <h2 className="text-2xl font-black text-black mb-3">➕ Create Agent</h2>
            <p className="text-black font-semibold mb-4">
              Create new agents with custom configurations, LLM settings, and tools
            </p>
            <Link href="/create">
              <NeoButton variant="primary">Create Now</NeoButton>
            </Link>
          </div>

          <div className="neo-card-colored bg-[#FFC0CB]">
            <h2 className="text-2xl font-black text-black mb-3">📋 List Agents</h2>
            <p className="text-black font-semibold mb-4">
              View, edit, and delete your existing agents
            </p>
            <Link href="/agents">
              <NeoButton variant="secondary">View Agents</NeoButton>
            </Link>
          </div>

          <div className="neo-card-colored bg-[#FFD700]">
            <h2 className="text-2xl font-black text-black mb-3">⚙️ Execute Agent</h2>
            <p className="text-black font-semibold mb-4">
              Test your agents by running tasks and seeing results
            </p>
            <Link href="/execute">
              <NeoButton variant="warning">Execute Now</NeoButton>
            </Link>
          </div>
        </div>

        <div className="neo-card">
          <h2 className="text-3xl font-black text-black mb-4">Quick Start</h2>
          <ol className="list-decimal list-inside space-y-3 text-black font-semibold">
            <li>Make sure your FastAPI server is running on <code className="bg-[#90EE90] px-2 py-1 border-2 border-white text-black">https://aistudio-workflow-v2-dev.sangria.tech/api</code></li>
            <li>Navigate to <strong>Create Agent</strong> to add your first agent</li>
            <li>Use <strong>List Agents</strong> to manage existing agents</li>
            <li>Use <strong>Execute Agent</strong> to test agent responses</li>
          </ol>
        </div>

        <div className="neo-card-colored bg-[#87CEEB] mt-8">
          <h2 className="text-2xl font-black text-black mb-3">Features</h2>
          <ul className="list-disc list-inside space-y-2 text-black font-semibold">
            <li>Full CRUD operations for agents</li>
            <li>Custom API tools with testing</li>
            <li>Multiple LLM providers (Ollama, LiteLLM)</li>
            <li>Multiple frameworks (LangChain, Ollama, CrewAI)</li>
            <li>Real-time agent execution</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

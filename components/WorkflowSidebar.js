'use client';

import { useState } from 'react';
import NeoInput from './NeoInput';

export default function WorkflowSidebar({ agents, onDragStart, searchTerm, onSearchChange }) {
  const [localSearch, setLocalSearch] = useState('');

  const handleSearch = (value) => {
    setLocalSearch(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  const filteredAgents = agents.filter(agent => {
    if (!localSearch && !searchTerm) return true;
    const search = (localSearch || searchTerm || '').toLowerCase();
    return (
      agent.name?.toLowerCase().includes(search) ||
      agent.description?.toLowerCase().includes(search) ||
      agent.framework?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="w-64 h-full bg-[#FFF8DC] border-r-4 border-black p-4 overflow-y-auto">
      <h2 className="text-2xl font-black text-black mb-4 border-b-4 border-black pb-2">
        Agents
      </h2>
      
      <div className="mb-4">
        <NeoInput
          label="Search Agents"
          value={localSearch}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Type to search..."
        />
      </div>

      <div className="space-y-2">
        {filteredAgents.length === 0 ? (
          <div className="neo-card p-4">
            <p className="text-black font-semibold text-sm text-center">
              {agents.length === 0 ? 'No agents available' : 'No agents found'}
            </p>
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <div
              key={agent.id}
              draggable
              onDragStart={(e) => onDragStart(e, agent)}
              className="neo-card-colored bg-[#90EE90] p-3 cursor-move hover:bg-[#7FDD7F] transition-colors"
            >
              <h3 className="font-black text-black text-sm mb-1">{agent.name}</h3>
              <p className="text-xs text-black font-semibold mb-1">
                {agent.framework}
              </p>
              {agent.description && (
                <p className="text-xs text-black opacity-75 line-clamp-2">
                  {agent.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}


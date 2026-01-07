'use client';

import { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';

function AgentNode({ id, data, selected }) {
  const [taskValue, setTaskValue] = useState(data.task || '');

  // Sync with external data changes
  useEffect(() => {
    setTaskValue(data.task || '');
  }, [data.task]);

  const handleTaskChange = (e) => {
    const newValue = e.target.value;
    setTaskValue(newValue);
    if (data.onTaskChange) {
      // Use the node's id prop, not data.id
      data.onTaskChange(id, newValue);
    }
  };

  const handleDelete = () => {
    if (data.onDelete) {
      // Use the node's id prop, not data.id
      data.onDelete(id);
    }
  };

  const handleEdit = () => {
    if (data.onEdit) {
      // Use the node's id prop, not data.id
      data.onEdit(id, data.agentId);
    }
  };

  return (
    <div
      className={`neo-card-colored bg-[#87CEEB] min-w-[250px] ${
        selected ? 'ring-4 ring-black' : ''
      }`}
    >
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-black text-black text-lg">{data.agentName}</h3>
          <div className="flex gap-1">
            {data.onEdit && (
              <button
                onClick={handleEdit}
                className="px-2 py-1 bg-[#90EE90] border-2 border-black font-bold text-black text-xs hover:bg-[#7FDD7F]"
                title="Edit Agent"
              >
                ✏️
              </button>
            )}
            {data.onDelete && (
              <button
                onClick={handleDelete}
                className="px-2 py-1 bg-[#FFB6C1] border-2 border-black font-bold text-black text-xs hover:bg-[#FF9CA8]"
                title="Delete Node"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-black font-semibold mb-2">
          Framework: {data.framework}
        </p>
      </div>
      
      <div className="mb-2">
        <label className="block font-bold text-black text-sm mb-1">
          Task:
        </label>
        <textarea
          value={taskValue}
          onChange={handleTaskChange}
          placeholder="Enter task description..."
          className="w-full p-2 border-4 border-black bg-white text-black font-semibold text-sm resize-none focus:outline-none"
          rows={3}
        />
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-black border-2 border-white" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-black border-2 border-white" />
    </div>
  );
}

export default AgentNode;


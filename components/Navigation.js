'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: '🏠 Home' },
    { href: '/create', label: '➕ Create Agent' },
    { href: '/agents', label: '📋 List Agents' },
    { href: '/components', label: '🧩 Components' },
    { href: '/execute', label: '⚙️ Execute Agent' },
    { href: '/workflows/create', label: '🔗 Create Workflow' },
    { href: '/workflows', label: '📋 List Workflows' },
    { href: '/workflows/executions', label: '📊 Execution Logs' },
  ];

  return (
    <nav className="border-b-4 border-black bg-[#90EE90] mb-8">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-black">🤖 DotAgent</h1>
          <div className="flex gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 font-bold border-4 border-black transition-all ${
                    isActive
                      ? 'bg-[#87CEEB] shadow-[2px_2px_0px_0px_#000000] text-black'
                      : 'bg-[#FFF8DC] shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-1 hover:translate-y-1 text-black'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}


'use client';

import { ReactNode, useState } from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: string;
    badge?: number;
    content: ReactNode;
}

interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
}

export default function Tabs({ tabs, defaultTab }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

    return (
        <div className="w-full">
            {/* Tab Headers */}
            <div className="border-b border-white/10 mb-6">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative px-6 py-3 font-semibold transition-colors whitespace-nowrap ${isActive
                                        ? 'text-blue-400'
                                        : 'text-gray-400 hover:text-gray-300'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    {tab.icon && <i className={`bx ${tab.icon} text-lg`}></i>}
                                    {tab.label}
                                    {tab.badge !== undefined && tab.badge > 0 && (
                                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full min-w-[20px] text-center">
                                            {tab.badge}
                                        </span>
                                    )}
                                </span>
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div
                key={activeTab}
                className="min-h-[200px]"
            >
                {activeTabContent}
            </div>
        </div>
    );
}

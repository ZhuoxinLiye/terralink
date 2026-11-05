"use client";

import { useState, useEffect } from "react";
import ToolkitCard from "@/components/toolkit-card";
import { TL } from "@/lib/terralink";
import { Toolkit, Tool } from "@/lib/types";

export default function MyToolkitsPage() {
  const [myToolkits, setMyToolkits] = useState<Toolkit[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [user, setUser] = useState<{ user_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await TL.me();
        setUser(userData);
        
        // Get all toolkits
        const toolkitData = await TL.listToolkits();
        
        // Get all connection information
        const allConnections: any[] = [];
        for (const toolkit of toolkitData as Toolkit[]) {
          try {
            const toolkitConnections = await TL.getToolkitConnections(toolkit.name);
            allConnections.push(...toolkitConnections.map((conn: any) => ({
              ...conn,
              toolkit: toolkit.name,
              toolkit_name: toolkit.name // Add both for compatibility
            })));
          } catch (error) {
            console.warn(`Failed to get connections for toolkit ${toolkit.name}:`, error);
          }
        }
        
        setConnections(allConnections);
        
        // Add connection count information for each toolkit
        const toolkitsWithConnections = (toolkitData as Toolkit[]).map((toolkit: Toolkit) => {
          const toolkitConnections = allConnections.filter((conn: any) => 
            conn.toolkit === toolkit.name || conn.toolkit_name === toolkit.name
          );
          
          // Count only valid and enabled connections
          const validConnections = toolkitConnections.filter((conn: any) => 
            conn.status === 'valid' && conn.enabled
          );
          
          return {
            ...toolkit,
            connectionCount: validConnections.length,
            connections: toolkitConnections,
            tools: (toolkit.tools || []).map((tool: Tool) => ({
              ...tool,
              status: tool.requires_connection && validConnections.length === 0 
                ? 'unavailable' 
                : 'available'
            }))
          };
        });
        
        // Only show toolkits that user has connected
        const connectedToolkits = toolkitsWithConnections.filter(toolkit => toolkit.connectionCount > 0);
        setMyToolkits(connectedToolkits);
        
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRevokeAccount = async (accountId: string | number) => {
    try {
      await TL.deleteConnection(accountId.toString());
      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error("Failed to revoke account:", error);
    }
  };

  const handleExecuteTool = async (toolSlug: string, args: any) => {
    try {
      const result = await TL.executeTool(toolSlug, args);
      return result;
    } catch (error) {
      console.error("Tool execution failed:", error);
      throw error;
    }
  };

  const handleToolExecution = async (toolSlug: string, inputs: any) => {
    try {
      const result = await TL.executeTool(toolSlug, inputs);
      setExecutionResult({
        toolSlug,
        args: inputs,
        result,
        timestamp: new Date().toISOString()
      });
      setShowResult(true);
      setIsToolDialogOpen(false);
    } catch (error) {
      console.error("Tool execution failed:", error);
      setExecutionResult({
        toolSlug,
        args: inputs,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      setShowResult(true);
      setIsToolDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Toolkits</h1>
          <p className="text-gray-600">Manage your connected toolkits and tools</p>
        </div>

        {/* Statistics */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">{myToolkits.length}</div>
                <div className="text-gray-600">Connected Toolkits</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {myToolkits.reduce((total, toolkit) => total + (toolkit.tools?.length || 0), 0)}
                </div>
                <div className="text-gray-600">Available Tools</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">{connections.length}</div>
                <div className="text-gray-600">Active Connections</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolkit list */}
        {myToolkits.length > 0 ? (
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {myToolkits.map((toolkit) => (
              <div key={toolkit.name} className="break-inside-avoid mb-6">
                <ToolkitCard
                  toolkit={toolkit}
                  connectedAccounts={connections.filter(conn => 
                    (conn.toolkit === toolkit.name || conn.toolkit_name === toolkit.name) &&
                    conn.status === 'valid' && conn.enabled
                  )}
                  onConnect={() => {}} // No connection functionality needed on my toolkits page
                  onRevokeAccount={handleRevokeAccount}
                  onExecuteTool={(toolSlug: string, args: any) => handleExecuteTool(toolSlug, args)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Connected Toolkits
              </h3>
              <p className="text-gray-500 mb-4">
                You haven&apos;t connected any toolkits yet. Please connect toolkits from the toolkits page first
              </p>
              <a
                href="/toolkits"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Browse Toolkits
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Tool execution dialog */}
      {isToolDialogOpen && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Execute Tool: {selectedTool.name}</h2>
              <button
                onClick={() => setIsToolDialogOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tool execution result display */}
      {showResult && executionResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Tool Execution Result: {executionResult.toolSlug}
              </h2>
              <button
                onClick={() => setShowResult(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Execution Time</h3>
                <p className="text-sm text-gray-600">{new Date(executionResult.timestamp).toLocaleString()}</p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Input Parameters</h3>
                <pre className="bg-gray-50 p-3 rounded text-gray-700 text-sm overflow-x-auto">
                  {JSON.stringify(executionResult.args, null, 2)}
                </pre>
              </div>
              
              {executionResult.result && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Execution Result</h3>
                  <div className={`p-3 rounded text-sm ${
                    executionResult.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    <div className="mb-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        executionResult.result.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {executionResult.result.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    
                    {executionResult.result.outputs && (
                      <div>
                        <h4 className="font-medium mb-1 text-gray-700">Output Data:</h4>
                        <pre className="bg-white p-2 rounded border overflow-x-auto text-gray-800">
                          {JSON.stringify(executionResult.result.outputs, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {executionResult.result.error && (
                      <div>
                        <h4 className="font-medium mb-1 text-red-700">Error Message:</h4>
                        <p className="text-red-600">{executionResult.result.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {executionResult.error && (
                <div>
                  <h3 className="text-sm font-medium text-red-700 mb-2">Execution Error</h3>
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                    <p className="text-red-600">{executionResult.error}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowResult(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

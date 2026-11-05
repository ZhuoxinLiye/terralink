"use client";

import { useState, useEffect } from "react";
import ApiKeyCard from "@/components/api-key-card";
import ToolkitCard from "@/components/toolkit-card";
import { TL } from "@/lib/terralink";
import { Toolkit, Tool } from "@/lib/types";

export default function ConsolePage() {
  const [activeTab, setActiveTab] = useState("api-keys");
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [toolkits, setToolkits] = useState<Toolkit[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [oauthAccounts, setOAuthAccounts] = useState<any[]>([]);
  const [user, setUser] = useState<{ user_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyPrefix, setNewKeyPrefix] = useState<"live" | "test">("live");
  // Add new state to store newly created API key and control modal dialog
  const [newCreatedKey, setNewCreatedKey] = useState<any>(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isToolDialogOpen, setIsToolDialogOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userData = await TL.me();
        setUser(userData);
        
        if (activeTab === "api-keys") {
          const keys = await TL.listApiKeys();
          setApiKeys(keys);

        } else if (activeTab === "oauth-accounts") {
          const oauthData = await TL.listOAuthAccounts();
          setOAuthAccounts(oauthData as any[]);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const handleCreateApiKey = async () => {
    if (!newKeyLabel.trim()) return;
    
    try {
      const newKey = await TL.createApiKey(newKeyLabel, newKeyPrefix);
      setNewKeyLabel("");
      // Save newly created key and show modal dialog
      setNewCreatedKey(newKey);
      setShowKeyModal(true);
      // Update API key list
      const keys = await TL.listApiKeys();
      setApiKeys(keys);
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const handleDeleteApiKey = async (id: string | number) => {
    try {
      // Ensure ID is numeric type
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Find current API key
      const apiKey = apiKeys.find(key => key.id === id || key.id === numericId);
      
      if (apiKey && (apiKey.status === 'active' || apiKey.is_active)) {
        // If active status, revoke first (deactivate)
        if (confirm('This API key is currently active. Are you sure you want to deactivate it?')) {
          await TL.revokeApiKey(numericId);
          alert('API key has been deactivated. To permanently delete it, please click the delete button again.');
        }
      } else {
        // If not active status, directly remove (permanent deletion)
        if (confirm('Are you sure you want to permanently delete this API key? This action cannot be undone!')) {
          await TL.removeApiKey(numericId);
          alert('API key has been permanently deleted.');
        }
      }
      
      // Refresh API key list
      const keys = await TL.listApiKeys();
      setApiKeys(keys);
    } catch (error) {
      console.error("Failed to delete API key:", error);
      alert('Operation failed, please try again.');
    }
  };

  const handleConnectToolkit = async (toolkit: string) => {
    if (!user) return;
    
    try {
      const connection = await TL.createConnection(toolkit, {
        name: `${toolkit} Connection`,
        auth_method: 'oauth2'
      });
      console.log("Connection created:", connection);
      
      // If there's a redirect_url, open OAuth authentication page
      if ((connection as any).redirect_url && (connection as any).redirect_url !== '') {
        console.log("Opening OAuth URL:", (connection as any).redirect_url);
        window.open((connection as any).redirect_url, '_blank');
      }
      
      // After OAuth2 connection is created, user needs to manually complete authorization flow
      // Here we can add prompt information or refresh logic
      if ((connection as any).auth_url) {
        console.log("Opening OAuth URL:", (connection as any).auth_url);
        window.open((connection as any).auth_url, '_blank');
        alert(`Please complete the authorization for ${toolkit} in the new window, then refresh the page to view the connection status.`);
      } else {
        // For non-OAuth connections, refresh data directly
        const toolkitData = await TL.listToolkits();
        
        // Get connection information for all toolkits
        const allConnections: any[] = [];
        for (const toolkit of toolkitData as any[]) {
          try {
            const connections = await TL.getToolkitConnections(toolkit.name);
            allConnections.push(...connections.map((conn: any) => ({
              ...conn,
              toolkit: toolkit.name,
              toolkit_name: toolkit.name // Add both for compatibility
            })));
          } catch (error) {
            console.warn(`Failed to get connections for toolkit ${toolkit.name}:`, error);
          }
        }
        const accountData = allConnections;
        
        // Recalculate tool status
        const toolkitsWithStatus = (toolkitData as Toolkit[]).map((toolkit: Toolkit) => {
          const toolkitAccounts = (accountData as any[]).filter((acc: any) => 
            acc.toolkit === toolkit.name || acc.toolkit_name === toolkit.name
          );
          
          // Count only valid and enabled connections
          const validConnections = toolkitAccounts.filter((acc: any) => 
            acc.status === 'valid' && acc.enabled
          );
          
          return {
            ...toolkit,
            tools: (toolkit.tools || []).map((tool: Tool) => ({
              ...tool,
              status: tool.requires_connection && validConnections.length === 0 
                ? 'unavailable' 
                : 'available'
            }))
          };
        });
        
        setAccounts(accountData as any[]);
        setToolkits(toolkitsWithStatus);
        const allTools = toolkitsWithStatus.reduce((acc: Tool[], tk: Toolkit) => {
          return acc.concat(tk.tools || []);
        }, []);
        setTools(allTools);
        
        alert(`${toolkit} connected successfully!`);
      }
      
    } catch (error) {
      console.error("Failed to connect toolkit:", error);
    }
  };

  const handleRevokeAccount = async (id: string | number) => {
    try {
      await TL.deleteConnection(String(id));
      if (user) {
        // Re-fetch connection information for all toolkits
        const toolkitData = await TL.listToolkits();
        const allConnections: any[] = [];
        for (const toolkit of toolkitData as any[]) {
          try {
            const connections = await TL.getToolkitConnections(toolkit.name);
            allConnections.push(...connections.map((conn: any) => ({
              ...conn,
              toolkit: toolkit.name,
              toolkit_name: toolkit.name // Add both for compatibility
            })));
          } catch (error) {
            console.warn(`Failed to get connections for toolkit ${toolkit.name}:`, error);
          }
        }
        setAccounts(allConnections);
      }
    } catch (error) {
      console.error("Failed to revoke account:", error);
    }
  };

  const handleRemoveOAuthAccount = async (accountId: number) => {
    try {
      await TL.removeOAuthAccount(accountId);
      const oauthData = await TL.listOAuthAccounts();
      setOAuthAccounts(oauthData as any[]);
    } catch (error) {
      console.error("Failed to remove OAuth account:", error);
    }
  };

  const handleExecuteTool = async (toolSlug: string, args: any) => {
    if (!user) return;
    
    try {
      const result = await TL.executeTool(toolSlug, args, { user_id: user.user_id });
      console.log("Tool execution result:", result);
      setExecutionResult({
        toolSlug,
        args,
        result,
        timestamp: new Date().toISOString()
      });
      setShowResult(true);
    } catch (error) {
      console.error("Failed to execute tool:", error);
      setExecutionResult({
        toolSlug,
        args,
        error: (error as Error).message || String(error) || 'Unknown error',
        timestamp: new Date().toISOString()
      });
      setShowResult(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Function to copy API key to clipboard
  const copyKeyToClipboard = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      alert("API key copied to clipboard");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Add modal dialog at the end of return statement
  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("api-keys")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "api-keys"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                API Keys
              </button>

              <button
                onClick={() => setActiveTab("oauth-accounts")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "oauth-accounts"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                OAuth Accounts
              </button>
            </nav>
          </div>
        </div>

        {activeTab === "api-keys" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-500">Create New API Key</h2>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="API Key Label"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <select
                  value={newKeyPrefix}
                  onChange={(e) => setNewKeyPrefix(e.target.value as "live" | "test")}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="live">Live</option>
                  <option value="test">Test</option>
                </select>
                <button
                  onClick={handleCreateApiKey}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Create
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {apiKeys.length > 0 ? (
                apiKeys.map((key) => (
                  <ApiKeyCard
                    key={key.id}
                    apiKey={key}
                    onDelete={handleDeleteApiKey}
                  />
                ))
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm text-center">
                  <p className="text-gray-600">You don&apos;t have any API keys yet. Create a new API key to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}



        {activeTab === "oauth-accounts" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-500">OAuth Account Management</h3>
              {oauthAccounts.length === 0 ? (
                <p className="text-gray-500">No OAuth accounts</p>
              ) : (
                <div className="space-y-3">
                  {oauthAccounts.map((account: any) => (
                    <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          {account.provider_display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{account.provider_display_name}</div>
                          <div className="text-sm text-gray-500">{account.email}</div>
                          <div className="text-xs text-gray-400">Connected: {new Date(account.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveOAuthAccount(account.id)}
                        className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
                    
                    {executionResult.result.execution_id && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Execution ID: {executionResult.result.execution_id}</span>
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

      {/* API Key creation success modal dialog */}
      {showKeyModal && newCreatedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">API Key Created Successfully</h3>
            <p className="text-sm text-red-600 mb-4">Please copy your API key immediately, it will only be shown once!</p>
            
            <div className="bg-gray-50 p-3 rounded border mb-4">
              <code className="block font-mono text-sm break-all">{newCreatedKey.key}</code>
            </div>
            
            <div className="flex justify-between">
              <button
                onClick={() => copyKeyToClipboard(newCreatedKey.key)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Copy Key
              </button>
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
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

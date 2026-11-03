'use client';

import { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { Tool } from '@/lib/types';

interface ToolExecutionDialogProps {
  tool: Tool | null;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (toolSlug: string, args: any) => Promise<any>;
}

export default function ToolExecutionDialog({
  tool,
  isOpen,
  onClose,
  onExecute
}: ToolExecutionDialogProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [fileParams, setFileParams] = useState<Record<string, File[]>>({});

  if (!isOpen || !tool) return null;

  const isOutputPathParam = (key: string) => {
    const lowered = key.toLowerCase();
    return lowered === 'output_path' || lowered === 'output_dir' || lowered.endsWith('_output_path') || lowered.endsWith('_output_dir');
  };

  const isFileParam = (key: string, param: any = {}) => {
    if (isOutputPathParam(key)) return false;
    if (param?.type === 'number' || param?.type === 'integer' || param?.type === 'boolean') return false;
    const lowered = key.toLowerCase();
    if (['format', 'unit', 'travel_mode', 'layer_name', 'src_layer', 'tar_layer'].includes(lowered)) return false;
    const description = String(param?.description || '').toLowerCase();
    const signal = `${lowered} ${description}`;
    return (
      lowered === 'image' ||
      lowered === 'images' ||
      lowered.endsWith('_path') ||
      lowered.endsWith('_paths') ||
      lowered.includes('geojson') ||
      lowered.includes('gpkg') ||
      lowered.includes('telemetry') ||
      lowered.includes('video') ||
      lowered.includes('raster') ||
      lowered.includes('shapefile') ||
      /^b\d{2}$/.test(lowered) ||
      /^(red|green|blue|nir|swir|qa|sr|lst|ndvi|fvc|dem|bt_day|bt_night|emis_day|emis_night)$/.test(lowered) ||
      /\b(path|file|geotiff|raster|geojson|gpkg|csv|gpx|mavlink|npy|video|shapefile)\b/.test(signal)
    );
  };

  const acceptsForParam = (key: string, param: any = {}) => {
    const signal = `${key} ${param?.description || ''}`.toLowerCase();
    if (signal.includes('image')) return 'image/*,.tif,.tiff,.npy';
    if (signal.includes('video')) return 'video/*,.mp4,.mov,.avi';
    if (signal.includes('telemetry') || signal.includes('gpx') || signal.includes('mavlink')) return '.csv,.gpx,.json';
    if (signal.includes('geojson')) return '.geojson,.json';
    if (signal.includes('gpkg')) return '.gpkg';
    if (signal.includes('shapefile')) return '.zip,.shp';
    if (signal.includes('npy')) return '.npy,.tif,.tiff';
    return '.tif,.tiff,.geotiff,.img,.vrt,.npy,.csv,.json,.geojson,.gpkg';
  };

  const allowsMultipleFiles = (key: string, param: any = {}) => {
    return key.endsWith('s') || key.endsWith('_paths') || param?.type === 'array';
  };

  const internalResultKeys = new Set([
    'metadata',
    'runtime_dir',
    'upload_dir',
    'output_dir',
    'artifact_dir',
    'scratch_dir',
    'manifest_path',
  ]);

  const basename = (path: string) => path.split(/[\\/]/).pop() || path;

  const collectRuntimeFileLinks = (value: any, key = ''): Array<{ label: string; path: string; filename: string }> => {
    const links: Array<{ label: string; path: string; filename: string }> = [];
    const fileExtPattern = /\.(tif|tiff|json|geojson|csv|gpx|gpkg|npy|png|jpg|jpeg|txt|zip)$/i;
    const pathKeyPattern = /(output_path|gpkg|artifact_path|file_path|telemetry_path|raster_path)$/i;

    if (internalResultKeys.has(key)) return links;

    if (typeof value === 'string' && (fileExtPattern.test(value) || pathKeyPattern.test(key))) {
      const filename = basename(value);
      links.push({ label: key || filename, path: value, filename });
      return links;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => links.push(...collectRuntimeFileLinks(item, `${key}[${index}]`)));
      return links;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        links.push(...collectRuntimeFileLinks(childValue, childKey));
      });
    }
    return links;
  };

  const sanitizeResultForDisplay = (value: any, key = ''): any => {
    if (internalResultKeys.has(key)) return undefined;

    if (typeof value === 'string') {
      const fileExtPattern = /\.(tif|tiff|json|geojson|csv|gpx|gpkg|npy|png|jpg|jpeg|txt|zip)$/i;
      const pathKeyPattern = /(output_path|gpkg|artifact_path|file_path|telemetry_path|raster_path)$/i;
      if (fileExtPattern.test(value) || pathKeyPattern.test(key)) return basename(value);
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item, index) => sanitizeResultForDisplay(item, `${key}[${index}]`))
        .filter((item) => item !== undefined);
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((acc, [childKey, childValue]) => {
        const sanitized = sanitizeResultForDisplay(childValue, childKey);
        if (sanitized !== undefined) acc[childKey] = sanitized;
        return acc;
      }, {} as Record<string, any>);
    }

    return value;
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const validateParameters = () => {
    if (!tool?.parameters?.required) return { isValid: true, errors: [] };
    
    const errors: string[] = [];
    const required = tool.parameters.required;
    
    required.forEach((paramKey: string) => {
      const value = parameters[paramKey];
      const param = tool.parameters.properties?.[paramKey];

      if (isOutputPathParam(paramKey)) return;

      const isUploadKey = isFileParam(paramKey, param);

      const isFileSatisfied =
        isUploadKey &&
        Array.isArray(fileParams[paramKey]) &&
        fileParams[paramKey].length > 0;

      if (!isFileSatisfied && (value === undefined || value === null || value === '')) {
        errors.push(`${paramKey}${param?.description ? ` (${param.description})` : ''} is required`);
      }
    });
    
    return { isValid: errors.length === 0, errors };
  };

  const handleExecute = async () => {
    const validation = validateParameters();
    if (!validation.isValid) {
      alert(`Parameter validation failed:\n${validation.errors.join('\n')}`);
      return;
    }
    
    setIsExecuting(true);
    setExecutionResult(null);
    setExecutionError(null);
    setShowResult(false);
    
    try {
      // Clean parameters, remove empty values
      const cleanedParameters = Object.entries(parameters).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
      
      const fileEntries = Object.entries(fileParams).filter(([, files]) => files.length > 0);
      const hasFiles = fileEntries.length > 0;
      if (hasFiles) {
        const form = new FormData();

        const uploadParamNames: string[] = [];
        const inputsWithoutFileValues = { ...cleanedParameters };
        fileEntries.forEach(([paramName, files]) => {
          delete inputsWithoutFileValues[paramName];
          files.forEach((file) => {
            uploadParamNames.push(paramName);
            form.append('files', file);
          });
        });

        form.append('inputs', JSON.stringify(inputsWithoutFileValues));
        form.append('metadata', JSON.stringify({ file_param_names: uploadParamNames }));
      
        const resp = await fetch(
          `/api/proxy/v1/gui/tools/${encodeURIComponent(tool.slug)}/execute-multipart`,
          { method: 'POST', body: form },
        );
      
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `HTTP ${resp.status}`);
        }
      
        const result = await resp.json();
        showExecutionResponse(result);
        return;
      } 

      const result = await onExecute(tool.slug, cleanedParameters);
      showExecutionResponse(result);
    } catch (error) {
      console.error('Tool execution failed:', error);
      setExecutionError(error instanceof Error ? error.message : 'Tool execution failed');
      setShowResult(true);
    } finally {
      setIsExecuting(false);
    }
  };

  // Terrabox reports handler failures in a 200 response with success=false.
  // Preserve the response for inspection and show the actual tool outcome.
  const showExecutionResponse = (result: any) => {
    setExecutionResult(result);
    const failure = [result, result?.outputs].find(value => value && (
      value.success === false || value.ok === false || value.execution_blocked === true
    ));
    if (failure) {
      const error = failure.error || failure.reason_code || 'The tool reported a failed execution';
      setExecutionError(typeof error === 'string' ? error : error.message || JSON.stringify(error));
    }
    setShowResult(true);
  };

  const handleClose = () => {
    onClose();
    setParameters({});
    setFileParams({}); // Reset file parameters to avoid file accumulation
    setExecutionResult(null);
    setExecutionError(null);
    setShowResult(false);
  };

  const renderParameterInput = (key: string, param: any) => {
    const value = parameters[key] ?? param.default ?? '';
    const isRequired = (tool?.parameters?.required?.includes(key) || false) && !isOutputPathParam(key);
    const isUploadParam = isFileParam(key, param);
    
    const handleChange = (newValue: any) => {
      setParameters(prev => ({
        ...prev,
        [key]: newValue
      }));
    };

    const baseInputClass = "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors text-gray-900";
    const inputClass = `${baseInputClass} ${isRequired && !value ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}`;

    if (isUploadParam) {
      const multiple = allowsMultipleFiles(key, param);
      const files = fileParams[key] || [];
    
      const handleFilesChange = (selected: File[]) => {
        setFileParams(prev => ({
          ...prev,
          [key]: selected
        }));
        handleChange(undefined);
      };
    
      const handleRemoveFile = (index: number) => {
        const next = [...files];
        next.splice(index, 1);
        handleFilesChange(next);
      };
    
      return (
        <div className="space-y-3">
          <div className="inline-flex items-center">
            <label className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 cursor-pointer transition-colors">
              <span className="mr-2">
                {multiple ? 'Upload Files' : 'Upload File'}
              </span>
              <input
                type="file"
                accept={acceptsForParam(key, param)}
                multiple={multiple}
                className="hidden"
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  handleFilesChange(selected);
                }}
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {files.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
                >
                  <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onLoad={(e) => {
                          URL.revokeObjectURL((e.target as HTMLImageElement).src);
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <FileText size={28} />
                        <span className="text-[10px] uppercase">{file.name.split('.').pop() || 'file'}</span>
                      </div>
                    )}
                  </div>
    
                  <div className="px-2 py-1 text-xs text-gray-700 truncate">
                    {file.name}
                  </div>
    
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
    
          {files.length === 0 && (
            <p className="text-xs text-gray-500">
              {multiple
                ? 'No files selected. Click "Upload Files" to choose multiple files.'
                : 'No file selected. Click "Upload File" to choose a file.'}
            </p>
          )}
        </div>
      );
    }
    
    switch (param.type) {
      case 'string':
        // Check if there are enum values
        if (param.enum && Array.isArray(param.enum)) {
          return (
            <select
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className={inputClass}
            >
              <option value="">Please select...</option>
              {param.enum.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          );
        }
        // Check if it's long text
        if (param.format === 'textarea' || (param.maxLength && param.maxLength > 100)) {
          return (
            <textarea
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className={inputClass}
              placeholder={param.description || `Enter ${key}`}
              rows={3}
              maxLength={param.maxLength}
            />
          );
        }
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClass}
            placeholder={param.description || `Enter ${key}`}
            maxLength={param.maxLength}
            pattern={param.pattern}
          />
        );
      
      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
                handleChange(raw);
              } else if (param.type === 'integer') {
                const n = parseInt(raw, 10);
                handleChange(Number.isNaN(n) ? '' : n);
              } else {
                const n = parseFloat(raw);
                handleChange(Number.isNaN(n) ? '' : n);
              }
            }}
            className={inputClass}
            placeholder={param.description || `Enter ${key}`}
            min={param.minimum}
            max={param.maximum}
            step={param.type === 'integer' ? 1 : 'any'}
          />
        );
      
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => handleChange(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">
              {param.description || key}
            </span>
          </div>
        );
      
      case 'array':
        return (
          <div className="space-y-2">
            <textarea
              value={Array.isArray(value) ? value.join('\n') : value}
              onChange={(e) => {
                const lines = e.target.value.split('\n').filter(line => line.trim());
                handleChange(lines);
              }}
              className={inputClass}
              placeholder={param.description || `Enter one ${key} item per line`}
              rows={3}
            />
            <p className="text-xs text-gray-500">Enter one item per line</p>
          </div>
        );
      
      case 'object':
        return (
          <textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleChange(parsed);
              } catch {
                handleChange(e.target.value);
              }
            }}
            className={inputClass}
            placeholder={param.description || `Enter JSON format for ${key}`}
            rows={4}
          />
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={inputClass}
            placeholder={param.description || `Enter ${key}`}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-400">Execute Tool: {tool.name}</h2>
            {tool.description && (
              <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {!showResult ? (
            // Parameter configuration interface
            tool.parameters && tool.parameters.properties && Object.keys(tool.parameters.properties).length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Parameter Configuration</h3>
                {Object.entries(tool.parameters.properties).map(([key, param]: [string, any]) => {
                  const isRequired = tool.parameters.required?.includes(key);
                  const isUploadKey = isFileParam(key, param);
                  const hasFileValue =
                    isUploadKey &&
                    Array.isArray(fileParams[key]) &&
                    fileParams[key].length > 0;
                  
                  const hasValue =
                    hasFileValue ||
                    (parameters[key] !== undefined && parameters[key] !== null && parameters[key] !== '');
                  
                  return (
                    <div key={key} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        <span className="flex items-center justify-between">
                          <span>
                            {key}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                          </span>
                          <span className="text-xs text-gray-400 font-normal">
                            {param.type}
                            {param.format && ` (${param.format})`}
                          </span>
                        </span>
                      </label>
                      {renderParameterInput(key, param)}
                      <div className="flex justify-between items-start">
                        {param.description && (
                          <p className="text-xs text-gray-500 flex-1">{param.description}</p>
                        )}
                        {isRequired && !hasValue && (
                          <p className="text-xs text-red-500 ml-2">Required</p>
                  )}
                </div>
                {/* Display parameter constraint information */}
                 {(param.minimum !== undefined || param.maximum !== undefined || param.maxLength || param.enum) && (
                   <p className="text-xs text-gray-500 mt-1">
                     {param.minimum !== undefined && `Min: ${param.minimum}`}
                     {param.maximum !== undefined && ` Max: ${param.maximum}`}
                     {param.maxLength && ` Max length: ${param.maxLength}`}
                     {param.enum && ` Options: ${param.enum.join(', ')}`}
                   </p>
                 )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">This tool requires no parameter configuration</p>
              </div>
            )
          ) : (
            // Execution result interface
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Execution Result</h3>
              {executionError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-red-800 font-medium mb-2">Execution Failed</h4>
                  <p className="text-red-700 text-sm">{executionError}</p>
                  {executionResult && (
                    <pre className="mt-3 text-sm text-gray-800 whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {JSON.stringify(sanitizeResultForDisplay(executionResult), null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-green-800 font-medium mb-2">Execution Successful</h4>
                  <div className="bg-white border rounded p-3 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                      {typeof executionResult === 'string'
                        ? executionResult
                        : JSON.stringify(sanitizeResultForDisplay(executionResult), null, 2)
                      }
                    </pre>
                  </div>
                  {collectRuntimeFileLinks(executionResult?.outputs ?? executionResult).length > 0 && (
                    <div className="mt-3 rounded border border-green-200 bg-white p-3">
                      <h5 className="text-sm font-medium text-green-900 mb-2">Output Files</h5>
                      <div className="space-y-2">
                        {collectRuntimeFileLinks(executionResult?.outputs ?? executionResult).map((file, index) => (
                          <a
                            key={`${file.path}-${index}`}
                            href={`/api/proxy/v1/gui/runtime/files?path=${encodeURIComponent(file.path)}`}
                            className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download size={14} />
                            <span className="truncate">{file.filename}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          {!showResult ? (
            // Parameter configuration stage buttons
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className="px-4 py-2 bg-blue-500 text-black rounded-md hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
              >
                {isExecuting ? 'Executing...' : 'Execute Tool'}
              </button>
            </>
          ) : (
            // Result display stage buttons
            <>
              <button
                onClick={() => setShowResult(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

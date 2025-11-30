'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Strategy, FlowStep, FlowBasedStrategyModel, StrategyModel } from '@/types';
import { updateVisualBuilderModel, generateCodeFromModel } from '@/lib/api/strategies';
import { useDebounce } from '@/hooks/useDebounce';

interface FlowBasedVisualBuilderProps {
  currentStrategy: Strategy | null;
  onStrategyUpdate: () => void;
  onModelChange?: (model: FlowBasedStrategyModel) => void;
}

export default function FlowBasedVisualBuilder({
  currentStrategy,
  onStrategyUpdate,
  onModelChange,
}: FlowBasedVisualBuilderProps) {
  const [flow, setFlow] = useState<FlowStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  // Initialize flow from strategy model
  useEffect(() => {
    if (currentStrategy?.strategy_model) {
      const model = currentStrategy.strategy_model as FlowBasedStrategyModel;
      if (model.flow && Array.isArray(model.flow)) {
        // Sort by order
        const sortedFlow = [...model.flow].sort((a, b) => 
          (a.order || 0) - (b.order || 0)
        );
        setFlow(sortedFlow);
      } else {
        // Convert legacy model to flow (if needed)
        const convertedFlow = convertLegacyModelToFlow(model);
        setFlow(convertedFlow);
      }
    } else {
      setFlow([]);
    }
  }, [currentStrategy?.strategy_model]);

  // Debounce flow changes for auto-save
  const debouncedFlow = useDebounce(flow, 2000);

  // Save flow function
  const saveFlow = useCallback(async (flowToSave: FlowStep[], generateCode: boolean = false) => {
    if (!currentStrategy?.id) return;

    setIsSaving(true);
    if (generateCode) {
      setIsGeneratingCode(true);
    }

    try {
      const model: FlowBasedStrategyModel = {
        meta: {
          class_name: currentStrategy.name?.replace(/\s+/g, '') || 'Strategy',
          version: '2.0',
        },
        flow: flowToSave,
      };

      await updateVisualBuilderModel(currentStrategy.id, model, generateCode);

      // Refresh strategy to get updated code
      if (generateCode) {
        setTimeout(() => {
          onStrategyUpdate();
        }, 500);
      }

      onModelChange?.(model);
    } catch (error) {
      console.error('[FLOW_BUILDER] Failed to save flow:', error);
    } finally {
      setIsSaving(false);
      setIsGeneratingCode(false);
    }
  }, [currentStrategy?.id, currentStrategy?.name, onStrategyUpdate, onModelChange]);

  // Auto-save flow when it changes (without generating code)
  useEffect(() => {
    if (debouncedFlow.length > 0 && currentStrategy?.id && !isGeneratingCode) {
      saveFlow(debouncedFlow, false);
    }
  }, [debouncedFlow, currentStrategy?.id, isGeneratingCode, saveFlow]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFlow((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newFlow = arrayMove(items, oldIndex, newIndex);
        
        // Update order property
        return newFlow.map((step, index) => ({
          ...step,
          order: index + 1,
        }));
      });
    }
  };

  const handleStepChange = (stepId: string, updates: Partial<FlowStep>) => {
    setFlow((currentFlow) =>
      currentFlow.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  const handleAddStep = (stepType: FlowStep['type']) => {
    const newStep: FlowStep = {
      id: `step_${Date.now()}`,
      type: stepType,
      order: flow.length + 1,
      title: getDefaultTitle(stepType),
      data: getDefaultData(stepType),
      depends_on: [],
    };
    setFlow([...flow, newStep]);
  };

  const handleDeleteStep = (stepId: string) => {
    setFlow((currentFlow) => {
      const filtered = currentFlow.filter((step) => step.id !== stepId);
      return filtered.map((step, index) => ({
        ...step,
        order: index + 1,
      }));
    });
  };

  const handleGenerateCode = () => {
    saveFlow(flow, true);
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-white">Strategy Flow</h3>
        <div className="flex gap-2 items-center">
          {isSaving && (
            <span className="text-sm text-gray-400">Saving...</span>
          )}
          <button
            onClick={handleGenerateCode}
            disabled={isGeneratingCode || flow.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isGeneratingCode ? 'Generating Code...' : 'Generate Code'}
          </button>
        </div>
      </div>

      {/* Step Palette */}
      <div className="border-b border-gray-700 p-2 flex gap-2 flex-shrink-0">
        <button
          onClick={() => handleAddStep('indicator')}
          className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
        >
          + Indicator
        </button>
        <button
          onClick={() => handleAddStep('condition')}
          className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
        >
          + Condition
        </button>
        <button
          onClick={() => handleAddStep('action')}
          className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
        >
          + Action
        </button>
        <button
          onClick={() => handleAddStep('risk')}
          className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
        >
          + Risk
        </button>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={flow.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {flow.map((step) => (
                <SortableStep
                  key={step.id}
                  step={step}
                  onUpdate={(updates) => handleStepChange(step.id, updates)}
                  onDelete={() => handleDeleteStep(step.id)}
                />
              ))}
              {flow.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <p className="mb-2">No steps yet.</p>
                  <p className="text-sm">Add steps using the buttons above.</p>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// Sortable Step Component
function SortableStep({
  step,
  onUpdate,
  onDelete,
}: {
  step: FlowStep;
  onUpdate: (updates: Partial<FlowStep>) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stepColors = {
    indicator: 'bg-blue-600',
    condition: 'bg-yellow-600',
    action: 'bg-green-600',
    risk: 'bg-red-600',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-gray-700 rounded-lg p-4 bg-gray-800 ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-300 text-xl pt-1"
          title="Drag to reorder"
        >
          ⋮⋮
        </div>

        {/* Step Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 rounded text-xs font-semibold ${
                stepColors[step.type]
              } text-white`}
            >
              {step.type.toUpperCase()}
            </span>
            <span className="text-gray-400 text-sm">#{step.order}</span>
          </div>

          <EditableStepContent step={step} onUpdate={onUpdate} />

          <button
            onClick={onDelete}
            className="mt-2 text-red-400 hover:text-red-300 text-sm transition-colors"
          >
            Delete Step
          </button>
        </div>
      </div>
    </div>
  );
}

// Editable Step Content Component
function EditableStepContent({
  step,
  onUpdate,
}: {
  step: FlowStep;
  onUpdate: (updates: Partial<FlowStep>) => void;
}) {
  if (step.type === 'indicator') {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Step title (e.g., Calculate SMA(20))"
        />
        <select
          value={step.data.indicator_type || ''}
          onChange={(e) =>
            onUpdate({
              data: { ...step.data, indicator_type: e.target.value },
            })
          }
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select indicator</option>
          <option value="SMA">SMA (Simple Moving Average)</option>
          <option value="EMA">EMA (Exponential Moving Average)</option>
          <option value="RSI">RSI (Relative Strength Index)</option>
          <option value="MACD">MACD</option>
          <option value="Highest">Highest</option>
          <option value="Lowest">Lowest</option>
        </select>
        {step.data.indicator_type && (
          <>
            <select
              value={step.data.source || 'close'}
              onChange={(e) =>
                onUpdate({
                  data: { ...step.data, source: e.target.value },
                })
              }
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="close">Close</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="open">Open</option>
            </select>
            {['SMA', 'EMA', 'RSI', 'Highest', 'Lowest'].includes(
              step.data.indicator_type
            ) && (
              <input
                type="number"
                value={step.data.period || ''}
                onChange={(e) =>
                  onUpdate({
                    data: {
                      ...step.data,
                      period: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Period (e.g., 20)"
                min="1"
              />
            )}
          </>
        )}
      </div>
    );
  }

  if (step.type === 'condition') {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Step title (e.g., Check if price crosses above SMA)"
        />
        <select
          value={step.data.condition_type || ''}
          onChange={(e) =>
            onUpdate({
              data: { ...step.data, condition_type: e.target.value },
            })
          }
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select condition type</option>
          <option value="price_above">Price Above</option>
          <option value="price_below">Price Below</option>
          <option value="indicator_cross">Indicator Cross</option>
          <option value="breakout">Price Breakout</option>
        </select>
        {step.data.condition_type && (
          <div className="space-y-2">
            <input
              type="text"
              value={step.data.left_operand || ''}
              onChange={(e) =>
                onUpdate({
                  data: { ...step.data, left_operand: e.target.value },
                })
              }
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Left operand (e.g., close, sma_20)"
            />
            <select
              value={step.data.operator || ''}
              onChange={(e) =>
                onUpdate({
                  data: { ...step.data, operator: e.target.value },
                })
              }
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select operator</option>
              <option value=">">Greater than (&gt;)</option>
              <option value="<">Less than (&lt;)</option>
              <option value=">=">Greater than or equal (&gt;=)</option>
              <option value="<=">Less than or equal (&lt;=)</option>
              <option value="cross_above">Crosses Above</option>
              <option value="cross_below">Crosses Below</option>
            </select>
            <input
              type="text"
              value={step.data.right_operand || ''}
              onChange={(e) =>
                onUpdate({
                  data: { ...step.data, right_operand: e.target.value },
                })
              }
              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Right operand (e.g., resistance, sma_50)"
            />
          </div>
        )}
      </div>
    );
  }

  if (step.type === 'action') {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Step title (e.g., Buy Signal)"
        />
        <select
          value={step.data.action_type || ''}
          onChange={(e) =>
            onUpdate({
              data: { ...step.data, action_type: e.target.value },
            })
          }
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select action</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="close_position">Close Position</option>
        </select>
        {step.data.action_type && (
          <input
            type="text"
            value={step.data.quantity || 'all'}
            onChange={(e) =>
              onUpdate({
                data: { ...step.data, quantity: e.target.value },
              })
            }
            className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Quantity (e.g., 'all' or number)"
          />
        )}
      </div>
    );
  }

  if (step.type === 'risk') {
    return (
      <div className="space-y-2">
        <input
          type="text"
          value={step.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Step title (e.g., Stop Loss at 2%)"
        />
        <select
          value={step.data.risk_type || ''}
          onChange={(e) =>
            onUpdate({
              data: { ...step.data, risk_type: e.target.value },
            })
          }
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select risk type</option>
          <option value="stop_loss">Stop Loss</option>
          <option value="take_profit">Take Profit</option>
          <option value="trailing_stop">Trailing Stop</option>
        </select>
        {step.data.risk_type && (
          <input
            type="number"
            value={step.data.value || ''}
            onChange={(e) =>
              onUpdate({
                data: {
                  ...step.data,
                  value: parseFloat(e.target.value) || undefined,
                },
              })
            }
            className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Percentage (e.g., 2 for 2%)"
            min="0"
            step="0.1"
          />
        )}
      </div>
    );
  }

  return null;
}

// Helper functions
function getDefaultTitle(type: FlowStep['type']): string {
  const titles = {
    indicator: 'New Indicator',
    condition: 'New Condition',
    action: 'New Action',
    risk: 'New Risk Management',
  };
  return titles[type];
}

function getDefaultData(type: FlowStep['type']): FlowStep['data'] {
  const defaults = {
    indicator: { indicator_type: '', source: 'close', period: 20 },
    condition: { condition_type: '', left_operand: '', operator: '', right_operand: '' },
    action: { action_type: '', quantity: 'all' },
    risk: { risk_type: '', value: 0 },
  };
  return defaults[type];
}

function convertLegacyModelToFlow(model: any): FlowStep[] {
  // Convert legacy model structure to flow
  const flow: FlowStep[] = [];
  let order = 1;

  // Add indicators
  if (model.indicators) {
    model.indicators.forEach((ind: any, idx: number) => {
      flow.push({
        id: `ind_${idx}`,
        type: 'indicator',
        order: order++,
        title: `${ind.type}(${ind.period || ''})`,
        data: {
          indicator_type: ind.type,
          source: ind.source || 'close',
          period: ind.period,
        },
        depends_on: [],
      });
    });
  }

  // Add entries
  if (model.entries) {
    model.entries.forEach((entry: any, idx: number) => {
      flow.push({
        id: `entry_${idx}`,
        type: 'condition',
        order: order++,
        title: entry.description || 'Entry Condition',
        data: {
          condition_type: entry.type,
        },
        depends_on: [],
      });
    });
  }

  // Add actions (buy)
  if (model.entries && model.entries.length > 0) {
    flow.push({
      id: 'action_buy',
      type: 'action',
      order: order++,
      title: 'Buy Signal',
      data: {
        action_type: 'buy',
        quantity: 'all',
      },
      depends_on: model.entries.map((_: any, idx: number) => `entry_${idx}`),
    });
  }

  // Add risk
  if (model.risk) {
    if (model.risk.stop_loss_pct) {
      flow.push({
        id: 'risk_stop_loss',
        type: 'risk',
        order: order++,
        title: 'Stop Loss',
        data: {
          risk_type: 'stop_loss',
          value: model.risk.stop_loss_pct,
        },
        depends_on: ['action_buy'],
      });
    }
  }

  return flow;
}


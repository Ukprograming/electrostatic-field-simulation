import React, { useState } from 'react';
import { Plus, Minus, Trash2, ArrowLeftRight, ChevronDown } from 'lucide-react';
import {
  PointCharge,
  ChargeColumn,
  SimulationModel,
  FieldDisplayMode,
} from '../physics/electrostatics';

interface ControlDeckProps {
  simulationModel: SimulationModel;
  isCapacitorMode: boolean;
  charges: PointCharge[];
  selectedChargeId: string | null;
  columns: ChargeColumn[];
  selectedColumnId: string | null;
  fieldMode: FieldDisplayMode;
  showEquipotentials: boolean;
  showPotentialTint: boolean;
  snapToInteger: boolean;
  onSimulationModelChange: (model: SimulationModel) => void;
  onFieldModeChange: (mode: FieldDisplayMode) => void;
  onToggleEquipotentials: () => void;
  onTogglePotentialTint: () => void;
  onToggleSnap: () => void;
  onQuickAddCharge: (q: number) => void;
  onUpdateChargeQ: (id: string, q: number) => void;
  onDeleteCharge: (id: string) => void;
  onClearAllCharges: () => void;
  onQuickAddColumn: (q: number) => void;
  onUpdateColumnQ: (id: string, q: number) => void;
  onDeleteColumn: (id: string) => void;
  onClearAllColumns: () => void;
}

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

const SwitchRow: React.FC<SwitchRowProps> = ({ label, checked, onToggle }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <span className="text-sm text-slate-700">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
        checked
          ? 'bg-slate-900 border-slate-900'
          : 'bg-slate-200 border-slate-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform duration-150 ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export const ControlDeck: React.FC<ControlDeckProps> = ({
  simulationModel,
  isCapacitorMode,
  charges,
  selectedChargeId,
  columns,
  selectedColumnId,
  fieldMode,
  showEquipotentials,
  showPotentialTint,
  snapToInteger,
  onSimulationModelChange,
  onFieldModeChange,
  onToggleEquipotentials,
  onTogglePotentialTint,
  onToggleSnap,
  onQuickAddCharge,
  onUpdateChargeQ,
  onDeleteCharge,
  onClearAllCharges,
  onQuickAddColumn,
  onUpdateColumnQ,
  onDeleteColumn,
  onClearAllColumns,
}) => {
  const [showGuide, setShowGuide] = useState(false);

  const isUniform = simulationModel === 'uniform';
  const selectedCharge =
    charges.find((c) => c.id === selectedChargeId) ?? null;
  const selectedColumn =
    columns.find((c) => c.id === selectedColumnId) ?? null;

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col lg:h-full lg:overflow-y-auto">
      {/* Model Switcher */}
      <section className="px-5 pt-4 pb-4 border-b border-slate-100 space-y-2.5">
        <h2 className="text-xs font-semibold text-slate-500">モデル</h2>
        <div
          role="tablist"
          aria-label="電場モデル切り替え"
          className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isUniform}
            onClick={() => onSimulationModelChange('point')}
            className={`px-2 py-2 min-h-[40px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              !isUniform
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            点電荷
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isUniform}
            onClick={() => onSimulationModelChange('uniform')}
            className={`px-2 py-2 min-h-[40px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              isUniform
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            一様な電場
          </button>
        </div>
      </section>

      {/* Chunk 1: Display Mode */}
      <section className="p-5 border-b border-slate-100 space-y-4">
        <h2 className="text-xs font-semibold text-slate-500">表示</h2>

        <div
          role="tablist"
          aria-label="電場の表示モード"
          className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={fieldMode === 'none'}
            onClick={() => onFieldModeChange('none')}
            className={`px-1.5 py-2 min-h-[40px] text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              fieldMode === 'none'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            なし
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={fieldMode === 'lines'}
            onClick={() => onFieldModeChange('lines')}
            className={`px-1.5 py-2 min-h-[40px] text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              fieldMode === 'lines'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            電気力線
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={fieldMode === 'vectors'}
            onClick={() => onFieldModeChange('vectors')}
            className={`px-1.5 py-2 min-h-[40px] text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              fieldMode === 'vectors'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ベクトル
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={fieldMode === 'both'}
            onClick={() => onFieldModeChange('both')}
            className={`px-1.5 py-2 min-h-[40px] text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              fieldMode === 'both'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            両方
          </button>
        </div>

        <div className="space-y-1">
          <SwitchRow
            label="電位の等高線"
            checked={showEquipotentials}
            onToggle={onToggleEquipotentials}
          />
          <SwitchRow
            label="電位の濃淡"
            checked={showPotentialTint}
            onToggle={onTogglePotentialTint}
          />
          <SwitchRow
            label="整数座標にスナップ"
            checked={snapToInteger}
            onToggle={onToggleSnap}
          />
        </div>
      </section>

      {/* Chunk 2: Add Charge or Charge Column */}
      {isUniform ? (
        <section className="p-5 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500">
              電荷の列を追加
            </h2>
            {columns.length > 0 && (
              <button
                type="button"
                onClick={onClearAllColumns}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                すべて消去
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onQuickAddColumn(2.0)}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] text-xs font-semibold text-red-700 bg-red-50/80 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              正電荷の列
            </button>
            <button
              type="button"
              onClick={() => onQuickAddColumn(-2.0)}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2.5 min-h-[44px] text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5 shrink-0" />
              負電荷の列
            </button>
          </div>
        </section>
      ) : (
        <section className="p-5 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-500">電荷を追加</h2>
            {charges.length > 0 && (
              <button
                type="button"
                onClick={onClearAllCharges}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                すべて消去
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onQuickAddCharge(2.0)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-red-700 bg-red-50/80 hover:bg-red-100 border border-red-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              正電荷
            </button>
            <button
              type="button"
              onClick={() => onQuickAddCharge(-2.0)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5 shrink-0" />
              負電荷
            </button>
          </div>
        </section>
      )}

      {/* Chunk 3: Selected Charge or Column Inspector */}
      {isUniform ? (
        <section className="p-5 border-b border-slate-100 space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-500">
              選択中の電荷の列
            </h2>
            {isCapacitorMode && (
              <span className="text-[11px] font-medium text-slate-500">
                正・負が等量で連動
              </span>
            )}
          </div>

          {selectedColumn ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${
                      selectedColumn.q > 0
                        ? 'bg-red-600'
                        : selectedColumn.q < 0
                          ? 'bg-blue-600'
                          : 'bg-slate-500'
                    }`}
                  >
                    {selectedColumn.q > 0
                      ? '+'
                      : selectedColumn.q < 0
                        ? '−'
                        : '0'}
                  </span>
                  <span className="font-mono-tabular text-xs text-slate-500">
                    x = {selectedColumn.x.toFixed(1)} m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteColumn(selectedColumn.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-red-600 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  削除
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="column-q-slider"
                    className="text-sm font-medium text-slate-700"
                  >
                    電気量 (密度)
                  </label>
                  <span
                    className={`font-mono-tabular text-base font-semibold ${
                      selectedColumn.q > 0
                        ? 'text-red-700'
                        : selectedColumn.q < 0
                          ? 'text-blue-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {selectedColumn.q > 0
                      ? '+'
                      : selectedColumn.q < 0
                        ? '−'
                        : ''}
                    {Math.abs(selectedColumn.q).toFixed(1)}
                  </span>
                </div>

                <input
                  id="column-q-slider"
                  type="range"
                  min={-5}
                  max={5}
                  step={0.5}
                  value={selectedColumn.q}
                  onChange={(e) =>
                    onUpdateColumnQ(
                      selectedColumn.id,
                      parseFloat(e.target.value)
                    )
                  }
                  style={{
                    background:
                      'linear-gradient(to right, #2563EB 0%, #94A3B8 50%, #DC2626 100%)',
                  }}
                  className="physics-slider w-full cursor-pointer"
                />

                <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400">
                  <span>−5</span>
                  <span>0</span>
                  <span>+5</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onUpdateColumnQ(selectedColumn.id, -selectedColumn.q)
                }
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                符号を反転 (±)
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-2">
              図上の電荷の列をタップまたはクリックすると電気量を変更できます
            </p>
          )}
        </section>
      ) : (
        <section className="p-5 border-b border-slate-100 space-y-4 flex-1">
          <h2 className="text-xs font-semibold text-slate-500">選択中の電荷</h2>

          {selectedCharge ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold ${
                      selectedCharge.q > 0
                        ? 'bg-red-600'
                        : selectedCharge.q < 0
                          ? 'bg-blue-600'
                          : 'bg-slate-500'
                    }`}
                  >
                    {selectedCharge.q > 0
                      ? '+'
                      : selectedCharge.q < 0
                        ? '−'
                        : '0'}
                  </span>
                  <span className="font-mono-tabular text-xs text-slate-500">
                    ({selectedCharge.x.toFixed(1)},{' '}
                    {selectedCharge.y.toFixed(1)}) m
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteCharge(selectedCharge.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-red-600 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  削除
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="charge-q-slider"
                    className="text-sm font-medium text-slate-700"
                  >
                    電気量 q
                  </label>
                  <span
                    className={`font-mono-tabular text-base font-semibold ${
                      selectedCharge.q > 0
                        ? 'text-red-700'
                        : selectedCharge.q < 0
                          ? 'text-blue-700'
                          : 'text-slate-700'
                    }`}
                  >
                    {selectedCharge.q > 0
                      ? '+'
                      : selectedCharge.q < 0
                        ? '−'
                        : ''}
                    {Math.abs(selectedCharge.q).toFixed(1)} μC
                  </span>
                </div>

                <input
                  id="charge-q-slider"
                  type="range"
                  min={-5}
                  max={5}
                  step={0.5}
                  value={selectedCharge.q}
                  onChange={(e) =>
                    onUpdateChargeQ(
                      selectedCharge.id,
                      parseFloat(e.target.value)
                    )
                  }
                  style={{
                    background:
                      'linear-gradient(to right, #2563EB 0%, #94A3B8 50%, #DC2626 100%)',
                  }}
                  className="physics-slider w-full cursor-pointer"
                />

                <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400">
                  <span>−5</span>
                  <span>0</span>
                  <span>+5</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onUpdateChargeQ(selectedCharge.id, -selectedCharge.q)
                }
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                符号を反転 (±)
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-2">
              図上の電荷をタップまたはクリックすると電気量を変更できます
            </p>
          )}
        </section>
      )}

      {/* Progressive Disclosure: Collapsed Formula Hint */}
      <section className="px-5 py-3.5">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          aria-expanded={showGuide}
          className="w-full min-h-[40px] flex items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <span>公式・ポイントを見る</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              showGuide ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showGuide && (
          <div className="mt-2 pb-2 space-y-2 text-xs text-slate-600 leading-relaxed">
            {isUniform ? (
              <>
                <div className="font-mono-tabular text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-1">
                  <div>E = 一定 [N/C] (列の両側で一様)</div>
                  <div>V = −E · Δx [V] (基準: 原点 V = 0)</div>
                </div>
                <p>
                  正電荷の列と負電荷の列の電気量が等しいとき、列の外側では電場が打ち消し合って 0 になります。3D視点では電位が直線的に傾く様子が確認できます。
                </p>
              </>
            ) : (
              <>
                <div className="font-mono-tabular text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-1">
                  <div>E = k |q| / r² [N/C]</div>
                  <div>V = k q / r [V]</div>
                </div>
                <p>
                  縦軸は電位 V を表します。視点を横に回すと、同じ等電位線が水平に同じ高さで並んでいることが確認できます。
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </aside>
  );
};


import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  ArrowLeftRight,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Lock,
} from 'lucide-react';
import {
  PointCharge,
  ChargeColumn,
  SimulationModel,
  FieldDisplayMode,
  InteractionMode,
  ParticleRunState,
  resolveCapacitorColumns,
} from '../physics/electrostatics';

interface ControlDeckProps {
  simulationModel: SimulationModel;
  isCapacitorMode: boolean;
  interactionMode: InteractionMode;
  charges: PointCharge[];
  selectedChargeId: string | null;
  columns: ChargeColumn[];
  selectedColumnId: string | null;
  fieldMode: FieldDisplayMode;
  showEquipotentials: boolean;
  showPotentialTint: boolean;
  snapToInteger: boolean;
  particleAnchor: { x: number; y: number } | null;
  particleSign: 1 | -1;
  particleRunState: ParticleRunState;
  showParticleForce: boolean;
  onSimulationModelChange: (model: SimulationModel) => void;
  onFieldModeChange: (mode: FieldDisplayMode) => void;
  onToggleFieldLines: () => void;
  onToggleEquipotentials: () => void;
  onTogglePotentialTint: () => void;
  onToggleSnap: () => void;
  onQuickAddCharge: (q: number) => void;
  onUpdateChargeQ: (id: string, q: number) => void;
  onDeleteCharge: (id: string) => void;
  onClearAllCharges: () => void;
  onQuickAddColumn: (q: number) => void;
  onUpdateColumnQ: (id: string, q: number) => void;
  onUpdateColumnPotential: (id: string, potentialVolts: number) => void;
  onSwapCapacitorPotentials: () => void;
  onDeleteColumn: (id: string) => void;
  onClearAllColumns: () => void;
  onParticleSignChange: (sign: 1 | -1) => void;
  onToggleParticleRun: () => void;
  onResetParticle: () => void;
  onRemoveParticle: () => void;
  onToggleParticleForce: () => void;
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
  interactionMode,
  charges,
  selectedChargeId,
  columns,
  selectedColumnId,
  fieldMode,
  showEquipotentials,
  showPotentialTint,
  snapToInteger,
  particleAnchor,
  particleSign,
  particleRunState,
  showParticleForce,
  onSimulationModelChange,
  onFieldModeChange,
  onToggleFieldLines,
  onToggleEquipotentials,
  onTogglePotentialTint,
  onToggleSnap,
  onQuickAddCharge,
  onUpdateChargeQ,
  onDeleteCharge,
  onClearAllCharges,
  onQuickAddColumn,
  onUpdateColumnQ,
  onUpdateColumnPotential,
  onSwapCapacitorPotentials,
  onDeleteColumn,
  onClearAllColumns,
  onParticleSignChange,
  onToggleParticleRun,
  onResetParticle,
  onRemoveParticle,
  onToggleParticleForce,
}) => {
  const [showGuide, setShowGuide] = useState(false);

  const isUniform = simulationModel === 'uniform';
  const isParticleMode = interactionMode === 'particle';
  const isFieldLinesOn = fieldMode === 'lines' || fieldMode === 'both';

  const isCapPotentialMode =
    isUniform &&
    isCapacitorMode &&
    columns.length === 2 &&
    columns[0].potentialVolts !== undefined &&
    columns[1].potentialVolts !== undefined;
  const resolvedCapColumns = isCapPotentialMode
    ? resolveCapacitorColumns(columns)
    : columns;
  const selectedCharge =
    charges.find((c) => c.id === selectedChargeId) ?? null;
  const selectedColumn =
    columns.find((c) => c.id === selectedColumnId) ?? null;

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col lg:h-full lg:overflow-y-auto">
      {/* Model Switcher (Locked in Particle Mode) */}
      <section className="px-5 pt-4 pb-4 border-b border-slate-100 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-slate-500">モデル</h2>
          {isParticleMode && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Lock className="w-3 h-3" />
              電位固定中
            </span>
          )}
        </div>
        <div
          role="tablist"
          aria-label="電場モデル切り替え"
          className={`grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg ${
            isParticleMode ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isUniform}
            disabled={isParticleMode}
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
            disabled={isParticleMode}
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

        {!isParticleMode && (
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
        )}

        <div className="space-y-1">
          {isParticleMode && (
            <>
              <SwitchRow
                label="受ける力のベクトル"
                checked={showParticleForce}
                onToggle={onToggleParticleForce}
              />
              <SwitchRow
                label="電気力線"
                checked={isFieldLinesOn}
                onToggle={onToggleFieldLines}
              />
            </>
          )}
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

      {/* Chunk 2 & 3: Either Test Particle Controls OR Charge/Column Editing */}
      {isParticleMode ? (
        <section className="p-5 border-b border-slate-100 space-y-4 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-500">荷電粒子</h2>
            {particleAnchor && (
              <button
                type="button"
                onClick={onRemoveParticle}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                粒子を消す
              </button>
            )}
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-600">
              粒子の電荷
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={particleSign === 1}
                onClick={() => onParticleSignChange(1)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  particleSign === 1
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'text-red-700 bg-red-50/70 hover:bg-red-100 border-red-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                正電荷
              </button>
              <button
                type="button"
                aria-pressed={particleSign === -1}
                onClick={() => onParticleSignChange(-1)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  particleSign === -1
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'text-blue-700 bg-blue-50/70 hover:bg-blue-100 border-blue-200'
                }`}
              >
                <Minus className="w-3.5 h-3.5 shrink-0" />
                負電荷
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={!particleAnchor}
                onClick={onToggleParticleRun}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  !particleAnchor
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : particleRunState === 'running'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                      : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                }`}
              >
                {particleRunState === 'running' ? (
                  <>
                    <Pause className="w-3.5 h-3.5 shrink-0" />
                    一時停止
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 shrink-0" />
                    {particleRunState === 'finished'
                      ? '最初からスタート'
                      : 'スタート'}
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={!particleAnchor || particleRunState === 'idle'}
                onClick={onResetParticle}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  !particleAnchor || particleRunState === 'idle'
                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 cursor-pointer'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                元の位置へ
              </button>
            </div>

            {!particleAnchor ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                xy平面上の好きな位置をタップまたはクリックすると荷電粒子が置かれます。3D視点にすると電位面上にも粒子が現れます。
              </p>
            ) : (
              <p className="text-xs text-slate-500 leading-relaxed">
                配置位置 ({particleAnchor.x.toFixed(1)},{' '}
                {particleAnchor.y.toFixed(1)}) m・ドラッグで開始位置を移動できます。
              </p>
            )}
          </div>
        </section>
      ) : (
        <>
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
                <h2 className="text-xs font-semibold text-slate-500">
                  電荷を追加
                </h2>
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

          {/* Chunk 3: Selected Charge, Capacitor Potentials, or Column Inspector */}
          {isCapPotentialMode ? (
            <section className="p-5 border-b border-slate-100 space-y-4 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-500">
                  極板の電位設定
                </h2>
                <span className="text-[11px] font-medium text-slate-400">
                  ドラッグで極板間隔を変更
                </span>
              </div>

              <div className="space-y-4">
                {resolvedCapColumns.map((col, idx) => {
                  const volts = Math.round(col.potentialVolts ?? 0);
                  const isPosPlate = col.q > 0.01;
                  const isNegPlate = col.q < -0.01;
                  const plateTitle = isPosPlate
                    ? '正電荷の列の電位'
                    : isNegPlate
                      ? '負電荷の列の電位'
                      : `列${idx + 1}の電位`;
                  return (
                    <div key={col.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full text-white text-xs font-bold ${
                              isPosPlate
                                ? 'bg-red-600'
                                : isNegPlate
                                  ? 'bg-blue-600'
                                  : 'bg-slate-500'
                            }`}
                          >
                            {isPosPlate ? '+' : isNegPlate ? '−' : '0'}
                          </span>
                          <label
                            htmlFor={`cap-v-slider-${col.id}`}
                            className="text-xs font-medium text-slate-700 truncate"
                          >
                            {plateTitle}
                          </label>
                          <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                            (x={col.x.toFixed(1)}m)
                          </span>
                        </div>
                        <span
                          className={`font-mono-tabular text-sm font-semibold shrink-0 ${
                            volts > 0
                              ? 'text-orange-700'
                              : volts < 0
                                ? 'text-cyan-700'
                                : 'text-slate-700'
                          }`}
                        >
                          {volts > 0 ? '+' : volts < 0 ? '−' : ''}
                          {Math.abs(volts)} V
                        </span>
                      </div>

                      <input
                        id={`cap-v-slider-${col.id}`}
                        type="range"
                        min={-200}
                        max={200}
                        step={10}
                        value={volts}
                        onChange={(e) =>
                          onUpdateColumnPotential(
                            col.id,
                            parseFloat(e.target.value)
                          )
                        }
                        style={{
                          background:
                            'linear-gradient(to right, #0891B2 0%, #94A3B8 50%, #EA580C 100%)',
                        }}
                        className="physics-slider w-full cursor-pointer"
                      />

                      <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400">
                        <span>−200 V</span>
                        <span>0</span>
                        <span>+200 V</span>
                      </div>
                    </div>
                  );
                })}

                {(() => {
                  const v0 = resolvedCapColumns[0].potentialVolts ?? 0;
                  const v1 = resolvedCapColumns[1].potentialVolts ?? 0;
                  const d = Math.max(
                    0.5,
                    Math.abs(
                      resolvedCapColumns[1].x - resolvedCapColumns[0].x
                    )
                  );
                  const deltaV = Math.abs(v0 - v1);
                  const eField = Math.abs(v0 - v1) / d;
                  return (
                    <div className="font-mono-tabular text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-center">
                      ΔV = {deltaV.toFixed(0)} V · d = {d.toFixed(1)} m · E ={' '}
                      {eField.toFixed(0)} V/m
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={onSwapCapacitorPotentials}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  正・負の電位を入れ替え (±)
                </button>
              </div>
            </section>
          ) : isUniform ? (
            <section className="p-5 border-b border-slate-100 space-y-4 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold text-slate-500">
                  選択中の電荷の列
                </h2>
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
              <h2 className="text-xs font-semibold text-slate-500">
                選択中の電荷
              </h2>

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
        </>
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
            {isParticleMode ? (
              <>
                <div className="font-mono-tabular text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-1">
                  <div>F = q E [N]</div>
                  <div>U = q V [J]</div>
                </div>
                <p>
                  正電荷は電位 V が低い方へ（坂を下るように）、負電荷は電位 V が高い方へ（坂を上るように）静電気力を受けて加速します。
                </p>
              </>
            ) : isCapPotentialMode ? (
              <>
                <div className="font-mono-tabular text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-1">
                  <div>E = ΔV / d [V/m]</div>
                  <div>Q = C ΔV (間隔 d が狭いほど蓄えられる電気量が増加)</div>
                </div>
                <p>
                  電位差 ΔV を保ったまま極板を近づけると、3D視点の電位の傾きが急になり電場 E が強くなります。外側では電場が打ち消し合い 0 になります。
                </p>
              </>
            ) : isUniform ? (
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

